from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

CARDS_PATH = DATA_DIR / "cards.csv"
META_RESULTS_PATH = DATA_DIR / "meta_results.csv"
META_DECK_CARDS_PATH = DATA_DIR / "meta_deck_cards.csv"
META_SOURCE_COVERAGE_PATH = DATA_DIR / "meta_source_coverage.csv"
META_SNAPSHOT_PATH = DATA_DIR / "gundam_meta_snapshot.json"

OUTPUT_PATH = DATA_DIR / "gundam_deck_advisor_snapshot.json"

RECENT_WINDOW_DAYS = 120
COMPETITIVE_CUT_LIMIT = 16
COMPETITIVE_CUT_LABEL = "Top 16"
MAIN_DECK_TYPES = {"UNIT", "PILOT", "COMMAND", "BASE"}
RESOURCE_TYPES = {"RESOURCE"}

OFFICIAL_RULES = [
    {
        "rule_area": "Main deck",
        "rule_value": "Exactly 50 cards",
        "note": "Official English deck-building guide.",
        "source_title": "How to Start Deck Building",
        "source_date": "2025-07-25",
        "source_url": "https://www.gundam-gcg.com/en/news/decks-build.html",
        "classification": "official_rule",
    },
    {
        "rule_area": "Deck colors",
        "rule_value": "Up to 2 colors in the main deck",
        "note": "Official English deck-building guide.",
        "source_title": "How to Start Deck Building",
        "source_date": "2025-07-25",
        "source_url": "https://www.gundam-gcg.com/en/news/decks-build.html",
        "classification": "official_rule",
    },
    {
        "rule_area": "Copy limit",
        "rule_value": "Up to 4 copies of the same card number unless restricted",
        "note": "Official English deck-building guide plus current restricted list.",
        "source_title": "How to Start Deck Building",
        "source_date": "2025-07-25",
        "source_url": "https://www.gundam-gcg.com/en/news/decks-build.html",
        "classification": "official_rule",
    },
    {
        "rule_area": "Resource deck",
        "rule_value": "Exactly 10 resource cards",
        "note": "Resource deck is separate from the main 50-card deck.",
        "source_title": "How to Start Deck Building",
        "source_date": "2025-07-25",
        "source_url": "https://www.gundam-gcg.com/en/news/decks-build.html",
        "classification": "official_rule",
    },
    {
        "rule_area": "Resource copies",
        "rule_value": "No copy limit on the same resource card",
        "note": "Official English deck-building guide.",
        "source_title": "How to Start Deck Building",
        "source_date": "2025-07-25",
        "source_url": "https://www.gundam-gcg.com/en/news/decks-build.html",
        "classification": "official_rule",
    },
    {
        "rule_area": "Current color pool",
        "rule_value": "Blue, Green, Red, White, Purple",
        "note": (
            "Inference from the official 2026 English product/card pool. "
            "The older July 2025 deck-building article still described four colors."
        ),
        "source_title": "Deck Build Box Freedom Ascension [SC01]",
        "source_date": "2026-07-24",
        "source_url": "https://www.gundam-gcg.com/en/products/deck-build-box.html",
        "classification": "official_inference",
    },
]

CURRENT_RESTRICTIONS = [
    {
        "card_number": "ST02-016",
        "card_name": "Corsica Base",
        "restriction_type": "Restricted",
        "max_copies": 2,
        "effective_date": "2026-04-01",
        "note": "Current official restricted card list for English-language organized play.",
        "source_title": "Gundam Card Game Banned and Restricted Card List",
        "source_date": "2026-03-27",
        "source_url": "https://www.gundam-gcg.com/en/news/01_234.html",
    }
]

