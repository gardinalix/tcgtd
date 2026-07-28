from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"

DEFAULT_NODE_PATH = (
    Path.home()
    / ".cache"
    / "codex-runtimes"
    / "codex-primary-runtime"
    / "dependencies"
    / "node"
    / "bin"
    / "node.exe"
)


def find_node_executable() -> str:
    if DEFAULT_NODE_PATH.exists():
        return str(DEFAULT_NODE_PATH)
    for candidate in ("node.exe", "node"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise FileNotFoundError("Unable to locate Node.js.")


def run_command(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def main() -> None:
    node_executable = find_node_executable()
    run_command([sys.executable, str(SCRIPTS_DIR / "build_gundam_deck_advisor_data.py")])
    run_command([sys.executable, str(SCRIPTS_DIR / "build_gundam_sqlite_database.py")])
    run_command([node_executable, str(SCRIPTS_DIR / "build_gundam_deck_advisor_workbook.mjs")])
    run_command([sys.executable, str(SCRIPTS_DIR / "cache_gundam_card_images.py")])
    run_command([sys.executable, str(SCRIPTS_DIR / "build_gundam_web_data.py")])


if __name__ == "__main__":
    main()
