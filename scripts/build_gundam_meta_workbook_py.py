from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from workbook_utils import ensure_dir, new_workbook, utc_now_iso, write_kv_sheet, write_table


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUTS_DIR = ROOT / "outputs"
SNAPSHOT_PATH = DATA_DIR / "gundam_meta_snapshot.json"
OUTPUT_PATH = OUTPUTS_DIR / "gundam-meta-decks.xlsx"


def safe_int(value: Any, default: int = 0) -> int:
    try:
        if value in (None, ""):
            return default
        return int(float(str(value)))
    except (TypeError, ValueError):
        return default


def build_archetype_stats(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_arch: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in results:
        arch = (row.get("archetype") or "").strip() or "(Unknown)"
        by_arch[arch].append(row)

    out: list[dict[str, Any]] = []
    for arch, rows in by_arch.items():
        firsts = sum(1 for r in rows if safe_int(r.get("placing_rank")) == 1)
        top8 = sum(1 for r in rows if 1 <= safe_int(r.get("placing_rank")) <= 8)
        unique_events = len({str(r.get("event_id") or "") for r in rows if str(r.get("event_id") or "").strip()})
        unique_players = len(
            {str(r.get("player_name") or "").strip().lower() for r in rows if str(r.get("player_name") or "").strip()}
        )
        best_finish = min((safe_int(r.get("placing_rank"), 9999) for r in rows), default=9999)
        sources = sorted({str(r.get("source_name") or "").strip() for r in rows if str(r.get("source_name") or "").strip()})
        colors = sorted(
            {
                str(r.get("color_combination") or "").strip()
                for r in rows
                if str(r.get("color_combination") or "").strip()
            }
        )
        out.append(
            {
                "archetype": arch,
                "results_count": len(rows),
                "first_place_decks": firsts,
                "top8_decks": top8,
                "unique_events": unique_events,
                "unique_players": unique_players,
                "best_finish": "" if best_finish == 9999 else best_finish,
                "sources": ", ".join(sources),
                "known_color_combinations": ", ".join(colors),
            }
        )

    out.sort(key=lambda r: (safe_int(r.get("first_place_decks")), safe_int(r.get("top8_decks")), safe_int(r.get("results_count"))), reverse=True)
    return out


def build_winning_card_stats(deck_cards: list[dict[str, Any]], winners: set[str]) -> list[dict[str, Any]]:
    by_card: dict[str, dict[str, Any]] = {}
    decks_using: dict[str, set[str]] = defaultdict(set)
    copies_by_card: Counter[str] = Counter()
    copies_by_card_deck: dict[tuple[str, str], int] = defaultdict(int)

    for row in deck_cards:
        deck_id = str(row.get("deck_id") or "")
        if not deck_id or deck_id not in winners:
            continue
        card_number = (row.get("card_number") or "").strip()
        if not card_number:
            continue
        qty = safe_int(row.get("quantity"))
        decks_using[card_number].add(deck_id)
        copies_by_card[card_number] += qty
        copies_by_card_deck[(card_number, deck_id)] += qty
        if card_number not in by_card:
            by_card[card_number] = {
                "card_number": card_number,
                "card_name": row.get("card_name") or "",
                "card_type": row.get("card_type") or "",
                "card_color": row.get("card_color") or "",
            }

    out: list[dict[str, Any]] = []
    for card_number, base in by_card.items():
        decks = decks_using.get(card_number) or set()
        total_copies = copies_by_card.get(card_number, 0)
        avg = 0.0
        if decks:
            avg = round(total_copies / len(decks), 2)
        out.append(
            {
                **base,
                "winner_decks_using": len(decks),
                "total_copies_in_winner_decks": total_copies,
                "avg_copies_when_used": avg,
            }
        )

    out.sort(key=lambda r: (safe_int(r.get("winner_decks_using")), safe_int(r.get("total_copies_in_winner_decks"))), reverse=True)
    return out


def main() -> int:
    if not SNAPSHOT_PATH.exists():
        raise SystemExit(f"Missing snapshot: {SNAPSHOT_PATH}")

    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    results: list[dict[str, Any]] = snapshot.get("results") or []
    deck_cards: list[dict[str, Any]] = snapshot.get("deck_cards") or []
    events: list[dict[str, Any]] = snapshot.get("events") or []
    source_coverage: list[dict[str, Any]] = snapshot.get("source_coverage") or []
    sources: list[dict[str, Any]] = snapshot.get("sources") or []

    winners = {str(r.get("deck_id") or "") for r in results if safe_int(r.get("placing_rank")) == 1 and str(r.get("deck_id") or "")}
    archetype_stats = build_archetype_stats(results)
    winning_card_stats = build_winning_card_stats(deck_cards, winners)

    latest_event_date = max((str(e.get("event_date") or "") for e in events), default="")
    generated_at_utc = utc_now_iso()

    wb = new_workbook()
    summary = wb.create_sheet("Summary")
    write_kv_sheet(
        summary,
        [
            ("generated_at_utc", generated_at_utc),
            ("latest_event_date", latest_event_date),
            ("events", len(events)),
            ("results", len(results)),
            ("deck_cards", len(deck_cards)),
            ("sources", len(sources)),
            ("source_coverage_rows", len(source_coverage)),
            ("winner_decks", len(winners)),
        ],
    )

    ws = wb.create_sheet("Source Coverage")
    write_table(ws, source_coverage, ["source_name", "status", "coverage_level", "notes", "source_url"])

    ws = wb.create_sheet("Events")
    write_table(
        ws,
        events,
        [
            "event_id",
            "source_name",
            "event_name",
            "event_date",
            "format_name",
            "event_type",
            "player_count",
            "organizer",
            "source_url",
            "source_page_title",
            "event_instance",
        ],
    )

    ws = wb.create_sheet("Results")
    write_table(
        ws,
        results,
        [
            "result_id",
            "deck_id",
            "event_id",
            "source_name",
            "event_name",
            "event_date",
            "format_name",
            "event_type",
            "player_count",
            "player_name",
            "placing_label",
            "placing_rank",
            "archetype",
            "color_combination",
            "leader_name",
            "deck_url",
            "source_url",
            "has_decklist",
        ],
    )

    ws = wb.create_sheet("Archetype Stats")
    write_table(
        ws,
        archetype_stats,
        [
            "archetype",
            "results_count",
            "first_place_decks",
            "top8_decks",
            "unique_events",
            "unique_players",
            "best_finish",
            "sources",
            "known_color_combinations",
        ],
    )

    ws = wb.create_sheet("Winning Cards")
    write_table(
        ws,
        winning_card_stats,
        [
            "card_number",
            "card_name",
            "card_type",
            "card_color",
            "winner_decks_using",
            "total_copies_in_winner_decks",
            "avg_copies_when_used",
        ],
    )

    ws = wb.create_sheet("Deck Cards")
    write_table(
        ws,
        deck_cards,
        [
            "deck_card_id",
            "deck_id",
            "event_id",
            "source_name",
            "event_name",
            "event_date",
            "player_name",
            "placing_label",
            "placing_rank",
            "archetype",
            "color_combination",
            "card_number",
            "card_name",
            "quantity",
            "card_type",
            "card_color",
            "package_code",
            "package_label",
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
                "latest_event_date": latest_event_date,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