SOURCE_REFERENCES = [
    {
        "source_category": "official_rules",
        "source_name": "How to Start Deck Building",
        "status": "active_reference",
        "detail": "Deck construction basics, copy limit, and resource deck rules.",
        "source_date": "2025-07-25",
        "source_url": "https://www.gundam-gcg.com/en/news/decks-build.html",
    },
    {
        "source_category": "official_rules",
        "source_name": "Gundam Card Game Banned and Restricted Card List",
        "status": "active_reference",
        "detail": "Current restricted list effective April 1, 2026.",
        "source_date": "2026-03-27",
        "source_url": "https://www.gundam-gcg.com/en/news/01_234.html",
    },
    {
        "source_category": "official_rules",
        "source_name": "How to Play the GUNDAM CARD GAME",
        "status": "active_reference",
        "detail": "Current official play guide and setup overview.",
        "source_date": "",
        "source_url": "https://www.gundam-gcg.com/en/welcome/playguide.php",
    },
    {
        "source_category": "official_rules",
        "source_name": "OFFICIAL RULES",
        "status": "active_reference",
        "detail": "Official rules hub with comprehensive rules and tournament documents.",
        "source_date": "2026-01-30",
        "source_url": "https://www.gundam-gcg.com/en/rules/",
    },
    {
        "source_category": "official_inference",
        "source_name": "Deck Build Box Freedom Ascension [SC01]",
        "status": "active_reference",
        "detail": "Current official product copy explicitly references five colors in the English pool.",
        "source_date": "2026-07-24",
        "source_url": "https://www.gundam-gcg.com/en/products/deck-build-box.html",
    },
]

SYNERGY_PATTERNS = [
    ("link", [r"\blink\b", r"\[[^\]]+\]"]),
    ("pair", [r"\bpaired\b", r"\bpilot\b"]),
    ("blocker", [r"\bblocker\b"]),
    ("repair", [r"\brepair\b"]),
    ("breach", [r"\bbreach\b"]),
    ("draw", [r"\bdraw\b"]),
    ("search", [r"\bsearch\b", r"look at .*deck", r"choose .* from your deck", r"reveal .*deck"]),
    ("resource", [r"\bresource\b"]),
    ("removal", [r"\bdestroy\b", r"trash 1 enemy", r"trash 1 unit", r"destroy 1"]),
    ("bounce", [r"return .* to .*hand", r"return .* hand"]),
    ("rest_control", [r"rest 1 enemy", r"rest all enemy", r"\binactive\b"]),
    ("recovery", [r"\brecover\b", r"return .* from your trash", r"add .* from your trash"]),
    ("trash", [r"\btrash\b"]),
    ("token", [r"\btoken\b"]),
    ("shield", [r"\bshield\b"]),
    ("damage_push", [r"battle damage", r"when attacking", r"deals? \d+ damage"]),
    ("ap_mod", [r"\bap\b"]),
    ("base_support", [r"\bbase\b"]),
]


@dataclass
class CanonicalCard:
    card_number: str
    card_name: str
    color: str
    card_type: str
    level: str
    cost: str
    trait_tokens: list[str]
    link_targets: list[str]
    synergy_tags: list[str]
    effect_preview: str
    where_to_get_it: str
    package_codes: list[str]
    package_labels: list[str]
    source_title: str
    detail_search_id: str


