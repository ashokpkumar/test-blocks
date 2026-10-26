# 🤖 Block Bots

Snap colorful blocks together, like in Scratch, to make a robot test a website.
When you press **▶ Run**, a real browser opens and Selenium carries out your blocks one by one.
Each block lights up while it runs, plays a note when it passes and gets a ✓.
If a step goes wrong, the robot shakes its head and explains why in plain words.

## Run it

```powershell
cd blockly-selenium
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python server.py
```

The editor opens at http://localhost:8000. The first test run can take a minute while
Selenium Manager downloads the right driver for your browser (Chrome, Edge or Firefox).

Options: `--port 9000` and `--no-browser` (don't open the editor tab automatically).

## Run with Docker

Docker and the Docker Compose plugin are required. Copy `.env.example` to `.env`, then
replace `your-domain.com` in `BLOCKBOTS_ORIGINS` with the domain serving the editor
(or leave the default localhost entries for local use). Start the service with:

```sh
docker compose up --build -d
```

Open `http://localhost:8000`, or your configured host and port. To stop it, run
`docker compose down`. Compose starts the app in server mode with headless Chromium;
the default limits are two concurrent runs and five minutes per run. Set
`BLOCKBOTS_PORT` to change the published host port, and adjust `BLOCKBOTS_MAX_RUNS`
or `BLOCKBOTS_MAX_SECONDS` in `.env` if needed.

`BLOCKBOTS_ORIGINS` is a regular expression for browser `Origin` headers, not for
the websites your tests visit. Keep it limited to the domain(s) that serve the
editor. When using HTTPS behind a reverse proxy, allow the public HTTPS origin.
The reverse proxy must forward WebSocket upgrades for `/ws/run` and `/ws/ping`.

## Using it

- Drag blocks from the left into the canvas. They snap together when the glowing line appears.
- Only stacks under a 🚀 **when ▶ Run is clicked** block run. Loose stacks look faded.
- Dragging a block also takes every block under it. Drop blocks on the palette or 🗑️ to delete them.
- Right-click a block to duplicate or delete it. Right-click the canvas to tidy up.
- 🐢 → 🚀 sets how fast the robot works. "keep browser open" leaves the browser open when the test ends.
- **💾 Save** stores tests in `tests/` on the server. 📤/📥 export and import them as `.json` files.
- Keyboard: `Ctrl+Enter` run · `Esc` stop · `Ctrl+Z` undo · `Ctrl+S` save.

### The playground

http://localhost:8000/playground is a practice website made for this tool. The default value in
every block points at something on it, so a block works as soon as you drop it in.
The **Playground Demo** test, which loads on the first visit, uses about 30 blocks against it.

## Blocks (85 + Start)

| Category | Blocks |
|---|---|
| 🌐 Browser | open browser (Chrome/Edge/Firefox, visible or hidden), go to, back, forward, refresh, maximize, window size, new tab, switch tab, close tab, screenshot, delete cookies, close browser |
| 👆 Actions | click, double-click, right-click, hover, type, clear, press key, choose dropdown option by text, by value, tick/untick checkbox, drag & drop, scroll to element, scroll by, upload file, submit form, run JavaScript |
| ⏳ Wait | wait seconds, until visible, until clickable, until gone, until title has, until text appears |
| ✅ Check | title, web address, text (is / contains / is not), visible, hidden, enabled, ticked, attribute, count, text-box value |
| 📦 Variables | set, change by, maths (+ − × ÷ remainder), join text, random number, date / time, add to list, empty list, ask the user, check variable (is / contains / more than / less than) |
| 🕸️ Scrape | grab text of one element or ALL matching elements, an attribute (href, src…) of first/all, a whole table, every link on the page, the page title / address / all words, count elements: each into a variable |
| 💾 Files | **input:** load a CSV / Excel / JSON / text file. **output:** save a variable as Excel / CSV / JSON / text, save ALL variables to one Excel (a sheet per list/table) or JSON, download an image, the file a link points to, or any web address, picture of one element, full-page picture, page as PDF, page HTML, choose the output folder |
| 🪟 Popups | OK, Cancel, type into prompt, check popup text, go into frame, back to main page |
| 🔁 Control | repeat N times, repeat until, if [a] = ≠ > < contains [b], if element is on screen, for each item, say |

### Variables

Press **➕ Make a variable** in the Variables section. Every variable is a chip in that box, and blocks
that save something (scrape, set, load file…) pick their variable from a dropdown. Drag a chip onto any
white box in a block, e.g. `say`, and the box becomes `say ⟨number_of_vacancies⟩`. When the test runs, the
variable's value is used. Drag a pill to move it, or click × to take it out. You can also mix variables
into text by typing `{name}`, e.g. `Hello {name}!`.

While a test runs, the **📦 Variables** box next to the robot's browser shows every value as it changes.
Inside **for each**, use the `item` and `number` variables. When looping over a table (a loaded CSV/Excel
file or a scraped table), every column also becomes a variable for the current row. That gives you
data-driven tests: load `people.csv`, then `for each` row type `⟨Name⟩` and check the greeting.

Saved files go to the runner's `scraped/` folder (or the folder from **save files in folder**). On the
website they download to your computer instead. Every scraped value also shows in the diary with a ⬇ CSV button.

Elements can be found by css, xpath, id, name, link text, part of link, class or tag.

## How it fits together

```
static/            the editor (plain HTML/CSS/JS, no build step)
  js/blocks.js     block catalog: labels, fields, colors
  js/editor.js     workspace, drag & drop, snapping, highlights
  js/app.js        toolbar, live run over WebSocket, robot, diary
  js/sound.js      sound effects synthesized with Web Audio
  playground/      practice website
server.py          FastAPI: serves the app, saves tests, /ws/run streams step events
runner.py          one Selenium function per block type (@block("click") ...)
tests/             saved tests (JSON)
```

To add a block, add an entry to `LIST` in `static/js/blocks.js` and a function with
`@block("your_type")` in `runner.py`. The field names must match in both files.

## On becomeaiengg.com

This is the **Blockly Selenium** project in the Projects section (Personal Lab). Visitors just open it,
build a test and press ▶ Run. There's nothing to install.

- The page embeds a copy of the editor from `frontend/frontend/public/blockly-selenium/`, opened as
  `index.html?runner=/blockly-runner`.
- `docker-compose.yml` runs this folder as the **`blockly_runner`** container (see `Dockerfile`), with
  `BLOCKBOTS_SERVER=1`. nginx forwards `/blockly-runner/` to it, including the WebSocket.
- The browser there is headless Chromium, so the editor shows a small **live browser window** that
  updates after every step and while waiting. Click ⤢ to make it big.

Because strangers drive that browser, server mode:

- keeps the container on its own Docker network (`runner_net`, shared only with nginx), so it can't reach
  Postgres, Neo4j or Django;
- refuses private and internal addresses and `file://`, and turns off **upload file**;
- runs as a non-root user, at most `BLOCKBOTS_MAX_RUNS` (2) at once and `BLOCKBOTS_MAX_SECONDS` (300) each;
- writes nothing to disk. Screenshots and **save to file** come back to the visitor as downloads, and
  tests stay in the visitor's browser, so Save/Open are hidden and Export/Import still work.

The run socket accepts connections only from localhost and becomeaiengg.com.

After changing the editor (`static/`), refresh the site's copy:

```powershell
.venv\Scripts\python publish_to_site.py
```

The runner container rebuilds on the next deploy.
