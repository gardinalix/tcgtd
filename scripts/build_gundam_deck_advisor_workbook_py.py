from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from workbook_utils import ensure_dir, new_workbook, utc_now_iso, write_kv_sheet, write_table


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUTS_DIR = ROOT / "outputs"
SNAPSHOT_PATH = DATA_DIR / "gundam_deck_advisor_snapshot.json"
OUTPUT_PATH = OUTPUTS_DIR / "gundam-deck-advisor.xlsx"


def columns_from_rows(rows: list[dict[str, Any]]) -> list[str]:
    keys: set[str] = set()
    for row in rows:
        keys.update(row.keys())
    return sorted(keys)


def main() -> int:
    if not SNAPSHOT_PATH.exists():
        raise SystemExit(f"Missing snapshot: {SNAPSHOT_PATH}")

    snapshot: dict[str, Any] = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    generated_at_utc = snapshot.get("generated_at_utc") or utc_now_iso()
    latest_event_date = snapshot.get("latest_event_date") or ""

    archetype_rows = snapshot.get("archetype_advisor_rows") or []
    card_rows = snapshot.get("card_advisor_rows") or []
    template_rows = snapshot.get("archetype_template_rows") or []
    color_pair_rows = snapshot.get("color_pair_rows") or []
    resource_rows = snapshot.get("resource_rows") or []
    rules_rows = snapshot.get("official_rules") or []
    restriction_rows = snapshot.get("current_restrictions") or []
    sources_rows = snapshot.get("sources") or []

    wb = new_workbook()

    summary = wb.create_sheet("Summary")
    write_kv_sheet(
        summary,
        [
            ("generated_at_utc", generated_at_utc),
            ("latest_event_date", latest_event_date),
            ("archetype_advisor_rows", len(archetype_rows)),
            ("card_advisor_rows", len(card_rows)),
            ("archetype_template_rows", len(template_rows)),
            ("color_pair_rows", len(color_pair_rows)),
            ("resource_rows", len(resource_rows)),
            ("official_rules", len(rules_rows)),
            ("current_restrictions", len(restriction_rows)),
            ("sources", len(sources_rows)),
        ],
    )

    ws = wb.create_sheet("Archetype Advisor")
    write_table(ws, archetype_rows, columns_from_rows(archetype_rows))

    ws = wb.create_sheet("Main Deck Advisor")
    write_table(ws, card_rows, columns_from_rows(card_rows))

    ws = wb.create_sheet("Archetype Templates")
    write_table(
        ws,
        template_rows,
        [
            "archetype",
            "template_scope",
            "template_confidence",
            "template_decks",
            "role_class",
            "inclusion_rate",
            "avg_quantity",
            "card_number",
            "card_name",
            "color",
            "card_type",
            "synergy_tags",
            "traits",
        ],
    )

    ws = wb.create_sheet("Color Pair Meta")
    write_table(
        ws,
        color_pair_rows,
        [
            "color_combination",
            "recent_top8_decks",
            "recent_wins",
            "all_top8_decks",
            "all_wins",
            "recent_meta_score",
            "overall_meta_score",
            "top_archetypes",
        ],
    )

    ws = wb.create_sheet("Resource Guide")
    write_table(
        ws,
        resource_rows,
        [
            "card_number",
            "card_name",
            "color",
            "card_type",
            "traits",
            "effect_preview",
            "where_to_get_it",
            "package_codes",
            "package_labels",
        ],
    )

    ws = wb.create_sheet("Rules")
    write_table(ws, rules_rows, columns_from_rows(rules_rows))

    ws = wb.create_sheet("Restrictions")
    write_table(ws, restriction_rows, columns_from_rows(restriction_rows))

    ws = wb.create_sheet("Sources")
    write_table(
        ws,
        sources_rows,
        ["source_category", "source_name", "status", "detail", "source_date", "source_url"],
    )

    ensure_dir(OUTPUTS_DIR)
    wb.save(OUTPUT_PATH)

    print(
        json.dumps(
            {
                "workbook": str(OUTPUT_PATH),
                "generated_at_utc": generated_at_utc,
                "latest_event_date": latest_event_date,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