def main() -> None:
    cards = read_csv(CARDS_PATH)
    meta_results = read_csv(META_RESULTS_PATH)
    meta_deck_cards = read_csv(META_DECK_CARDS_PATH)
    meta_source_coverage = read_csv(META_SOURCE_COVERAGE_PATH)

    canonical_cards = build_canonical_cards(cards)
    canonical_lookup = {card.card_number: card for card in canonical_cards}

    deck_infos, latest_event_date, recent_cutoff = build_deck_infos(meta_results)
    cards_by_deck = build_cards_by_deck(meta_deck_cards)

    archetype_rows, archetype_template_rows = build_archetype_outputs(
        deck_infos,
        cards_by_deck,
        canonical_lookup,
        recent_cutoff,
    )
    color_pair_rows = build_color_pair_rows(deck_infos, recent_cutoff)
    card_advisor_rows = build_card_advisor_rows(
        canonical_cards,
        deck_infos,
        cards_by_deck,
        recent_cutoff,
    )
    resource_rows = build_resource_rows(canonical_cards)
    input_options = build_input_options(
        canonical_cards,
        archetype_rows,
        card_advisor_rows,
    )

    top_archetype = archetype_rows[0]["archetype"] if archetype_rows else ""
    default_primary, default_secondary = infer_default_colors(color_pair_rows)

    sources = list(SOURCE_REFERENCES)
    for row in meta_source_coverage:
        sources.append(
            {
                "source_category": "meta_source",
                "source_name": normalize_text(row.get("source_name")),
                "status": normalize_text(row.get("status")),
                "detail": normalize_text(row.get("notes")),
                "source_date": "",
                "source_url": normalize_text(row.get("source_url")),
            }
        )

    meta_snapshot_generated = ""
    if META_SNAPSHOT_PATH.exists():
        meta_snapshot = json.loads(META_SNAPSHOT_PATH.read_text(encoding="utf-8"))
        meta_snapshot_generated = normalize_text(meta_snapshot.get("snapshot_generated_utc"))

    payload = {
        "snapshot_generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "meta_snapshot_generated_utc": meta_snapshot_generated,
        "recent_window_days": RECENT_WINDOW_DAYS,
        "recent_cutoff_date": recent_cutoff.isoformat() if recent_cutoff else "",
        "latest_event_date": latest_event_date.isoformat() if latest_event_date else "",
        "defaults": {
            "primary_color": default_primary,
            "secondary_color": default_secondary,
            "archetype_keyword": top_archetype,
            "trait_keyword": "",
            "synergy_tag": "Any",
            "preferred_card_type": "Any",
            "meta_weight": 60,
            "synergy_weight": 40,
            "template_archetype": top_archetype,
        },
        "official_rules": OFFICIAL_RULES,
        "current_restrictions": CURRENT_RESTRICTIONS,
        "input_options": input_options,
        "archetype_advisor_rows": archetype_rows,
        "card_advisor_rows": card_advisor_rows,
        "archetype_template_rows": archetype_template_rows,
        "color_pair_rows": color_pair_rows,
        "resource_rows": resource_rows,
        "sources": sources,
        "counts": {
            "main_deck_cards": sum(1 for card in canonical_cards if card.card_type in MAIN_DECK_TYPES),
            "resource_cards": len(resource_rows),
            "archetypes": len(archetype_rows),
            "template_rows": len(archetype_template_rows),
            "color_pairs": len(color_pair_rows),
            "decklists": len(deck_infos),
        },
    }

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"snapshot": str(OUTPUT_PATH), "counts": payload["counts"]}, indent=2))


def read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    import csv

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def normalize_text(value: object) -> str:
    text = str(value or "").replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_upper(value: object) -> str:
    return normalize_text(value).upper()


def safe_int(value: object) -> int:
    text = normalize_text(value)
    if not text:
        return 0
    try:
        return int(float(text))
    except ValueError:
        return 0


def parse_date(value: object) -> datetime | None:
    text = normalize_text(value)
    if not text:
        return None
    for fmt in (
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%m/%d/%Y",
        "%m/%d/%y",
        "%B %d, %Y",
        "%b %d, %Y",
    ):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def truncate_text(value: str, limit: int = 220) -> str:
    if len(value) <= limit:
        return value
    return value[: limit - 3].rstrip() + "..."


def parse_trait_tokens(value: object) -> list[str]:
    text = normalize_text(value)
    if not text or text == "-":
        return []
    tokens = [normalize_text(token) for token in re.findall(r"\(([^()]+)\)", text)]
    if tokens:
        return sorted(dict.fromkeys(token for token in tokens if token))
    return [text]


def parse_link_targets(value: object) -> list[str]:
    text = normalize_text(value)
    if not text or text == "-":
        return []
    targets = [normalize_text(token) for token in re.findall(r"\[([^\]]+)\]", text)]
    if targets:
        return sorted(dict.fromkeys(target for target in targets if target))
    return [text]


def extract_synergy_tags(card_name: str, card_type: str, effect_text: str, trait_text: str, link_text: str) -> list[str]:
    haystack = " ".join(
        part
        for part in [
            normalize_text(card_name).lower(),
            normalize_text(card_type).lower(),
            normalize_text(effect_text).lower(),
            normalize_text(trait_text).lower(),
            normalize_text(link_text).lower(),
        ]
        if part
    )
    tags: list[str] = []
    for tag, patterns in SYNERGY_PATTERNS:
        if any(re.search(pattern, haystack, flags=re.IGNORECASE) for pattern in patterns):
            tags.append(tag)
    if normalize_text(card_type).upper() == "BASE" and "base_support" not in tags:
        tags.append("base_support")
    if normalize_text(card_type).upper() == "PILOT" and "pair" not in tags:
        tags.append("pair")
    return sorted(dict.fromkeys(tags))


def choose_canonical_row(rows: list[dict]) -> dict:
    def sort_key(row: dict) -> tuple[int, int, str]:
        is_parallel = normalize_upper(row.get("is_parallel_variant")) == "TRUE"
        variant = normalize_text(row.get("variant_code"))
        return (1 if is_parallel else 0, 1 if variant else 0, normalize_text(row.get("detail_search_id")))

    return sorted(rows, key=sort_key)[0]


