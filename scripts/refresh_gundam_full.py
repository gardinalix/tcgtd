from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SCRIPTS_DIR = ROOT / "scripts"
OUTPUTS_DIR = ROOT / "outputs"
REPORT_PATH = DATA_DIR / "latest_full_refresh_report.json"
HISTORY_PATH = DATA_DIR / "full_refresh_history.jsonl"

DEFAULT_NODE_PATHS = [
    ROOT / ".scratch" / "node-runtime" / "node-v24.14.0-win-x64" / "node.exe",
    Path.home()
    / ".cache"
    / "codex-runtimes"
    / "codex-primary-runtime"
    / "dependencies"
    / "node"
    / "bin"
    / "node.exe",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the complete TCG Tactical Database refresh pipeline."
    )
    parser.add_argument(
        "--watch-package",
        action="append",
        default=[],
        help="Package code to highlight in the official refresh report, for example GD04.",
    )
    parser.add_argument(
        "--skip-official-fetch",
        action="store_true",
        help="Reuse the current official Bandai snapshot instead of fetching it again.",
    )
    parser.add_argument(
        "--skip-prices",
        action="store_true",
        help="Skip TCGCSV and MarketZeon price refresh.",
    )
    parser.add_argument(
        "--skip-marketzeon",
        action="store_true",
        help="Skip MarketZeon public BR price comparison refresh.",
    )
    parser.add_argument(
        "--skip-fx",
        action="store_true",
        help="Skip daily USD/BRL exchange-rate refresh.",
    )
    parser.add_argument(
        "--skip-ligagundam",
        action="store_true",
        help="Skip LigaGundam public BR price comparison refresh.",
    )
    parser.add_argument(
        "--skip-meta",
        action="store_true",
        help="Skip Egman/Limitless meta event refresh.",
    )
    parser.add_argument(
        "--skip-workbooks",
        action="store_true",
        help="Skip workbook generation.",
    )
    parser.add_argument(
        "--skip-images",
        action="store_true",
        help="Skip card image cache refresh. Web data can still use remote official image URLs.",
    )
    parser.add_argument(
        "--usd-brl-multiplier",
        type=float,
        default=5.0,
        help="Multiplier used by the TCGCSV price import to derive BRL reference prices.",
    )
    parser.add_argument(
        "--price-sleep-seconds",
        type=float,
        default=0.15,
        help="Delay between TCGCSV requests.",
    )
    parser.add_argument(
        "--ligagundam-sleep-seconds",
        type=float,
        default=0.2,
        help="Delay between LigaGundam public search requests.",
    )
    parser.add_argument(
        "--skip-react-build",
        action="store_true",
        help="Skip rebuilding the Vite/React dist bundle.",
    )
    return parser.parse_args()


