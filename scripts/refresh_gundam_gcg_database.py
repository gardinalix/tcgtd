from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SCRIPTS_DIR = ROOT / "scripts"
SNAPSHOT_PATH = DATA_DIR / "gundam_gcg_snapshot.json"
LATEST_REPORT_PATH = DATA_DIR / "latest_refresh_report.json"
REFRESH_HISTORY_PATH = DATA_DIR / "refresh_history.jsonl"

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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Refresh the local Gundam Card Game snapshot, SQLite database, and optional workbook.",
    )
    parser.add_argument(
        "--skip-fetch",
        action="store_true",
        help="Skip the official-site fetch phase and only rebuild reports/workbook from the current snapshot.",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Skip the workbook build phase and only refresh the data snapshot/database/report.",
    )
    parser.add_argument(
        "--skip-database",
        action="store_true",
        help="Skip rebuilding data/gundam.db from the refreshed local data files.",
    )
    parser.add_argument(
        "--watch-package",
        action="append",
        default=[],
        help="Package code to highlight in the refresh report, for example GD04 or ST09.",
    )
    return parser.parse_args()


def find_node_executable() -> str:
    if DEFAULT_NODE_PATH.exists():
        return str(DEFAULT_NODE_PATH)

    for candidate in ("node.exe", "node"):
        resolved = shutil.which(candidate)
        if resolved:
            return resolved

    raise FileNotFoundError(
        "Unable to locate Node.js. Set it up in the Codex runtime or put node on PATH."
    )


def load_snapshot() -> dict | None:
    if not SNAPSHOT_PATH.exists():
        return None
    return json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))