def build_canonical_cards(cards: list[dict]) -> list[CanonicalCard]:
    rows_by_card_number: dict[str, list[dict]] = defaultdict(list)
    for row in cards:
        card_number = normalize_upper(row.get("card_number"))
        if card_number:
            rows_by_card_number[card_number].append(row)

    canonical_cards: list[CanonicalCard] = []
    for card_number, grouped_rows in sorted(rows_by_card_number.items()):
        primary = choose_canonical_row(grouped_rows)
        card_name = normalize_text(primary.get("card_name"))
        color = normalize_text(primary.get("color"))
        color = color if color and color != "-" else "Neutral"
        card_type = normalize_upper(primary.get("type"))
        package_codes = sorted(
            {
                normalize_upper(row.get("package_code"))
                for row in grouped_rows
                if normalize_upper(row.get("package_code"))
            }
        )
        package_labels = sorted(
            {
                normalize_text(row.get("package_label"))
                for row in grouped_rows
                if normalize_text(row.get("package_label"))
            }
        )
        effect_text = normalize_text(primary.get("effect_text"))
        trait_text = normalize_text(primary.get("trait"))
        link_text = normalize_text(primary.get("link"))
        canonical_cards.append(
            CanonicalCard(
                card_number=card_number,
                card_name=card_name,
                color=color,
                card_type=card_type,
                level=normalize_text(primary.get("level")) or "-",
                cost=normalize_text(primary.get("cost")) or "-",
                trait_tokens=parse_trait_tokens(trait_text),
                link_targets=parse_link_targets(link_text),
                synergy_tags=extract_synergy_tags(
                    card_name,
                    card_type,
                    effect_text,
                    trait_text,
                    link_text,
                ),
                effect_preview=truncate_text(effect_text, 240),
                where_to_get_it=normalize_text(primary.get("where_to_get_it")),
                package_codes=package_codes,
                package_labels=package_labels,
                source_title=normalize_text(primary.get("source_title")),
                detail_search_id=normalize_text(primary.get("detail_search_id")),
            )
        )
    return canonical_cards


def build_deck_infos(meta_results: list[dict]) -> tuple[dict[str, dict], datetime | None, datetime | None]:
    latest_event_date: datetime | None = None
    deck_infos: dict[str, dict] = {}
    for row in meta_results:
        deck_id = normalize_text(row.get("deck_id"))
        if not deck_id or normalize_upper(row.get("has_decklist")) != "TRUE":
            continue
        event_date = parse_date(row.get("event_date"))
        if event_date and (latest_event_date is None or event_date > latest_event_date):
            latest_event_date = event_date
        deck_infos[deck_id] = {
            "deck_id": deck_id,
            "archetype": normalize_text(row.get("archetype")) or "(Unclassified)",
            "color_combination": normalize_text(row.get("color_combination")) or "(Unknown)",
            "event_name": normalize_text(row.get("event_name")),
            "event_date": event_date,
            "placing_rank": safe_int(row.get("placing_rank")),
            "placing_label": normalize_text(row.get("placing_label")),
            "player_name": normalize_text(row.get("player_name")),
            "source_name": normalize_text(row.get("source_name")),
            "event_type": normalize_text(row.get("event_type")),
            "format_name": normalize_text(row.get("format_name")),
        }

    recent_cutoff = latest_event_date - timedelta(days=RECENT_WINDOW_DAYS) if latest_event_date else None
    return deck_infos, latest_event_date, recent_cutoff


def build_cards_by_deck(meta_deck_cards: list[dict]) -> dict[str, list[dict]]:
    cards_by_deck: dict[str, list[dict]] = defaultdict(list)
    for row in meta_deck_cards:
        deck_id = normalize_text(row.get("deck_id"))
        card_number = normalize_upper(row.get("card_number"))
        if not deck_id or not card_number:
            continue
        cards_by_deck[deck_id].append(
            {
                "card_number": card_number,
                "quantity": safe_int(row.get("quantity")),
                "card_name": normalize_text(row.get("card_name")),
                "card_color": normalize_text(row.get("card_color")) or "Neutral",
                "card_type": normalize_upper(row.get("card_type")),
            }
        )
    return cards_by_deck