def find_node_executable() -> str:
    for path in DEFAULT_NODE_PATHS:
        if path.exists():
            return str(path)
    for candidate in ("node.exe", "node"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved
    raise FileNotFoundError("Unable to locate Node.js.")


def run_step(name: str, command: list[str]) -> dict:
    started = time.perf_counter()
    started_at = now_utc()
    print(f"\n==> {name}")
    print(" ".join(command))
    completed = subprocess.run(command, cwd=ROOT, check=False)
    elapsed_seconds = round(time.perf_counter() - started, 2)
    step = {
        "name": name,
        "command": command,
        "started_at_utc": started_at,
        "elapsed_seconds": elapsed_seconds,
        "return_code": completed.returncode,
        "status": "ok" if completed.returncode == 0 else "failed",
    }
    if completed.returncode != 0:
        raise subprocess.CalledProcessError(completed.returncode, command)
    return step


def run_step_soft(name: str, command: list[str]) -> dict:
    started = time.perf_counter()
    started_at = now_utc()
    print(f"\n==> {name}")
    print(" ".join(command))
    completed = subprocess.run(command, cwd=ROOT, check=False)
    elapsed_seconds = round(time.perf_counter() - started, 2)
    return {
        "name": name,
        "command": command,
        "started_at_utc": started_at,
        "elapsed_seconds": elapsed_seconds,
        "return_code": completed.returncode,
        "status": "ok" if completed.returncode == 0 else "failed",
    }


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def read_json(path: Path) -> object:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def file_info(path: Path) -> dict:
    if not path.exists():
        return {"path": str(path), "exists": False}
    stat = path.stat()
    return {
        "path": str(path),
        "exists": True,
        "bytes": stat.st_size,
        "last_modified_utc": datetime.fromtimestamp(stat.st_mtime, timezone.utc)
        .replace(microsecond=0)
        .isoformat(),
    }


def summarize_outputs() -> dict:
    official_report = read_json(DATA_DIR / "latest_refresh_report.json") or {}
    meta_results = read_csv_rows(DATA_DIR / "meta_results.csv")
    meta_events = read_csv_rows(DATA_DIR / "meta_events.csv")
    prices = read_csv_rows(DATA_DIR / "tcgplayer_prices.csv")
    marketzeon_prices = read_csv_rows(DATA_DIR / "marketzeon_price_comparison.csv")
    ligagundam_prices = read_csv_rows(DATA_DIR / "ligagundam_price_comparison.csv")
    fx_rate = read_json(DATA_DIR / "fx_rates.json") or {}
    priced_rows = [row for row in prices if str(row.get("market_price_usd", "")).strip()]
    marketzeon_comparable_rows = [
        row for row in marketzeon_prices if row.get("comparison_status") == "ok"
    ]
    ligagundam_comparable_rows = [
        row for row in ligagundam_prices if row.get("comparison_status") == "ok"
    ]
    latest_event_date = max((row.get("event_date", "") for row in meta_events), default="")
    latest_winner_date = max(
        (
            row.get("event_date", "")
            for row in meta_results
            if str(row.get("placing_rank", "")).strip() == "1"
        ),
        default="",
    )

    return {
        "official_counts": official_report.get("counts", {}),
        "official_changes": official_report.get("changes", {}),
        "meta": {
            "events": len(meta_events),
            "results": len(meta_results),
            "deck_cards": len(read_csv_rows(DATA_DIR / "meta_deck_cards.csv")),
            "sources": len(read_csv_rows(DATA_DIR / "meta_sources.csv")),
            "latest_event_date": latest_event_date,
            "latest_winner_date": latest_winner_date,
        },
        "prices": {
            "rows": len(prices),
            "priced_cards": len(priced_rows),
            "usd_brl_rate": fx_rate.get("usd_brl_rate"),
            "usd_brl_rate_checked_utc": fx_rate.get("fetched_at_utc"),
            "latest_checked_utc": max(
                (row.get("price_last_checked_utc", "") for row in prices),
                default="",
            ),
            "marketzeon_rows": len(marketzeon_prices),
            "marketzeon_comparable_cards": len(marketzeon_comparable_rows),
            "marketzeon_latest_checked_utc": max(
                (row.get("price_last_checked_utc", "") for row in marketzeon_prices),
                default="",
            ),
            "ligagundam_rows": len(ligagundam_prices),
            "ligagundam_comparable_cards": len(ligagundam_comparable_rows),
            "ligagundam_latest_checked_utc": max(
                (row.get("price_last_checked_utc", "") for row in ligagundam_prices),
                default="",
            ),
        },
        "files": {
            "database": file_info(DATA_DIR / "gundam.db"),
            "web_data": file_info(ROOT / "web" / "app-data.json"),
            "dist_index": file_info(ROOT / "dist" / "index.html"),
            "official_workbook": file_info(OUTPUTS_DIR / "gundam-card-game-database.xlsx"),
            "meta_workbook": file_info(OUTPUTS_DIR / "gundam-meta-decks.xlsx"),
            "advisor_workbook": file_info(OUTPUTS_DIR / "gundam-deck-advisor.xlsx"),
            "keep_workbook": file_info(OUTPUTS_DIR / "gundam-card-keep-priority.xlsx"),
        },
    }


def write_report(report: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    with HISTORY_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(report, ensure_ascii=False) + "\n")


def write_failure_report(
    *,
    started_at: str,
    steps: list[dict],
    failed_step: str,
    error: BaseException,
) -> None:
    report = {
        "refreshed_at_utc": now_utc(),
        "started_at_utc": started_at,
        "status": "failed",
        "failed_step": failed_step,
        "error": str(error),
        "steps": steps,
        "summary": summarize_outputs(),
    }
    write_report(report)
    print(json.dumps(report, ensure_ascii=False, indent=2))


def main() -> int:
    args = parse_args()
    steps: list[dict] = []
    started_at = now_utc()

    try:
        official_command = [
            sys.executable,
            str(SCRIPTS_DIR / "refresh_gundam_gcg_database.py"),
            "--skip-build",
        ]
        if args.skip_official_fetch:
            official_command.append("--skip-fetch")
        for package_code in args.watch_package:
            official_command.extend(["--watch-package", package_code])
        steps.append(run_step("Official Bandai catalog + SQLite", official_command))

        if not args.skip_prices:
            steps.append(
                run_step(
                    "TCGCSV price refresh",
                    [
                        sys.executable,
                        str(SCRIPTS_DIR / "fetch_tcgcsv_prices.py"),
                        "--usd-brl-multiplier",
                        str(args.usd_brl_multiplier),
                        "--sleep-seconds",
                        str(args.price_sleep_seconds),
                    ],
                )
            )
            if not args.skip_fx:
                steps.append(run_step("USD/BRL exchange-rate refresh", [sys.executable, str(SCRIPTS_DIR / "fetch_usd_brl_rate.py")]))
            if not args.skip_marketzeon:
                steps.append(
                    run_step(
                        "MarketZeon BR price comparison",
                        [
                            sys.executable,
                            str(SCRIPTS_DIR / "fetch_marketzeon_prices.py"),
                            "--usd-brl-multiplier",
                            str(args.usd_brl_multiplier),
                        ],
                    )
                )
            if not args.skip_ligagundam:
                steps.append(
                    run_step(
                        "LigaGundam BR price comparison",
                        [
                            sys.executable,
                            str(SCRIPTS_DIR / "fetch_ligagundam_prices.py"),
                            "--sleep-seconds",
                            str(args.ligagundam_sleep_seconds),
                            "--workers",
                            "1",
                            "--fresh",
                        ],
                    )
                )

        if not args.skip_meta:
            steps.append(run_step("Egman/Limitless meta refresh", [sys.executable, str(SCRIPTS_DIR / "fetch_gundam_meta_data.py")]))

        steps.append(run_step("Deck advisor data", [sys.executable, str(SCRIPTS_DIR / "build_gundam_deck_advisor_data.py")]))
        steps.append(run_step("Card keep report", [sys.executable, str(SCRIPTS_DIR / "build_card_keep_report.py")]))
        steps.append(run_step("SQLite rebuild", [sys.executable, str(SCRIPTS_DIR / "build_gundam_sqlite_database.py")]))

        if not args.skip_workbooks:
            node_executable = None
            workbook_steps = [
                ("Official workbook", "build_gundam_gcg_workbook_py.py", "build_gundam_gcg_workbook.mjs"),
                ("Meta workbook", "build_gundam_meta_workbook_py.py", "build_gundam_meta_workbook.mjs"),
                ("Deck advisor workbook", "build_gundam_deck_advisor_workbook_py.py", "build_gundam_deck_advisor_workbook.mjs"),
                ("Keep priority workbook", "build_card_keep_workbook_py.py", "build_card_keep_workbook.mjs"),
            ]
            for label, py_script, node_script in workbook_steps:
                primary = run_step_soft(label, [sys.executable, str(SCRIPTS_DIR / py_script)])
                if primary["status"] == "ok":
                    steps.append(primary)
                    continue
                if node_executable is None:
                    node_executable = find_node_executable()
                fallback = run_step_soft(f"{label} (node fallback)", [node_executable, str(SCRIPTS_DIR / node_script)])
                steps.append(primary)
                steps.append(fallback)
                if fallback["status"] != "ok":
                    raise subprocess.CalledProcessError(fallback["return_code"], fallback["command"])

        if not args.skip_images:
            steps.append(run_step("Card image cache", [sys.executable, str(SCRIPTS_DIR / "cache_gundam_card_images.py")]))

        steps.append(run_step("Web app data rebuild", [sys.executable, str(SCRIPTS_DIR / "build_gundam_web_data.py")]))
        steps.append(run_step("Price mapping audit", [sys.executable, str(SCRIPTS_DIR / "audit_gundam_prices.py"), "--strict"]))
        if not args.skip_react_build:
            steps.append(
                run_step(
                    "React/Vite production build",
                    [
                        "powershell.exe",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-File",
                        str(SCRIPTS_DIR / "react_build.ps1"),
                    ],
                )
            )
    except BaseException as error:
        failed_step = steps[-1]["name"] if steps else "startup"
        if steps and steps[-1].get("status") == "ok":
            failed_step = "next step after " + steps[-1]["name"]
        write_failure_report(
            started_at=started_at,
            steps=steps,
            failed_step=failed_step,
            error=error,
        )
        return 1

    report = {
        "refreshed_at_utc": now_utc(),
        "started_at_utc": started_at,
        "status": "ok",
        "steps": steps,
        "summary": summarize_outputs(),
    }
    write_report(report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
