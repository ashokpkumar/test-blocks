"""Block Bots server: serves the editor, stores tests and runs them live.

Two ways to run it:
  python server.py                    on your own computer: a real browser window opens
  BLOCKBOTS_SERVER=1 python server.py  the hosted copy behind becomeaiengg.com (see Dockerfile):
                                       headless Chromium with a live view, nothing saved on disk,
                                       limited run time and number of runs at once
"""
import argparse
import asyncio
import json
import os
import re
import threading
import webbrowser
from pathlib import Path

import uvicorn
from fastapi import Body, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from runner import Run

ROOT = Path(__file__).parent
STATIC = ROOT / "static"
TESTS = ROOT / "tests"
SHOTS = ROOT / "screenshots"
SCRAPED = ROOT / "scraped"

SERVER_MODE = os.environ.get("BLOCKBOTS_SERVER") == "1"
MAX_RUNS = int(os.environ.get("BLOCKBOTS_MAX_RUNS", "2"))
MAX_SECONDS = int(os.environ.get("BLOCKBOTS_MAX_SECONDS", "300"))
PORT = 8000

# Web pages that may start runs (a regex for the browser's Origin header): the
# local editor and the becomeaiengg.com project page by default. Every other site
# is refused, since a run drives a real browser. Set BLOCKBOTS_ORIGINS to host it elsewhere.
RUN_ORIGINS = os.environ.get(
    "BLOCKBOTS_ORIGINS", r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://(www\.)?becomeaiengg\.com"
)

app = FastAPI(title="Block Bots")
runs_allowed = asyncio.Semaphore(MAX_RUNS if SERVER_MODE else 1000)


@app.get("/playground")
def playground():
    return FileResponse(STATIC / "playground" / "index.html")


@app.get("/playground/frame")
def playground_frame():
    return FileResponse(STATIC / "playground" / "frame.html")


# ---------- saved tests and files (own computer only) ----------
# On the website tests live in the visitor's browser and files are downloaded,
# so strangers can't write to the server's disk.

if not SERVER_MODE:
    for folder in (TESTS, SHOTS, SCRAPED):
        folder.mkdir(exist_ok=True)
    app.mount("/shots", StaticFiles(directory=SHOTS), name="shots")
    app.mount("/scraped", StaticFiles(directory=SCRAPED), name="scraped")

    def test_file(name):
        clean = re.sub(r"[^\w\- ]", "", name).strip()[:60]
        if not clean:
            raise HTTPException(400, "Please give the test a name.")
        return TESTS / f"{clean}.json"

    @app.get("/api/tests")
    def list_tests():
        files = sorted(TESTS.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        return [p.stem for p in files]

    @app.get("/api/tests/{name}")
    def load_test(name: str):
        path = test_file(name)
        if not path.exists():
            raise HTTPException(404, "No test with that name.")
        return json.loads(path.read_text(encoding="utf-8"))

    @app.put("/api/tests/{name}")
    def save_test(name: str, body: dict = Body(...)):
        path = test_file(name)
        path.write_text(json.dumps({**body, "name": path.stem}, indent=2), encoding="utf-8")
        return {"saved": path.stem}

    @app.delete("/api/tests/{name}")
    def delete_test(name: str):
        test_file(name).unlink(missing_ok=True)
        return {"deleted": name}


# ---------- live runs ----------

async def accept_allowed(ws: WebSocket):
    origin = ws.headers.get("origin")
    if origin and not re.fullmatch(RUN_ORIGINS, origin):
        await ws.close(code=1008)
        return False
    await ws.accept()
    return True


@app.websocket("/ws/ping")
async def ping_socket(ws: WebSocket):
    """Lets the editor check that the runner is up."""
    if await accept_allowed(ws):
        await ws.send_json({"event": "pong", "server": SERVER_MODE})
        await ws.close()


@app.websocket("/ws/run")
async def run_socket(ws: WebSocket):
    """Client sends {"action": "run", "scripts": [[block, ...], ...]}; we stream step events back.
    While a run is going, {"action": "stop"} stops it."""
    if not await accept_allowed(ws):
        return
    loop = asyncio.get_running_loop()
    events = asyncio.Queue()
    run = None
    try:
        msg = await ws.receive_json()
        if msg.get("action") != "run":
            return
        if runs_allowed.locked():
            await ws.send_json({"event": "log", "text": "Other robots are busy right now, so I'm waiting for a free one..."})
        async with runs_allowed:
            run = Run(
                emit=lambda e: loop.call_soon_threadsafe(events.put_nowait, e),
                step_delay=min(float(msg.get("delay", 0.4)), 2),
                keep_open=bool(msg.get("keepOpen")),
                shots_dir=SHOTS,
                scraped_dir=SCRAPED,
                server_mode=SERVER_MODE,
                port=PORT,
                max_seconds=MAX_SECONDS if SERVER_MODE else None,
            )
            threading.Thread(target=run.execute, args=(msg.get("scripts") or [],), daemon=True).start()

            async def listen():
                try:
                    while True:
                        msg = await ws.receive_json()
                        if msg.get("action") == "stop":
                            run.stop()
                        elif msg.get("action") == "answer":  # reply to an "ask" block
                            run.answer(str(msg.get("text", ""))[:2000])
                except (WebSocketDisconnect, RuntimeError):
                    run.stop()

            listener = asyncio.create_task(listen())
            event = {"event": None}
            try:
                while True:
                    event = await events.get()
                    await ws.send_json(event)
                    if event["event"] == "done":
                        break
            finally:
                listener.cancel()
                run.stop()
                # Keep the slot until the browser has really closed.
                while event["event"] != "done":
                    event = await events.get()
        await ws.close()
    except (WebSocketDisconnect, RuntimeError):
        if run:
            run.stop()


# The editor itself (index.html, css/, js/, examples/). Mounted last so the routes above win.
app.mount("/", StaticFiles(directory=STATIC, html=True), name="editor")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Block Bots: snap blocks together to test websites")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 inside Docker")
    parser.add_argument("--no-browser", action="store_true", help="don't open the editor automatically")
    args = parser.parse_args()
    PORT = args.port
    url = f"http://localhost:{args.port}"
    print(f"\n  Block Bots is ready at {url}{' (server mode)' if SERVER_MODE else ''}  (press Ctrl+C to quit)\n")
    if not args.no_browser and not SERVER_MODE:
        threading.Timer(1.2, webbrowser.open, args=(url,)).start()
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")