def build_archetype_outputs(
    deck_infos: dict[str, dict],
    cards_by_deck: dict[str, list[dict]],
    canonical_lookup: dict[str, CanonicalCard],
    recent_cutoff: datetime | None,
) -> tuple[list[dict], list[dict]]:
    archetype_decks: dict[str, list[str]] = defaultdict(list)
    archetype_recent_top8_decks: dict[str, list[str]] = defaultdict(list)
    archetype_all_top8_decks: dict[str, list[str]] = defaultdict(list)
    color_counters: dict[str, Counter] = defaultdict(Counter)
    best_finish: dict[str, int] = {}

    for deck_id, info in deck_infos.items():
        archetype = info["archetype"]
        archetype_decks[archetype].append(deck_id)
        color_counters[archetype][info["color_combination"]] += 1
        placing_rank = int(info["placing_rank"] or 0)
        if placing_rank > 0:
            best_finish[archetype] = min(best_finish.get(archetype, 999), placing_rank)
        if placing_rank and placing_rank <= COMPETITIVE_CUT_LIMIT:
            archetype_all_top8_decks[archetype].append(deck_id)
            if recent_cutoff and info["event_date"] and info["event_date"] >= recent_cutoff:
                archetype_recent_top8_decks[archetype].append(deck_id)

    total_recent_top8 = sum(len(deck_ids) for deck_ids in archetype_recent_top8_decks.values())
    total_all_top8 = sum(len(deck_ids) for deck_ids in archetype_all_top8_decks.values())
    total_recent_winners = sum(
        1
        for info in deck_infos.values()
        if info["placing_rank"] == 1 and recent_cutoff and info["event_date"] and info["event_date"] >= recent_cutoff
    )
    total_all_winners = sum(1 for info in deck_infos.values() if info["placing_rank"] == 1)

    archetype_rows: list[dict] = []
    template_rows: list[dict] = []

    for archetype in sorted(archetype_decks):
        deck_ids = archetype_decks[archetype]
        recent_top8_ids = archetype_recent_top8_decks[archetype]
        all_top8_ids = archetype_all_top8_decks[archetype]

        recent_decklists = 0
        recent_wins = 0
        all_wins = 0
        for deck_id in deck_ids:
            info = deck_infos[deck_id]
            if recent_cutoff and info["event_date"] and info["event_date"] >= recent_cutoff:
                recent_decklists += 1
                if info["placing_rank"] == 1:
                    recent_wins += 1
            if info["placing_rank"] == 1:
                all_wins += 1

        template_deck_ids, template_scope = choose_template_decks(deck_ids, recent_top8_ids, all_top8_ids)
        template_confidence = describe_template_confidence(len(template_deck_ids))
        card_stats: dict[str, dict] = defaultdict(
            lambda: {
                "decks": set(),
                "total_qty": 0,
            }
        )
        for deck_id in template_deck_ids:
            for deck_card in cards_by_deck.get(deck_id, []):
                card_number = deck_card["card_number"]
                entry = card_stats[card_number]
                entry["decks"].add(deck_id)
                entry["total_qty"] += deck_card["quantity"]

        trait_counter: Counter = Counter()
        tag_counter: Counter = Counter()
        core_cards_preview: list[str] = []
        ordered_template_rows: list[dict] = []
        for card_number, stat in card_stats.items():
            decks_using = len(stat["decks"])
            inclusion_rate = decks_using / len(template_deck_ids) if template_deck_ids else 0
            if inclusion_rate < 0.15:
                continue
            card = canonical_lookup.get(card_number)
            if not card:
                continue
            avg_quantity = stat["total_qty"] / decks_using if decks_using else 0
            role_class = classify_template_role(inclusion_rate)
            if role_class == "core" and len(core_cards_preview) < 6:
                core_cards_preview.append(card.card_name)
            weight = inclusion_rate * avg_quantity
            for token in card.trait_tokens:
                trait_counter[token] += weight
            for tag in card.synergy_tags:
                tag_counter[tag] += weight
            ordered_template_rows.append(
                {
                    "archetype": archetype,
                    "template_scope": template_scope,
                    "template_confidence": template_confidence,
                    "template_decks": len(template_deck_ids),
                    "role_class": role_class,
                    "inclusion_rate": round(inclusion_rate * 100, 1),
                    "avg_quantity": round(avg_quantity, 2),
                    "card_number": card.card_number,
                    "card_name": card.card_name,
                    "color": card.color,
                    "card_type": card.card_type,
                    "synergy_tags": ", ".join(card.synergy_tags),
                    "traits": ", ".join(card.trait_tokens),
                }
            )

        ordered_template_rows.sort(
            key=lambda row: (
                role_sort_key(row["role_class"]),
                -row["inclusion_rate"],
                -row["avg_quantity"],
                row["card_name"],
            )
        )
        template_rows.extend(ordered_template_rows)

        common_color = color_counters[archetype].most_common(1)[0][0] if color_counters[archetype] else "(Unknown)"
        recent_top8 = len(recent_top8_ids)
        all_top8 = len(all_top8_ids)
        recent_meta_score = weighted_meta_score(recent_top8, total_recent_top8, recent_wins, total_recent_winners)
        overall_meta_score = weighted_meta_score(all_top8, total_all_top8, all_wins, total_all_winners)
        archetype_rows.append(
            {
                "archetype": archetype,
                "common_color_combination": common_color,
                "template_confidence": template_confidence,
                "template_scope": template_scope,
                "recent_decklists": recent_decklists,
                "recent_top8_decks": recent_top8,
                "recent_wins": recent_wins,
                "all_decklists": len(deck_ids),
                "all_top8_decks": all_top8,
                "all_wins": all_wins,
                "recent_meta_score": recent_meta_score,
                "overall_meta_score": overall_meta_score,
                "best_finish": best_finish.get(archetype, ""),
                "signature_traits": ", ".join(label for label, _ in trait_counter.most_common(5)),
                "signature_tags": ", ".join(label for label, _ in tag_counter.most_common(5)),
                "core_cards_preview": ", ".join(core_cards_preview),
            }
        )

    archetype_rows.sort(
        key=lambda row: (
            -row["recent_top8_decks"],
            -row["recent_wins"],
            -row["all_top8_decks"],
            -row["all_wins"],
            row["archetype"],
        )
    )
    return archetype_rows, template_rows


