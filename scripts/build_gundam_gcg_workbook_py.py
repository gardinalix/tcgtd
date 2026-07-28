from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from workbook_utils import ensure_dir, new_workbook, utc_now_iso, write_kv_sheet, write_table


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUTS_DIR = ROOT / "outputs"
SNAPSHOT_PATH = DATA_DIR / "gundam_gcg_snapshot.json"
OUTPUT_PATH = OUTPUTS_DIR / "gundam-card-game-database.xlsx"


def main() -> int:
    if not SNAPSHOT_PATH.exists():
        raise SystemExit(f"Missing snapshot: {SNAPSHOT_PATH}")

    snapshot: dict[str, Any] = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    cards = snapshot.get("cards") or []
    packages = snapshot.get("packages") or []
    products = snapshot.get("products") or []
    previews = snapshot.get("previews") or []
    faqs = snapshot.get("faqs") or []
    sources = snapshot.get("sources") or []

    generated_at_utc = utc_now_iso()

    wb = new_workbook()
    summary = wb.create_sheet("Summary")
    write_kv_sheet(
        summary,
        [
            ("generated_at_utc", generated_at_utc),
            ("cards", len(cards)),
            ("packages", len(packages)),
            ("products", len(products)),
            ("previews", len(previews)),
            ("faqs", len(faqs)),
            ("sources", len(sources)),
        ],
    )

    ws = wb.create_sheet("Packages")
    write_table(
        ws,
        packages,
        [
            "package_id",
            "package_label",
            "package_code",
            "package_kind",
            "cards_expected",
            "cards_found",
            "cards_search_url",
        ],
    )

    ws = wb.create_sheet("Products")
    write_table(
        ws,
        products,
        [
            "list_page",
            "category",
            "product_name",
            "product_code",
            "product_kind",
            "release_date",
            "msrp",
            "contains_cards_official",
            "linked_card_printings",
            "linked_preview_reveals",
            "linked_package_present",
            "product_url",
            "image_url",
        ],
    )

    ws = wb.create_sheet("Previews")
    write_table(
        ws,
        previews,
        [
            "preview_id",
            "classification",
            "preview_status",
            "confidence",
            "source_type",
            "source_title",
            "source_date",
            "section_heading",
            "card_number_hint",
            "card_name_hint",
            "product_code",
            "product_name",
            "product_release_date",
            "matched_released_card",
            "matched_released_printings",
            "context_text",
            "source_url",
            "product_url",
            "image_url",
        ],
    )

    ws = wb.create_sheet("Cards")
    write_table(
        ws,
        cards,
        [
            "detail_search_id",
            "card_number",
            "variant_code",
            "is_parallel_variant",
            "card_name",
            "rarity",
            "block_icon",
            "level",
            "cost",
            "color",
            "type",
            "effect_text",
            "zone",
            "trait",
            "link",
            "ap",
            "hp",
            "source_title",
            "where_to_get_it",
            "package_id",
            "package_label",
            "package_code",
            "package_kind",
            "detail_url",
            "cards_search_url",
            "product_url",
            "image_url",
        ],
    )

    ws = wb.create_sheet("FAQs")
    write_table(
        ws,
        faqs,
        [
            "detail_search_id",
            "card_number",
            "card_name",
            "faq_number",
            "faq_updated_date",
            "question",
            "answer",
            "detail_url",
        ],
    )

    ws = wb.create_sheet("Sources")
    write_table(ws, sources, ["record_type", "record_id", "source_url", "cache_file"])

    ensure_dir(OUTPUTS_DIR)
    wb.save(OUTPUT_PATH)

    print(
        json.dumps(
            {
                "workbook": str(OUTPUT_PATH),
                "generated_at_utc": generated_at_utc,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