def run_command(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def make_lookup(values: list[dict], key: str) -> dict[str, dict]:
    lookup: dict[str, dict] = {}
    for value in values:
        key_value = str(value.get(key, "")).strip()
        if key_value:
            lookup[key_value] = value
    return lookup


def derive_product_card_mappings(snapshot: dict) -> dict:
    package_codes = {
        str(row.get("package_code", "")).strip().upper()
        for row in snapshot.get("packages", [])
        if str(row.get("package_code", "")).strip()
    }

    product_url_counts: dict[str, int] = {}
    for card in snapshot.get("cards", []):
        product_url = str(card.get("product_url", "")).strip()
        if not product_url:
            continue
        product_url_counts[product_url] = product_url_counts.get(product_url, 0) + 1

    preview_url_counts: dict[str, int] = {}
    preview_code_counts: dict[str, int] = {}
    for preview in snapshot.get("previews", []):
        product_url = str(preview.get("product_url", "")).strip()
        if product_url:
            preview_url_counts[product_url] = preview_url_counts.get(product_url, 0) + 1
        product_code = str(preview.get("product_code", "")).strip().upper()
        if product_code:
            preview_code_counts[product_code] = preview_code_counts.get(product_code, 0) + 1

    products_enriched: list[dict] = []
    for product in snapshot.get("products", []):
        product_code = str(product.get("product_code", "")).strip().upper()
        product_url = str(product.get("product_url", "")).strip()
        linked_card_printings = product_url_counts.get(product_url, 0)
        linked_preview_reveals = (
            preview_url_counts.get(product_url, 0)
            if product_url
            else preview_code_counts.get(product_code, 0)
        )
        linked_package_present = bool(product_code and product_code in package_codes)
        contains_cards_official = (
            linked_card_printings > 0
            or linked_package_present
            or looks_like_card_bearing_product(product)
        )
        products_enriched.append(
            {
                **product,
                "contains_cards_official": contains_cards_official,
                "linked_card_printings": linked_card_printings,
                "linked_preview_reveals": linked_preview_reveals,
                "linked_package_present": linked_package_present,
            }
        )

    return {
        "products_enriched": products_enriched,
        "card_bearing_products": [
            product for product in products_enriched if product["contains_cards_official"]
        ],
    }


def looks_like_card_bearing_product(product: dict) -> bool:
    product_name = str(product.get("product_name", "")).strip().lower()
    if not product_name:
        return False

    non_card_accessory_terms = (
        "sleeve",
        "sleeves",
        "card case",
        "deck case",
        "damage counter",
        "dice",
    )
    if any(term in product_name for term in non_card_accessory_terms):
        return False

    card_bearing_terms = (
        "card set",
        "card collection",
        "resource card",
        "deck build box",
    )
    return any(term in product_name for term in card_bearing_terms)


def summarize_changes(previous: dict | None, current: dict, watch_packages: list[str]) -> dict:
    previous = previous or {}

    previous_cards = previous.get("cards", [])
    current_cards = current.get("cards", [])
    previous_products = previous.get("products", [])
    current_products = current.get("products", [])
    previous_faqs = previous.get("faqs", [])
    current_faqs = current.get("faqs", [])
    previous_previews = previous.get("previews", [])
    current_previews = current.get("previews", [])
    previous_derived = derive_product_card_mappings(previous)
    current_derived = derive_product_card_mappings(current)

    previous_detail_ids = {row.get("detail_search_id", "") for row in previous_cards}
    current_detail_ids = {row.get("detail_search_id", "") for row in current_cards}

    previous_card_numbers = {row.get("card_number", "") for row in previous_cards}
    current_card_numbers = {row.get("card_number", "") for row in current_cards}

    previous_product_keys = {
        row.get("product_code") or row.get("product_url", "") for row in previous_products
    }
    current_product_keys = {
        row.get("product_code") or row.get("product_url", "") for row in current_products
    }
    previous_card_bearing_product_keys = {
        row.get("product_code") or row.get("product_url", "")
        for row in previous_derived["card_bearing_products"]
    }
    current_card_bearing_product_keys = {
        row.get("product_code") or row.get("product_url", "")
        for row in current_derived["card_bearing_products"]
    }

    previous_faq_keys = {
        f"{row.get('detail_search_id', '')}::{row.get('faq_number', '')}" for row in previous_faqs
    }
    current_faq_keys = {
        f"{row.get('detail_search_id', '')}::{row.get('faq_number', '')}" for row in current_faqs
    }
    previous_preview_ids = {row.get("preview_id", "") for row in previous_previews}
    current_preview_ids = {row.get("preview_id", "") for row in current_previews}

    current_packages_by_code = make_lookup(current.get("packages", []), "package_code")
    current_products_by_code = make_lookup(current_products, "product_code")

    watched_package_reports = []
    for package_code in sorted({code.upper() for code in watch_packages if code.strip()}):
        package = current_packages_by_code.get(package_code)
        product = current_products_by_code.get(package_code)
        package_cards = [
            row for row in current_cards if str(row.get("package_code", "")).upper() == package_code
        ]
        watched_package_reports.append(
            {
                "package_code": package_code,
                "package_present": package is not None,
                "package_label": package.get("package_label", "") if package else "",
                "package_kind": package.get("package_kind", "") if package else "",
                "cards_found": int(package.get("cards_found", 0)) if package else len(package_cards),
                "product_release_date": product.get("release_date", "") if product else "",
                "product_name": product.get("product_name", "") if product else "",
            }
        )

    return {
        "new_card_printings_count": len(current_detail_ids - previous_detail_ids),
        "removed_card_printings_count": len(previous_detail_ids - current_detail_ids),
        "new_card_numbers_count": len(current_card_numbers - previous_card_numbers),
        "new_products_count": len(current_product_keys - previous_product_keys),
        "new_card_bearing_products_count": len(
            current_card_bearing_product_keys - previous_card_bearing_product_keys
        ),
        "new_faq_entries_count": len(current_faq_keys - previous_faq_keys),
        "new_preview_reveals_count": len(current_preview_ids - previous_preview_ids),
        "sample_new_card_printings": sorted(current_detail_ids - previous_detail_ids)[:25],
        "sample_new_card_numbers": sorted(current_card_numbers - previous_card_numbers)[:25],
        "sample_new_products": sorted(current_product_keys - previous_product_keys)[:25],
        "sample_new_card_bearing_products": sorted(
            current_card_bearing_product_keys - previous_card_bearing_product_keys
        )[:25],
        "sample_new_preview_reveals": sorted(current_preview_ids - previous_preview_ids)[:25],
        "watched_packages": watched_package_reports,
    }


def build_report(previous: dict | None, current: dict, watch_packages: list[str]) -> dict:
    current_derived = derive_product_card_mappings(current)
    report = {
        "refreshed_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "previous_snapshot_generated_utc": previous.get("snapshot_generated_utc") if previous else None,
        "current_snapshot_generated_utc": current.get("snapshot_generated_utc"),
        "counts": {
            "cards_count": current.get("cards_count", 0),
            "unique_card_numbers": current.get("unique_card_numbers", 0),
            "package_count": current.get("package_count", 0),
            "product_count": current.get("product_count", 0),
            "card_bearing_products_count": len(current_derived["card_bearing_products"]),
            "faq_count": current.get("faq_count", 0),
            "preview_count": current.get("preview_count", len(current.get("previews", []))),
        },
        "changes": summarize_changes(previous, current, watch_packages),
        "card_bearing_products_sample": [
            {
                "product_name": row.get("product_name", ""),
                "product_code": row.get("product_code", ""),
                "release_date": row.get("release_date", ""),
                "linked_card_printings": row.get("linked_card_printings", 0),
                "linked_preview_reveals": row.get("linked_preview_reveals", 0),
            }
            for row in current_derived["card_bearing_products"][:25]
        ],
        "official_preview_sample": [
            {
                "preview_id": row.get("preview_id", ""),
                "card_number_hint": row.get("card_number_hint", ""),
                "card_name_hint": row.get("card_name_hint", ""),
                "product_code": row.get("product_code", ""),
                "preview_status": row.get("preview_status", ""),
                "source_type": row.get("source_type", ""),
                "source_date": row.get("source_date", ""),
            }
            for row in current.get("previews", [])[:25]
        ],
        "paths": {
            "snapshot": str(SNAPSHOT_PATH),
            "database": str(ROOT / "data" / "gundam.db"),
            "workbook": str(ROOT / "outputs" / "gundam-card-game-database.xlsx"),
        },
    }
    return report


def write_report(report: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LATEST_REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    with REFRESH_HISTORY_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(report, ensure_ascii=False) + "\n")


def main() -> int:
    args = parse_args()

    if sys.platform.startswith("win"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:  # noqa: BLE001
            pass

    previous_snapshot = load_snapshot()

    if not args.skip_fetch:
        run_command([sys.executable, str(SCRIPTS_DIR / "fetch_gundam_gcg_data.py")])

    current_snapshot = load_snapshot()
    if current_snapshot is None:
        raise FileNotFoundError("No snapshot found after refresh.")

    if not args.skip_database:
        run_command([sys.executable, str(SCRIPTS_DIR / "build_gundam_sqlite_database.py")])

    if not args.skip_build:
        node_executable = find_node_executable()
        run_command([node_executable, str(SCRIPTS_DIR / "build_gundam_gcg_workbook.mjs")])

    report = build_report(previous_snapshot, current_snapshot, args.watch_package)
    write_report(report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