def choose_template_decks(
    all_deck_ids: list[str],
    recent_top8_ids: list[str],
    all_top8_ids: list[str],
) -> tuple[list[str], str]:
    if len(recent_top8_ids) >= 4:
        return recent_top8_ids, f"Recent {COMPETITIVE_CUT_LABEL} ({RECENT_WINDOW_DAYS}d)"
    if len(all_top8_ids) >= 4:
        return all_top8_ids, f"All imported {COMPETITIVE_CUT_LABEL}"
    if len(all_top8_ids) >= 1:
        return all_top8_ids, "Small-sample top finishes"
    return all_deck_ids, "All imported decklists"


def classify_template_role(inclusion_rate: float) -> str:
    if inclusion_rate >= 0.60:
        return "core"
    if inclusion_rate >= 0.35:
        return "support"
    return "tech"


def describe_template_confidence(deck_count: int) -> str:
    if deck_count >= 12:
        return "high"
    if deck_count >= 6:
        return "medium"
    if deck_count >= 3:
        return "low"
    return "exploratory"


def role_sort_key(role_class: str) -> int:
    return {"core": 0, "support": 1, "tech": 2}.get(role_class, 9)


def weighted_meta_score(top8_count: int, total_top8: int, win_count: int, total_wins: int) -> float:
    top8_rate = (top8_count / total_top8) * 100 if total_top8 else 0
    win_rate = (win_count / total_wins) * 100 if total_wins else 0
    return round((top8_rate * 0.65) + (win_rate * 0.35), 1)


