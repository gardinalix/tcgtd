from __future__ import annotations

import csv
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT_PATH = DATA_DIR / "gundam_card_keep_report.json"

CARDS_PATH = DATA_DIR / "cards.csv"
META_EVENTS_PATH = DATA_DIR / "meta_events.csv"
META_RESULTS_PATH = DATA_DIR / "meta_results.csv"
META_DECK_CARDS_PATH = DATA_DIR / "meta_deck_cards.csv"
ADVISOR_PATH = DATA_DIR / "gundam_deck_advisor_snapshot.json"
TCGPLAYER_PRICES_PATH = DATA_DIR / "tcgplayer_prices.csv"

MAIN_DECK_TYPES = {"UNIT", "PILOT", "COMMAND", "BASE"}
NON_MAIN_TYPES = {"RESOURCE", "EX RESOURCE", "EX BASE", "UNIT TOKEN"}
COLOR_ORDER = ["Blue", "Green", "Purple", "Red", "White", "EX BASE", "RESOURCE", "Colorless", "Unknown"]
COMPETITIVE_CUT_LIMIT = 16
COMPETITIVE_CUT_LABEL = "top-16"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def safe_int(value: object, default: int = 0) -> int:
    try:
        if value in (None, ""):
            return default
        return int(float(str(value)))
    except (TypeError, ValueError):
        return default


