"""Copy the editor into the becomeaiengg.com frontend.

Run after changing anything in static/:
    python publish_to_site.py

(The runner itself is deployed as the blockly_runner container straight from
this folder, see Dockerfile and docker-compose.yml.)
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
EDITOR = ROOT.parent / "frontend" / "frontend" / "public" / "blockly-selenium"


def main():
    # Everything in static/ except the playground, which the runner serves itself
    # (its browser visits http://localhost:8000/playground inside the container).
    shutil.rmtree(EDITOR, ignore_errors=True)
    shutil.copytree(ROOT / "static", EDITOR, ignore=shutil.ignore_patterns("playground"))
    print(f"Editor -> {EDITOR}")


if __name__ == "__main__":
    main()