def build_color_pair_rows(deck_infos: dict[str, dict], recent_cutoff: datetime | None) -> list[dict]:
    counters: dict[str, dict[str, object]] = defaultdict(
        lambda: {
            "recent_top8_decks": 0,
            "recent_wins": 0,
            "all_top8_decks": 0,
            "all_wins": 0,
            "archetypes": Counter(),
        }
    )
    total_recent_top8 = 0
    total_all_top8 = 0
    total_recent_wins = 0
    total_all_wins = 0

    for info in deck_infos.values():
        placing_rank = int(info["placing_rank"] or 0)
        if placing_rank <= 0:
            continue
        combo = info["color_combination"]
        entry = counters[combo]
        entry["archetypes"][info["archetype"]] += 1
        if placing_rank <= COMPETITIVE_CUT_LIMIT:
            entry["all_top8_decks"] += 1
            total_all_top8 += 1
            if recent_cutoff and info["event_date"] and info["event_date"] >= recent_cutoff:
                entry["recent_top8_decks"] += 1
                total_recent_top8 += 1
        if placing_rank == 1:
            entry["all_wins"] += 1
            total_all_wins += 1
            if recent_cutoff and info["event_date"] and info["event_date"] >= recent_cutoff:
                entry["recent_wins"] += 1
                total_recent_wins += 1

    rows = []
    for color_combination, entry in counters.items():
        rows.append(
            {
                "color_combination": color_combination,
                "recent_top8_decks": entry["recent_top8_decks"],
                "recent_wins": entry["recent_wins"],
                "all_top8_decks": entry["all_top8_decks"],
                "all_wins": entry["all_wins"],
                "recent_meta_score": weighted_meta_score(
                    int(entry["recent_top8_decks"]),
                    total_recent_top8,
                    int(entry["recent_wins"]),
                    total_recent_wins,
                ),
                "overall_meta_score": weighted_meta_score(
                    int(entry["all_top8_decks"]),
                    total_all_top8,
                    int(entry["all_wins"]),
                    total_all_wins,
                ),
                "top_archetypes": ", ".join(
                    f"{label} ({count})"
                    for label, count in entry["archetypes"].most_common(5)
                ),
            }
        )
    rows.sort(
        key=lambda row: (
            -row["recent_top8_decks"],
            -row["recent_wins"],
            -row["all_top8_decks"],
            row["color_combination"],
        )
    )
    return rows


def build_card_advisor_rows(
    canonical_cards: list[CanonicalCard],
    deck_infos: dict[str, dict],
    cards_by_deck: dict[str, list[dict]],
    recent_cutoff: datetime | None,
) -> list[dict]:
    restrictions_by_card = {row["card_number"]: row for row in CURRENT_RESTRICTIONS}
    top8_deck_ids = {deck_id for deck_id, info in deck_infos.items() if 0 < info["placing_rank"] <= COMPETITIVE_CUT_LIMIT}
    winner_deck_ids = {deck_id for deck_id, info in deck_infos.items() if info["placing_rank"] == 1}
    recent_top8_deck_ids = {
        deck_id
        for deck_id, info in deck_infos.items()
        if 0 < info["placing_rank"] <= COMPETITIVE_CUT_LIMIT and recent_cutoff and info["event_date"] and info["event_date"] >= recent_cutoff
    }
    recent_winner_deck_ids = {
        deck_id
        for deck_id, info in deck_infos.items()
        if info["placing_rank"] == 1 and recent_cutoff and info["event_date"] and info["event_date"] >= recent_cutoff
    }

    usage: dict[str, dict[str, object]] = defaultdict(
        lambda: {
            "all_top8_decks": set(),
            "all_winner_decks": set(),
            "recent_top8_decks": set(),
            "recent_winner_decks": set(),
            "all_top8_copies": 0,
            "recent_top8_copies": 0,
            "archetypes": Counter(),
            "colors": Counter(),
        }
    )

    for deck_id, deck_cards in cards_by_deck.items():
        if deck_id not in deck_infos:
            continue
        info = deck_infos[deck_id]
        is_all_top8 = deck_id in top8_deck_ids
        is_recent_top8 = deck_id in recent_top8_deck_ids
        is_winner = deck_id in winner_deck_ids
        is_recent_winner = deck_id in recent_winner_deck_ids
        for row in deck_cards:
            card_number = row["card_number"]
            entry = usage[card_number]
            if is_all_top8:
                entry["all_top8_decks"].add(deck_id)
                entry["all_top8_copies"] += row["quantity"]
                entry["archetypes"][info["archetype"]] += 1
                entry["colors"][info["color_combination"]] += 1
            if is_recent_top8:
                entry["recent_top8_decks"].add(deck_id)
                entry["recent_top8_copies"] += row["quantity"]
            if is_winner:
                entry["all_winner_decks"].add(deck_id)
            if is_recent_winner:
                entry["recent_winner_decks"].add(deck_id)

    rows = []
    for card in canonical_cards:
        if card.card_type not in MAIN_DECK_TYPES:
            continue
        stat = usage.get(card.card_number, {})
        all_top8_using = len(stat.get("all_top8_decks", set()))
        all_winner_using = len(stat.get("all_winner_decks", set()))
        recent_top8_using = len(stat.get("recent_top8_decks", set()))
        recent_winner_using = len(stat.get("recent_winner_decks", set()))
        recent_meta_score = weighted_meta_score(
            recent_top8_using,
            len(recent_top8_deck_ids),
            recent_winner_using,
            len(recent_winner_deck_ids),
        )
        overall_meta_score = weighted_meta_score(
            all_top8_using,
            len(top8_deck_ids),
            all_winner_using,
            len(winner_deck_ids),
        )
        restriction = restrictions_by_card.get(card.card_number)
        copy_limit = int(restriction["max_copies"]) if restriction else 4
        restriction_note = (
            f"{restriction['restriction_type']} ({restriction['max_copies']}) effective {restriction['effective_date']}"
            if restriction
            else ""
        )
        rows.append(
            {
                "card_number": card.card_number,
                "card_name": card.card_name,
                "color": card.color,
                "card_type": card.card_type,
                "level": card.level,
                "cost": card.cost,
                "copy_limit": copy_limit,
                "restriction_note": restriction_note,
                "recent_meta_score": recent_meta_score,
                "overall_meta_score": overall_meta_score,
                "recent_top8_decks_using": recent_top8_using,
                "all_top8_decks_using": all_top8_using,
                "top_archetypes": ", ".join(
                    f"{label} ({count})"
                    for label, count in stat.get("archetypes", Counter()).most_common(5)
                ),
                "top_color_pairs": ", ".join(
                    f"{label} ({count})"
                    for label, count in stat.get("colors", Counter()).most_common(4)
                ),
                "synergy_tags": ", ".join(card.synergy_tags),
                "traits": ", ".join(card.trait_tokens),
                "link_targets": ", ".join(card.link_targets),
                "effect_preview": card.effect_preview,
                "where_to_get_it": card.where_to_get_it,
                "package_codes": ", ".join(card.package_codes),
                "package_labels": ", ".join(card.package_labels),
            }
        )
    rows.sort(
        key=lambda row: (
            -row["recent_meta_score"],
            -row["overall_meta_score"],
            -row["recent_top8_decks_using"],
            row["card_name"],
        )
    )
    return rows


