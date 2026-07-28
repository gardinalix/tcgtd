from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT_DIR = ROOT / "outputs"

SNAPSHOT_PATH = DATA_DIR / "gundam_gcg_snapshot.json"
ADVISOR_PATH = DATA_DIR / "gundam_deck_advisor_snapshot.json"
LATEST_REPORT_PATH = DATA_DIR / "latest_refresh_report.json"
REFRESH_HISTORY_PATH = DATA_DIR / "refresh_history.jsonl"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a release adoption report for a Gundam Card Game package code.",
    )
    parser.add_argument(
        "--package",
        required=True,
        help="Package code to report on, for example GD04 or ST09.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(OUTPUT_DIR),
        help="Directory for the generated report files.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_history(path: Path) -> list[dict]:
    rows: list[dict] = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def normalize_code(value: str | None) -> str:
    return str(value or "").strip().upper()


def repair_text(value: object) -> str:
    text = str(value or "")
    if not any(marker in text for marker in ("Ã", "â", "Î", "ã", "ï½")):
        return text
    for encoding in ("latin-1", "cp1252"):
        try:
            repaired = text.encode(encoding).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if repaired:
            return repaired
    return text


def safe_int(value: object) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def faq_sort_key(value: str) -> tuple[int, str]:
    text = str(value or "").strip()
    digits = "".join(ch for ch in text if ch.isdigit())
    return (int(digits) if digits else 0, text)


def parse_iso_date(value: str | None) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    for candidate in (text.replace("Z", "+00:00"), text):
        try:
            return datetime.fromisoformat(candidate).date()
        except ValueError:
            continue
    return None


def parse_human_date(value: str | None) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%B %d, %Y", "%B %d,%Y", "%b %d, %Y", "%b %d,%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def collect_package_cards(snapshot: dict, package_code: str) -> tuple[list[dict], list[dict], dict[str, list[str]]]:
    rows = [
        row
        for row in snapshot.get("cards", [])
        if normalize_code(row.get("package_code")) == package_code
    ]
    rows.sort(key=lambda row: (str(row.get("card_number", "")), str(row.get("detail_search_id", ""))))

    first_by_number: dict[str, dict] = {}
    printings_by_number: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        card_number = str(row.get("card_number", ""))
        detail_search_id = str(row.get("detail_search_id", ""))
        if card_number and card_number not in first_by_number:
            first_by_number[card_number] = row
        if card_number and detail_search_id:
            printings_by_number[card_number].append(detail_search_id)

    unique_rows = [first_by_number[key] for key in sorted(first_by_number)]
    return rows, unique_rows, printings_by_number


def collect_package_faqs(snapshot: dict, package_numbers: set[str]) -> list[dict]:
    unique_rows: dict[tuple[str, str], dict] = {}
    for row in snapshot.get("faqs", []):
        card_number = str(row.get("card_number", ""))
        faq_number = str(row.get("faq_number", ""))
        if card_number not in package_numbers:
            continue
        if not (row.get("question") or row.get("answer")):
            continue
        key = (card_number, faq_number)
        if key in unique_rows:
            continue
        unique_rows[key] = {
            "card_number": card_number,
            "card_name": repair_text(row.get("card_name", "")),
            "faq_number": faq_number,
            "faq_updated_date": str(row.get("faq_updated_date", "")),
            "question": repair_text(row.get("question", "")),
            "answer": repair_text(row.get("answer", "")),
            "detail_url": str(row.get("detail_url", "")),
        }

    return sorted(
        unique_rows.values(),
        key=lambda row: (faq_sort_key(row["faq_number"]), row["card_number"]),
    )


def collect_advisor_rows(advisor_snapshot: dict, package_code: str) -> list[dict]:
    package_marker = f"[{package_code}]"
    rows = [
        row
        for row in advisor_snapshot.get("card_advisor_rows", [])
        if package_marker in str(row.get("where_to_get_it", ""))
    ]
    rows.sort(
        key=lambda row: (
            -float(row.get("recent_meta_score", 0) or 0),
            -float(row.get("overall_meta_score", 0) or 0),
            str(row.get("card_number", "")),
        )
    )
    return rows


def find_prior_package_entry(history: list[dict], latest_report: dict, package_code: str) -> dict | None:
    previous_snapshot_generated = str(latest_report.get("previous_snapshot_generated_utc", "")).strip()
    if not previous_snapshot_generated:
        return None

    for row in reversed(history):
        if str(row.get("current_snapshot_generated_utc", "")).strip() != previous_snapshot_generated:
            continue
        for package_row in row.get("changes", {}).get("watched_packages", []):
            if normalize_code(package_row.get("package_code")) == package_code:
                return package_row
    return None


def build_sample_new_printings(
    latest_report: dict,
    package_code: str,
    cards_by_detail_id: dict[str, dict],
) -> list[dict]:
    rows: list[dict] = []
    for detail_search_id in latest_report.get("changes", {}).get("sample_new_card_printings", []):
        if not str(detail_search_id).upper().startswith(f"{package_code}-"):
            continue
        card_row = cards_by_detail_id.get(str(detail_search_id), {})
        rows.append(
            {
                "detail_search_id": str(detail_search_id),
                "card_number": str(card_row.get("card_number", "")),
                "card_name": repair_text(card_row.get("card_name", "")),
                "rarity": str(card_row.get("rarity", "")),
                "type": str(card_row.get("type", "")),
                "color": str(card_row.get("color", "")),
                "detail_url": str(card_row.get("detail_url", "")),
            }
        )
    return rows


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({name: row.get(name, "") for name in fieldnames})


def markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    if not rows:
        return "_None_"
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def main() -> None:
    args = parse_args()
    package_code = normalize_code(args.package)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    snapshot = load_json(SNAPSHOT_PATH)
    advisor_snapshot = load_json(ADVISOR_PATH)
    latest_report = load_json(LATEST_REPORT_PATH)
    history = load_history(REFRESH_HISTORY_PATH)

    all_cards, unique_cards, printings_by_number = collect_package_cards(snapshot, package_code)
    package_numbers = {str(row.get("card_number", "")) for row in unique_cards}
    faqs = collect_package_faqs(snapshot, package_numbers)
    advisor_rows = collect_advisor_rows(advisor_snapshot, package_code)
    cards_by_detail_id = {
        str(row.get("detail_search_id", "")): row
        for row in snapshot.get("cards", [])
        if row.get("detail_search_id")
    }

    current_package_entry = None
    for row in latest_report.get("changes", {}).get("watched_packages", []):
        if normalize_code(row.get("package_code")) == package_code:
            current_package_entry = row
            break
    prior_package_entry = find_prior_package_entry(history, latest_report, package_code)

    delta_printings = None
    if current_package_entry and prior_package_entry:
        delta_printings = safe_int(current_package_entry.get("cards_found")) - safe_int(
            prior_package_entry.get("cards_found")
        )

    unique_color_counts = Counter(str(row.get("color", "")) for row in unique_cards)
    unique_type_counts = Counter(str(row.get("type", "")) for row in unique_cards)
    faq_count_by_card = Counter(row["card_number"] for row in faqs)

    sample_new_printings = build_sample_new_printings(latest_report, package_code, cards_by_detail_id)

    top_watchlist_rows = []
    for row in advisor_rows[:12]:
        top_watchlist_rows.append(
            {
                "card_number": str(row.get("card_number", "")),
                "card_name": repair_text(row.get("card_name", "")),
                "color": str(row.get("color", "")),
                "card_type": str(row.get("card_type", "")),
                "recent_meta_score": float(row.get("recent_meta_score", 0) or 0),
                "overall_meta_score": float(row.get("overall_meta_score", 0) or 0),
                "recent_top8_decks_using": safe_int(row.get("recent_top8_decks_using")),
                "all_top8_decks_using": safe_int(row.get("all_top8_decks_using")),
                "top_archetypes": repair_text(row.get("top_archetypes", "")),
                "where_to_get_it": repair_text(row.get("where_to_get_it", "")),
            }
        )

    current_unique_rows = []
    for row in unique_cards:
        card_number = str(row.get("card_number", ""))
        current_unique_rows.append(
            {
                "card_number": card_number,
                "card_name": repair_text(row.get("card_name", "")),
                "color": str(row.get("color", "")),
                "type": str(row.get("type", "")),
                "level": str(row.get("level", "")),
                "cost": str(row.get("cost", "")),
                "rarity": str(row.get("rarity", "")),
                "source_title": repair_text(row.get("source_title", "")),
                "faq_count": faq_count_by_card.get(card_number, 0),
                "printings_in_package": len(printings_by_number.get(card_number, [])),
                "detail_url": str(row.get("detail_url", "")),
            }
        )

    current_printing_rows = [
        {
            "detail_search_id": str(row.get("detail_search_id", "")),
            "card_number": str(row.get("card_number", "")),
            "variant_code": str(row.get("variant_code", "")),
            "is_parallel_variant": str(row.get("is_parallel_variant", "")),
            "card_name": repair_text(row.get("card_name", "")),
            "color": str(row.get("color", "")),
            "type": str(row.get("type", "")),
            "rarity": str(row.get("rarity", "")),
            "level": str(row.get("level", "")),
            "cost": str(row.get("cost", "")),
            "detail_url": str(row.get("detail_url", "")),
        }
        for row in all_cards
    ]

    latest_event_date = parse_iso_date(advisor_snapshot.get("latest_event_date"))
    release_date = parse_human_date(current_package_entry.get("product_release_date") if current_package_entry else "")
    post_release_results_seen = bool(
        latest_event_date and release_date and latest_event_date >= release_date
    )

    markdown_path = output_dir / f"{package_code.lower()}-adoption-report.md"
    unique_cards_csv_path = output_dir / f"{package_code.lower()}-current-unique-cards.csv"
    printings_csv_path = output_dir / f"{package_code.lower()}-current-printings.csv"
    faqs_csv_path = output_dir / f"{package_code.lower()}-current-faqs.csv"
    sample_csv_path = output_dir / f"{package_code.lower()}-sample-new-printings.csv"
    watchlist_csv_path = output_dir / f"{package_code.lower()}-watchlist-cards.csv"

    write_csv(
        unique_cards_csv_path,
        [
            "card_number",
            "card_name",
            "color",
            "type",
            "level",
            "cost",
            "rarity",
            "source_title",
            "faq_count",
            "printings_in_package",
            "detail_url",
        ],
        current_unique_rows,
    )
    write_csv(
        printings_csv_path,
        [
            "detail_search_id",
            "card_number",
            "variant_code",
            "is_parallel_variant",
            "card_name",
            "color",
            "type",
            "rarity",
            "level",
            "cost",
            "detail_url",
        ],
        current_printing_rows,
    )
    write_csv(
        faqs_csv_path,
        [
            "card_number",
            "card_name",
            "faq_number",
            "faq_updated_date",
            "question",
            "answer",
            "detail_url",
        ],
        faqs,
    )
    write_csv(
        sample_csv_path,
        [
            "detail_search_id",
            "card_number",
            "card_name",
            "rarity",
            "type",
            "color",
            "detail_url",
        ],
        sample_new_printings,
    )
    write_csv(
        watchlist_csv_path,
        [
            "card_number",
            "card_name",
            "color",
            "card_type",
            "recent_meta_score",
            "overall_meta_score",
            "recent_top8_decks_using",
            "all_top8_decks_using",
            "top_archetypes",
            "where_to_get_it",
        ],
        top_watchlist_rows,
    )

    counts_lines = [
        f"- Current official package-linked printings: `{len(all_cards)}`",
        f"- Current unique card numbers in `{package_code}`: `{len(unique_cards)}`",
        f"- Current unique FAQ entries on `{package_code}` cards: `{len(faqs)}`",
    ]
    if current_package_entry:
        counts_lines.append(
            f"- Official release tracked for `{current_package_entry.get('product_name', package_code)}` on `{current_package_entry.get('product_release_date', '')}`"
        )
    if prior_package_entry:
        counts_lines.append(
            f"- Prior pre-release snapshot on `{latest_report.get('previous_snapshot_generated_utc', '')}` tracked `{prior_package_entry.get('cards_found', 0)}` package-linked printings"
        )
    if delta_printings is not None:
        counts_lines.append(
            f"- Net package-linked printing delta from the last stored snapshot: `{delta_printings:+d}`"
        )
    counts_lines.append(
        f"- Overall official database delta on the refresh: `{latest_report.get('changes', {}).get('new_card_printings_count', 0)}` new printings and `{latest_report.get('changes', {}).get('new_faq_entries_count', 0)}` new FAQ entries"
    )

    caveat = (
        "The retained local history preserves the exact package counts and a sample of newly observed printings, "
        "but it does not retain the full April 20 raw card snapshot after refresh. Because of that, the report can "
        "state the exact release delta for the package and list the full current package contents, while the per-printing "
        "release-diff section is limited to the captured sample."
    )

    color_table = markdown_table(
        ["Color", "Unique Cards"],
        [[color or "(None)", str(count)] for color, count in sorted(unique_color_counts.items())],
    )
    type_table = markdown_table(
        ["Type", "Unique Cards"],
        [[card_type or "(None)", str(count)] for card_type, count in sorted(unique_type_counts.items())],
    )
    sample_table = markdown_table(
        ["Printing", "Card", "Rarity", "Type", "Color"],
        [
            [
                row["detail_search_id"],
                f'{row["card_number"]} {row["card_name"]}'.strip(),
                row["rarity"],
                row["type"],
                row["color"],
            ]
            for row in sample_new_printings[:20]
        ],
    )
    faq_table = markdown_table(
        ["FAQ", "Card", "Updated"],
        [
            [
                row["faq_number"],
                f'{row["card_number"]} {row["card_name"]}'.strip(),
                row["faq_updated_date"],
            ]
            for row in faqs[:20]
        ],
    )
    watchlist_table = markdown_table(
        ["Card", "Recent Meta", "Overall Meta", "Recent Top 8", "Top Archetypes"],
        [
            [
                f'{row["card_number"]} {row["card_name"]}'.strip(),
                f'{row["recent_meta_score"]:.1f}',
                f'{row["overall_meta_score"]:.1f}',
                str(row["recent_top8_decks_using"]),
                row["top_archetypes"] or "(none yet)",
            ]
            for row in top_watchlist_rows[:10]
        ],
    )

    watchlist_intro = [
        f"- Latest imported public event date: `{advisor_snapshot.get('latest_event_date', '')}`",
        f"- Post-release winner data present: `{'yes' if post_release_results_seen else 'no'}`",
    ]
    if not post_release_results_seen and release_date:
        watchlist_intro.append(
            f"- The latest imported public result currently predates the official `{package_code}` release date of `{release_date.isoformat()}`. Use the watchlist below as a staging view until the next Egman/Limitless results land."
        )

    markdown = f"""# {package_code} Adoption Report

Generated from the local refresh state on `{latest_report.get('current_snapshot_generated_utc', '')}`.

## Official Release Delta
{chr(10).join(counts_lines)}

{caveat}

## Current Package Mix
### Colors
{color_table}

### Types
{type_table}

## Captured Newly Observed Printings
This sample comes from the change payload retained in `latest_refresh_report.json`.

{sample_table}

Full current package exports:
- `{printings_csv_path.name}` for all current printings
- `{unique_cards_csv_path.name}` for one row per current card number

## Current FAQ Coverage
Current unique FAQ export: `{faqs_csv_path.name}`

{faq_table}

## Event Adoption Watchlist
{chr(10).join(watchlist_intro)}

Watchlist export: `{watchlist_csv_path.name}`

{watchlist_table}
"""

    markdown_path.write_text(markdown, encoding="utf-8-sig")

    print(
        json.dumps(
            {
                "package_code": package_code,
                "markdown_report": str(markdown_path),
                "current_unique_cards_csv": str(unique_cards_csv_path),
                "current_printings_csv": str(printings_csv_path),
                "current_faqs_csv": str(faqs_csv_path),
                "sample_new_printings_csv": str(sample_csv_path),
                "watchlist_csv": str(watchlist_csv_path),
                "current_printings": len(all_cards),
                "current_unique_cards": len(unique_cards),
                "current_unique_faqs": len(faqs),
                "package_delta_printings": delta_printings,
                "post_release_results_seen": post_release_results_seen,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
