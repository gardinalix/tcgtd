"""Refresh official cards without fetching tournaments, prices or private data."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-fetch", action="store_true", help="Rebuild from a previously fetched official snapshot (required).")
    args = parser.parse_args()
    report = {"checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "status": "failed"}
    report_path = ROOT / "data" / "latest_card_pool_report.json"
    public_path = ROOT / "web" / "app-data.json"
    previous = json.loads(public_path.read_text(encoding="utf-8")) if public_path.exists() else {}
    try:
        if args.skip_fetch:
            if not (ROOT / "data" / "gundam_gcg_snapshot.json").exists():
                raise ValueError("No official snapshot available. Run npm run cards:update without --skip-fetch.")
        else:
            subprocess.run([sys.executable, str(ROOT / "scripts" / "fetch_gundam_gcg_data.py")], cwd=ROOT, check=True)
        subprocess.run([sys.executable, str(ROOT / "scripts" / "build_gundam_web_data.py")], cwd=ROOT, check=True)
        current = json.loads(public_path.read_text(encoding="utf-8"))
        old_ids = {row["cardNumber"] for row in [*previous.get("cards", []), *previous.get("resourceCards", [])]}
        new_ids = {row["cardNumber"] for row in [*current["cards"], *current["resourceCards"]]}
        old_printings = {printing["detailSearchId"] for row in [*previous.get("cards", []), *previous.get("resourceCards", [])] for printing in row.get("printings", [])}
        new_printings = {printing["detailSearchId"] for row in [*current["cards"], *current["resourceCards"]] for printing in row.get("printings", [])}
        report.update(status="ok", card_snapshot_generated_at=current["cardSnapshotGeneratedAt"],
                      main_deck_cards=len(current["cards"]), resource_cards=len(current["resourceCards"]),
                      new_card_numbers=sorted(new_ids - old_ids), removed_card_numbers=sorted(old_ids - new_ids),
                      total_printings=len(new_printings), new_printing_ids=sorted(new_printings - old_printings))
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        report["error"] = str(error)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