def build_resource_rows(canonical_cards: list[CanonicalCard]) -> list[dict]:
    rows = []
    for card in canonical_cards:
        if card.card_type not in RESOURCE_TYPES:
            continue
        rows.append(
            {
                "card_number": card.card_number,
                "card_name": card.card_name,
                "color": card.color,
                "card_type": card.card_type,
                "traits": ", ".join(card.trait_tokens),
                "effect_preview": card.effect_preview,
                "where_to_get_it": card.where_to_get_it,
                "package_codes": ", ".join(card.package_codes),
                "package_labels": ", ".join(card.package_labels),
            }
        )
    rows.sort(key=lambda row: (row["color"], row["card_name"], row["card_number"]))
    return rows


def build_input_options(
    canonical_cards: list[CanonicalCard],
    archetype_rows: list[dict],
    card_advisor_rows: list[dict],
) -> dict:
    colors = ["Any", "Blue", "Green", "Red", "White", "Purple", "Neutral"]
    card_types = ["Any", "UNIT", "PILOT", "COMMAND", "BASE"]
    tags = sorted(
        {
            tag
            for card in canonical_cards
            if card.card_type in MAIN_DECK_TYPES
            for tag in card.synergy_tags
        }
    )
    traits = Counter()
    for row in card_advisor_rows:
        weight = 1 + float(row["all_top8_decks_using"])
        for token in [normalize_text(token) for token in row["traits"].split(",") if normalize_text(token)]:
            traits[token] += weight
    archetypes = [row["archetype"] for row in archetype_rows[:30]]
    return {
        "colors": colors,
        "card_types": card_types,
        "synergy_tags": ["Any", *tags],
        "archetypes": ["Any", *archetypes],
        "traits": ["Any", *[label for label, _ in traits.most_common(35)]],
    }


def infer_default_colors(color_pair_rows: list[dict]) -> tuple[str, str]:
    if not color_pair_rows:
        return "Blue", "White"
    top_combo = normalize_text(color_pair_rows[0]["color_combination"])
    if "/" in top_combo:
        primary, secondary = [normalize_text(part) for part in top_combo.split("/", 1)]
        return primary or "Blue", secondary or "White"
    return top_combo or "Blue", ""


if __name__ == "__main__":
    main()