def safe_float(value: object, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return default
        return float(str(value))
    except (TypeError, ValueError):
        return default


def parse_date(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        pass
    try:
        return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def normalize_color(value: str, card_type: str = "") -> str:
    color = (value or "").strip()
    card_type = (card_type or "").strip().upper()
    if color and color not in {"-", "None"}:
        return color
    if card_type == "EX BASE":
        return "EX BASE"
    if "RESOURCE" in card_type:
        return "RESOURCE"
    if not color or color in {"-", "None"}:
        return "Colorless"
    return color


def dedupe_cards(cards: list[dict[str, str]]) -> dict[str, dict[str, object]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for card in cards:
        number = (card.get("card_number") or "").strip()
        if number:
            grouped[number].append(card)

    canonical: dict[str, dict[str, object]] = {}
    for number, rows in grouped.items():
        primary = next((row for row in rows if (row.get("variant_code") or "").strip() == ""), rows[0])
        packages = sorted({(row.get("package_code") or "").strip() for row in rows if (row.get("package_code") or "").strip()})
        package_labels = sorted({(row.get("package_label") or "").strip() for row in rows if (row.get("package_label") or "").strip()})
        rarities = sorted({(row.get("rarity") or "").strip() for row in rows if (row.get("rarity") or "").strip()})
        card_type = (primary.get("type") or "").strip()
        color = normalize_color(primary.get("color") or "", card_type)
        canonical[number] = {
            "card_number": number,
            "card_name": (primary.get("card_name") or "").strip(),
            "color": color,
            "type": card_type,
            "rarity": " / ".join(rarities),
            "level": (primary.get("level") or "").strip(),
            "cost": (primary.get("cost") or "").strip(),
            "ap": (primary.get("ap") or "").strip(),
            "hp": (primary.get("hp") or "").strip(),
            "trait": (primary.get("trait") or "").strip(),
            "source_title": (primary.get("source_title") or "").strip(),
            "package_codes": ", ".join(packages),
            "package_labels": ", ".join(package_labels[:4]) + ("..." if len(package_labels) > 4 else ""),
            "effect_text": (primary.get("effect_text") or "").strip(),
            "image_url": (primary.get("image_url") or "").strip(),
            "printing_count": len(rows),
            "is_parallel_available": any((row.get("is_parallel_variant") or "").strip().upper() == "TRUE" for row in rows),
        }
    return canonical


def load_current_restrictions() -> dict[str, dict[str, object]]:
    if not ADVISOR_PATH.exists():
        return {}
    try:
        snapshot = json.loads(ADVISOR_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return {
        str(row.get("card_number") or "").strip(): row
        for row in snapshot.get("current_restrictions", [])
        if str(row.get("card_number") or "").strip()
    }


def load_tcgplayer_prices() -> dict[str, dict[str, str]]:
    if not TCGPLAYER_PRICES_PATH.exists():
        return {}
    return {
        str(row.get("card_number") or "").strip(): row
        for row in read_csv(TCGPLAYER_PRICES_PATH)
        if str(row.get("card_number") or "").strip()
    }


def placement_weight(rank: int) -> float:
    if rank <= 0:
        return 0.4
    if rank == 1:
        return 6.0
    if rank == 2:
        return 4.0
    if rank <= 4:
        return 3.0
    if rank <= COMPETITIVE_CUT_LIMIT:
        return 2.0
    if rank <= 16:
        return 1.25
    return 0.75


def event_size_weight(player_count: int) -> float:
    if player_count <= 0:
        return 1.0
    return min(2.2, 0.75 + math.log10(player_count + 1))


def recency_weight(event_date: datetime | None, latest_date: datetime | None) -> float:
    if not event_date or not latest_date:
        return 1.0
    days_old = max(0, (latest_date.date() - event_date.date()).days)
    return max(0.55, math.exp(-days_old / 240))


def percentile_rank(value: float, values: list[float]) -> float:
    values = [item for item in values if item > 0]
    if value <= 0 or not values:
        return 0.0
    if len(values) == 1:
        return 1.0 if value > 0 else 0.0
    sorted_values = sorted(values)
    below_or_equal = sum(1 for item in sorted_values if item <= value)
    return below_or_equal / len(sorted_values)


def classify_keep(row: dict[str, object], color_rows: list[dict[str, object]]) -> tuple[str, str, int, str]:
    score = safe_float(row.get("keep_score"))
    winner_decks = safe_int(row.get("winner_decks"))
    top8_decks = safe_int(row.get("top8_decks"))
    top4_decks = safe_int(row.get("top4_decks"))
    decks = safe_int(row.get("deck_count"))
    avg_copies = safe_float(row.get("average_copies"))
    archetypes = safe_int(row.get("archetype_count"))
    card_type = str(row.get("type") or "").upper()

    score_values = [safe_float(item.get("keep_score")) for item in color_rows]
    percentile = percentile_rank(score, score_values)

    if decks == 0:
        tier = "D"
        label = "Low meta signal"
        copies = 0
    elif (
        score >= 88
        or winner_decks >= 35
        or top8_decks >= 110
        or (winner_decks >= 20 and top8_decks >= 65)
        or (percentile >= 0.96 and winner_decks >= 10 and top8_decks >= 30)
    ):
        tier = "S"
        label = "Core meta staple"
        copies = 4
    elif (
        score >= 68
        or winner_decks >= 12
        or top8_decks >= 38
        or (winner_decks >= 6 and top8_decks >= 22)
        or (percentile >= 0.88 and top4_decks >= 5)
    ):
        tier = "A"
        label = "Keep playset"
        copies = 4 if avg_copies >= 2.3 or card_type in {"UNIT", "COMMAND", "PILOT"} else 3
    elif score >= 42 or winner_decks >= 3 or top8_decks >= 12 or decks >= 24:
        tier = "B"
        label = "Keep 2-4"
        copies = max(2, min(4, round(avg_copies) or 2))
    elif score >= 16 or winner_decks >= 1 or top8_decks >= 2 or decks >= 5:
        tier = "C"
        label = "Keep if you play archetype"
        copies = max(1, min(3, round(avg_copies) or 1))
    else:
        tier = "D"
        label = "Low meta signal"
        copies = 1 if decks > 0 else 0

    if card_type in NON_MAIN_TYPES and tier in {"S", "A", "B"}:
        label = f"{label} ({card_type.title()})"
    if archetypes >= 6 and tier in {"A", "B", "C"}:
        label = label.replace("archetype", "several archetypes")
    return tier, label, copies, f"{label}; observed in {winner_decks} winner decks, {top8_decks} {COMPETITIVE_CUT_LABEL} decks, {decks} decklists."


def color_sort_key(color: str) -> tuple[int, str]:
    if color in COLOR_ORDER:
        return (COLOR_ORDER.index(color), color)
    return (len(COLOR_ORDER), color)


def main() -> None:
    cards = read_csv(CARDS_PATH)
    events = read_csv(META_EVENTS_PATH)
    results = read_csv(META_RESULTS_PATH)
    deck_cards = read_csv(META_DECK_CARDS_PATH)

    card_lookup = dedupe_cards(cards)
    restrictions_by_card = load_current_restrictions()
    tcgplayer_prices_by_card = load_tcgplayer_prices()
    event_lookup = {row["event_id"]: row for row in events if row.get("event_id")}
    result_lookup = {row["deck_id"]: row for row in results if row.get("deck_id")}

    event_dates = [parse_date(row.get("event_date", "")) for row in events]
    latest_event_date = max((date for date in event_dates if date), default=None)

    stats: dict[str, dict[str, object]] = {}
    archetype_counters: dict[str, Counter[str]] = defaultdict(Counter)
    color_pair_counters: dict[str, Counter[str]] = defaultdict(Counter)
    source_counters: dict[str, Counter[str]] = defaultdict(Counter)

    for row in deck_cards:
        number = (row.get("card_number") or "").strip()
        deck_id = (row.get("deck_id") or "").strip()
        if not number or not deck_id:
            continue

        result = result_lookup.get(deck_id, {})
        event = event_lookup.get((row.get("event_id") or result.get("event_id") or "").strip(), {})
        rank = safe_int(row.get("placing_rank") or result.get("placing_rank"))
        quantity = max(0, safe_int(row.get("quantity")))
        event_date = parse_date(row.get("event_date") or result.get("event_date") or event.get("event_date", ""))
        player_count = safe_int(event.get("player_count") or result.get("player_count"))

        weight = placement_weight(rank) * event_size_weight(player_count) * recency_weight(event_date, latest_event_date)
        quantity_weight = weight * max(1, quantity)

        card_meta = card_lookup.get(number, {})
        card_type = (card_meta.get("type") or row.get("card_type") or "").strip()
        color = normalize_color(str(card_meta.get("color") or row.get("card_color") or ""), card_type)

        target = stats.setdefault(
            number,
            {
                **card_meta,
                "card_number": number,
                "card_name": card_meta.get("card_name") or row.get("card_name") or "",
                "color": color,
                "type": card_type,
                "deck_ids": set(),
                "winner_deck_ids": set(),
                "top8_deck_ids": set(),
                "top4_deck_ids": set(),
                "total_copies": 0,
                "weighted_score_raw": 0.0,
                "weighted_copies_raw": 0.0,
                "recent_weighted_raw": 0.0,
                "event_ids": set(),
                "top_placement": None,
                "last_seen": "",
            },
        )
        target["deck_ids"].add(deck_id)
        target["event_ids"].add((row.get("event_id") or result.get("event_id") or "").strip())
        target["total_copies"] = safe_int(target["total_copies"]) + quantity
        target["weighted_score_raw"] = safe_float(target["weighted_score_raw"]) + weight
        target["weighted_copies_raw"] = safe_float(target["weighted_copies_raw"]) + quantity_weight
        if event_date and latest_event_date and (latest_event_date.date() - event_date.date()).days <= 120:
            target["recent_weighted_raw"] = safe_float(target["recent_weighted_raw"]) + quantity_weight
        if rank == 1:
            target["winner_deck_ids"].add(deck_id)
        if 1 <= rank <= 4:
            target["top4_deck_ids"].add(deck_id)
        if 1 <= rank <= COMPETITIVE_CUT_LIMIT:
            target["top8_deck_ids"].add(deck_id)
        current_best = target.get("top_placement")
        if rank > 0 and (current_best is None or rank < safe_int(current_best, 999)):
            target["top_placement"] = rank
        if event_date:
            seen_text = event_date.date().isoformat()
            if not target["last_seen"] or seen_text > str(target["last_seen"]):
                target["last_seen"] = seen_text

        archetype = (row.get("archetype") or result.get("archetype") or "").strip() or "Unknown"
        color_pair = (row.get("color_combination") or result.get("color_combination") or "").strip() or "Unknown"
        source_name = (row.get("source_name") or result.get("source_name") or event.get("source_name") or "").strip() or "Unknown"
        archetype_counters[number][archetype] += max(1, quantity)
        color_pair_counters[number][color_pair] += 1
        source_counters[number][source_name] += 1

    # Include official cards that have no meta usage so binder review is complete.
    for number, card_meta in card_lookup.items():
        if number in stats:
            continue
        stats[number] = {
            **card_meta,
            "deck_ids": set(),
            "winner_deck_ids": set(),
            "top8_deck_ids": set(),
            "top4_deck_ids": set(),
            "total_copies": 0,
            "weighted_score_raw": 0.0,
            "weighted_copies_raw": 0.0,
            "recent_weighted_raw": 0.0,
            "event_ids": set(),
            "top_placement": None,
            "last_seen": "",
        }

    rows: list[dict[str, object]] = []
    for number, row in stats.items():
        deck_count = len(row["deck_ids"])
        total_copies = safe_int(row["total_copies"])
        winner_decks = len(row["winner_deck_ids"])
        top8_decks = len(row["top8_deck_ids"])
        top4_decks = len(row["top4_deck_ids"])
        event_count = len({event for event in row["event_ids"] if event})
        archetypes = archetype_counters[number]
        color_pairs = color_pair_counters[number]
        sources = source_counters[number]

        raw_keep_signal = (
            safe_float(row["weighted_copies_raw"]) * 0.18
            + safe_float(row["weighted_score_raw"]) * 0.8
            + safe_float(row["recent_weighted_raw"]) * 0.12
            + winner_decks * 6.0
            + top4_decks * 2.2
            + top8_decks * 1.7
            + deck_count * 0.45
            + total_copies * 0.08
            + min(30, len(archetypes) * 2.5)
        )

        average_copies = total_copies / deck_count if deck_count else 0
        top_archetypes = ", ".join(f"{name} ({count})" for name, count in archetypes.most_common(5))
        top_color_pairs = ", ".join(f"{name} ({count})" for name, count in color_pairs.most_common(4))
        top_sources = ", ".join(f"{name} ({count})" for name, count in sources.most_common(3))
        tcgplayer_price = tcgplayer_prices_by_card.get(number, {})

        rows.append(
            {
                "card_number": number,
                "card_name": row.get("card_name", ""),
                "color": row.get("color", "Unknown"),
                "type": row.get("type", ""),
                "rarity": row.get("rarity", ""),
                "level": row.get("level", ""),
                "cost": row.get("cost", ""),
                "ap": row.get("ap", ""),
                "hp": row.get("hp", ""),
                "trait": row.get("trait", ""),
                "source_title": row.get("source_title", ""),
                "package_codes": row.get("package_codes", ""),
                "package_labels": row.get("package_labels", ""),
                "printing_count": row.get("printing_count", 0),
                "is_parallel_available": row.get("is_parallel_available", False),
                "raw_keep_signal": round(raw_keep_signal, 3),
                "keep_score": 0,
                "deck_count": deck_count,
                "winner_decks": winner_decks,
                "top4_decks": top4_decks,
                "top8_decks": top8_decks,
                "event_count": event_count,
                "total_copies": total_copies,
                "average_copies": round(average_copies, 2),
                "weighted_meta_score": round(safe_float(row["weighted_score_raw"]), 1),
                "recent_weighted_copies": round(safe_float(row["recent_weighted_raw"]), 1),
                "archetype_count": len(archetypes),
                "top_archetypes": top_archetypes,
                "top_color_pairs": top_color_pairs,
                "top_sources": top_sources,
                "best_finish": row.get("top_placement") or "",
                "last_seen": row.get("last_seen", ""),
                "effect_text": row.get("effect_text", ""),
                "image_url": row.get("image_url", ""),
                "restriction": "",
                "restriction_effective_date": "",
                "tcgplayer_product_id": tcgplayer_price.get("tcgplayer_product_id", ""),
                "tcgplayer_url": tcgplayer_price.get("tcgplayer_url", ""),
                "market_price_usd": tcgplayer_price.get("market_price_usd", ""),
                "market_price_brl_x5": tcgplayer_price.get("market_price_brl_x5", ""),
                "price_last_checked_utc": tcgplayer_price.get("price_last_checked_utc", ""),
                "price_status": tcgplayer_price.get("price_status", "not_cached"),
                "price_error": tcgplayer_price.get("price_error", ""),
            }
        )

    positive_signals = sorted(
        safe_float(row.get("raw_keep_signal"))
        for row in rows
        if safe_float(row.get("raw_keep_signal")) > 0
    )
    if positive_signals:
        percentile_index = max(
            0,
            min(len(positive_signals) - 1, math.ceil(len(positive_signals) * 0.95) - 1),
        )
        normalization_signal = positive_signals[percentile_index]
    else:
        normalization_signal = 1

    for row in rows:
        raw_signal = safe_float(row.get("raw_keep_signal"))
        if raw_signal <= 0:
            row["keep_score"] = 0
        else:
            row["keep_score"] = round(min(100.0, (raw_signal / normalization_signal) ** 0.58 * 100), 1)

    by_color: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in rows:
        by_color[str(row["color"])].append(row)

    for color, color_rows in by_color.items():
        for row in color_rows:
            tier, label, copies, reason = classify_keep(row, color_rows)
            restriction = restrictions_by_card.get(str(row.get("card_number") or ""))
            if restriction:
                max_copies = safe_int(restriction.get("max_copies"), copies)
                restriction_label = f"{restriction.get('restriction_type', 'Restricted')} max {max_copies}"
                if max_copies > 0:
                    copies = min(copies, max_copies)
                label = f"{label} ({restriction_label})"
                reason = (
                    f"{reason} Competitive copy cap: {restriction_label}, "
                    f"effective {restriction.get('effective_date', 'current')}."
                )
                row["restriction"] = restriction_label
                row["restriction_effective_date"] = restriction.get("effective_date", "")
            row["keep_tier"] = tier
            row["keep_recommendation"] = label
            row["suggested_min_copies"] = copies
            row["keep_reason"] = reason

    tier_rank = {"S": 0, "A": 1, "B": 2, "C": 3, "D": 4}
    rows.sort(
        key=lambda item: (
            color_sort_key(str(item["color"])),
            tier_rank.get(str(item.get("keep_tier")), 9),
            -safe_float(item.get("keep_score")),
            str(item["card_number"]),
        )
    )

    color_summary = []
    for color in sorted(by_color, key=color_sort_key):
        color_rows = sorted(by_color[color], key=lambda item: -safe_float(item["keep_score"]))
        tiers = Counter(str(row.get("keep_tier", "D")) for row in color_rows)
        played_rows = [row for row in color_rows if safe_int(row.get("deck_count")) > 0]
        color_summary.append(
            {
                "color": color,
                "official_cards": len(color_rows),
                "meta_played_cards": len(played_rows),
                "s_tier": tiers.get("S", 0),
                "a_tier": tiers.get("A", 0),
                "b_tier": tiers.get("B", 0),
                "c_tier": tiers.get("C", 0),
                "d_tier": tiers.get("D", 0),
                "top_card": color_rows[0]["card_name"] if color_rows else "",
                "top_score": color_rows[0]["keep_score"] if color_rows else 0,
                "top_10": "; ".join(
                    f"{row['card_number']} {row['card_name']} ({row['keep_tier']})" for row in color_rows[:10]
                ),
            }
        )

    top_by_color = []
    for color in sorted(by_color, key=color_sort_key):
        color_rows = sorted(by_color[color], key=lambda item: -safe_float(item["keep_score"]))
        for rank, row in enumerate(color_rows[:20], start=1):
            top_by_color.append({"color_rank": rank, **row})

    low_signal = [
        row
        for row in rows
        if str(row.get("keep_tier")) == "D" and safe_int(row.get("deck_count")) == 0 and str(row.get("type")) in MAIN_DECK_TYPES
    ]
    low_signal.sort(key=lambda item: (color_sort_key(str(item["color"])), str(item["card_number"])))

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    output = {
        "generated_at_utc": generated_at,
        "latest_event_date": latest_event_date.date().isoformat() if latest_event_date else "",
        "source_files": {
            "cards": str(CARDS_PATH),
            "meta_events": str(META_EVENTS_PATH),
            "meta_results": str(META_RESULTS_PATH),
            "meta_deck_cards": str(META_DECK_CARDS_PATH),
            "tcgplayer_prices": str(TCGPLAYER_PRICES_PATH),
        },
        "counts": {
            "official_unique_cards": len(card_lookup),
            "events": len(events),
            "results": len(results),
            "deck_card_rows": len(deck_cards),
            "cards_with_meta_usage": sum(1 for row in rows if safe_int(row.get("deck_count")) > 0),
            "winner_decks": len({row["deck_id"] for row in results if safe_int(row.get("placing_rank")) == 1 and row.get("deck_id")}),
            "top8_results": sum(1 for row in results if 1 <= safe_int(row.get("placing_rank")) <= COMPETITIVE_CUT_LIMIT),
            "top16_results": sum(1 for row in results if 1 <= safe_int(row.get("placing_rank")) <= COMPETITIVE_CUT_LIMIT),
            "competitive_cut_limit": COMPETITIVE_CUT_LIMIT,
            "current_restrictions": len(restrictions_by_card),
            "tcgplayer_price_rows": len(tcgplayer_prices_by_card),
            "tcgplayer_priced_cards": sum(1 for row in tcgplayer_prices_by_card.values() if row.get("market_price_usd")),
        },
        "scoring_notes": [
            "Keep score is directional, not a card-price valuation.",
            f"Ranking weights first-place decks, {COMPETITIVE_CUT_LABEL} decks, deck adoption, copy counts, event size, recency, and archetype breadth.",
            "Official card metadata is joined by card_number; variants/parallel printings are collapsed into one collectible card row.",
            "Suggested copies respect current advisor restriction data when available.",
            "Imported decklists currently emphasize main decks; resource deck and EX base rows are listed but should not be treated as tournament-demand signals.",
            "TCGplayer prices are read from the local price cache. Price rows require manual product mapping plus TCGplayer API credentials; missing mappings are shown explicitly.",
            "BRL values use the requested simple x5 multiplier, not a live FX quote.",
            "Tier D means low tournament signal in the imported meta data, not necessarily a bad casual card.",
        ],
        "tier_definitions": [
            {"tier": "S", "meaning": "Core meta staple", "default_action": "Keep a playset before trading extras."},
            {"tier": "A", "meaning": "Strong competitive card", "default_action": "Keep a playset if you play or expect to play this color."},
            {"tier": "B", "meaning": "Archetype or role-player card", "default_action": "Keep 2-4 depending on archetype interest."},
            {"tier": "C", "meaning": "Niche, tech, or emerging card", "default_action": "Keep 1-3 if you play the matching shell."},
            {"tier": "D", "meaning": "Low imported meta signal", "default_action": "Safe to keep fewer copies unless collecting/art preference matters."},
        ],
        "color_summary": color_summary,
        "top_by_color": top_by_color,
        "all_cards": rows,
        "low_signal_main_deck": low_signal,
    }

    OUTPUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT_PATH), "counts": output["counts"], "latest_event_date": output["latest_event_date"]}))


if __name__ == "__main__":
    main()
