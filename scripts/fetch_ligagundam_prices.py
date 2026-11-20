from __future__ import annotations

import argparse
import csv
import html
import json
import re
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ps_fetch import fetch_text


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUTPUT_CSV_PATH = DATA_DIR / "ligagundam_price_comparison.csv"
LISTINGS_CSV_PATH = DATA_DIR / "ligagundam_listings.csv"
SNAPSHOT_JSON_PATH = DATA_DIR / "ligagundam_prices.json"
SCAN_REPORT_PATH = DATA_DIR / "ligagundam_scan_report.json"
TCGPLAYER_PRICE_PATH = DATA_DIR / "tcgplayer_prices.csv"
CARDS_CSV_PATH = DATA_DIR / "cards.csv"

LIGAGUNDAM_ROOT = "https://www.ligagundam.com.br"
DEFAULT_TERMS = [
    "GD01", "GD02", "GD03", "GD04",
    "ST01", "ST02", "ST03", "ST04", "ST05", "ST06", "ST07", "ST08", "ST09",
    "EXBP",
]

CSV_COLUMNS = [
    "card_number",
    "tcgplayer_market_price_usd",
    "tcgplayer_reference_brl",
    "ligagundam_low_price_brl",
    "ligagundam_avg_price_brl",
    "ligagundam_high_price_brl",
    "ligagundam_store_count",
    "ligagundam_listing_count",
    "ligagundam_best_shop",
    "ligagundam_best_url",
    "ligagundam_markup_pct",
    "comparison_status",
    "price_last_checked_utc",
]

LISTING_COLUMNS = [
    "listing_key",
    "card_number",
    "listing_id",
    "edition_code",
    "title",
    "price_brl",
    "avg_price_brl",
    "high_price_brl",
    "shop",
    "url",
    "status",
    "available",
    "stock",
    "fetched_at_utc",
]


def normalize_text(value: object) -> str:
    text = html.unescape(str(value or "").replace("\xa0", " "))
    if any(marker in text for marker in ("Ã", "â", "ðŸ")):
        try:
            repaired = text.encode("cp1252").decode("utf-8")
            if repaired:
                text = repaired
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    return re.sub(r"\s+", " ", text).strip()


def normalize_number(value: object) -> str:
    text = normalize_text(value).upper()
    match = re.search(r"\b([A-Z0-9]+-\d{3}(?:-[A-Z0-9]+)*)\b", text)
    return match.group(1) if match else ""


def normalize_base_number(value: object) -> str:
    text = normalize_text(value).upper()
    match = re.search(r"\b([A-Z0-9]+-\d{3})\b", text)
    return match.group(1) if match else ""


def parse_price(value: object) -> float | None:
    text = normalize_text(value).replace("R$", "").strip()
    if not text:
        return None
    text = text.replace(".", "").replace(",", ".") if "," in text else text
    try:
        price = float(text)
    except ValueError:
        return None
    return price if price > 0 else None


def read_tcg_reference() -> dict[str, dict[str, float]]:
    rows: dict[str, dict[str, float]] = {}
    if not TCGPLAYER_PRICE_PATH.exists():
        return rows
    with TCGPLAYER_PRICE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            card_number = normalize_number(row.get("card_number"))
            market_usd = parse_price(row.get("market_price_usd"))
            reference_brl = parse_price(row.get("market_price_brl_x5"))
            if not card_number:
                continue
            rows[card_number] = {
                "market_price_usd": market_usd or 0,
                "reference_brl": reference_brl or 0,
            }
    return rows


class SearchBlockedError(RuntimeError):
    pass


def validate_search_page(page_html: str) -> None:
    lower = page_html.lower()
    if any(marker in lower for marker in ("cf-chl-", "/cdn-cgi/challenge-platform/", "just a moment...", "attention required! | cloudflare")):
        raise SearchBlockedError("LigaGundam returned a Cloudflare verification page; cached prices were preserved.")
    if not re.search(r"view=cards(?:/|%2f)search", lower) or "<html" not in lower:
        raise ValueError("Unrecognized LigaGundam search page; refusing to treat it as an empty result.")


def fetch_search(term: str) -> str:
    query = urllib.parse.urlencode({"view": "cards/search", "card": term, "tipo": "1", "orderBy": "7"})
    page = fetch_text(f"{LIGAGUNDAM_ROOT}/?{query}", timeout_seconds=45)
    validate_search_page(page)
    return page


def listing_key(item: dict[str, Any]) -> str:
    return "|".join(
        [
            normalize_number(item.get("listing_id")),
            normalize_text(item.get("edition_code")).upper(),
            normalize_text(item.get("url")),
        ]
    )


def read_browser_snapshot(path: Path) -> tuple[str, list[dict[str, Any]]]:
    """Import visible search results captured through normal browser access."""
    snapshot = json.loads(path.read_text(encoding="utf-8"))
    source = urllib.parse.urlparse(snapshot.get("source_url", ""))
    query = urllib.parse.parse_qs(source.query)
    if source.scheme != "https" or source.hostname not in {"www.ligagundam.com.br", "ligagundam.com.br"} or query.get("view") != ["cards/search"]:
        raise ValueError("Browser snapshot must identify a LigaGundam search URL.")
    observed = datetime.fromisoformat(snapshot["observed_at_utc"].replace("Z", "+00:00"))
    if observed.tzinfo is None or observed > datetime.now(timezone.utc):
        raise ValueError("Browser observation needs a past timestamp with timezone.")
    items = []
    for row in snapshot["listings"]:
        url = urllib.parse.urlparse(row.get("url", ""))
        params = urllib.parse.parse_qs(url.query)
        listing_id = normalize_number(row.get("listing_id"))
        if (url.scheme != "https" or url.hostname not in {"www.ligagundam.com.br", "ligagundam.com.br"}
                or params.get("view") != ["cards/card"] or params.get("num") != [listing_id] or not listing_id):
            raise ValueError("Browser listing identity does not match its LigaGundam URL.")
        low = parse_price(row.get("low"))
        if low is None:
            raise ValueError("Browser snapshots require positive observed prices.")
        items.append({"listing_id": listing_id, "card_number": normalize_base_number(listing_id),
                      "edition_code": normalize_text((params.get("ed") or [""])[0]).upper(),
                      "title": normalize_text(row.get("title")), "url": url.geturl(),
                      "low": low, "avg": parse_price(row.get("avg")), "high": parse_price(row.get("high"))})
    if not items:
        raise ValueError("Browser snapshot has no observed prices.")
    return observed.isoformat(timespec="seconds"), items


def read_default_terms(mode: str = "all") -> list[str]:
    if not CARDS_CSV_PATH.exists():
        return DEFAULT_TERMS
    terms: list[str] = []
    seen: set[str] = set()
    with CARDS_CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            name = normalize_text(row.get("card_name"))
            card_number = normalize_base_number(row.get("card_number"))
            rarity = normalize_text(row.get("rarity")).replace(" ", "")
            variant_name = f"{name} ({rarity})" if name and "+" in rarity else ""
            if not card_number:
                continue
            if mode == "names":
                candidates = (name,)
            elif mode == "variants":
                candidates = (variant_name,)
            elif mode == "all":
                candidates = (name, variant_name)
            elif mode == "both":
                candidates = (card_number, name)
            else:
                candidates = (card_number,)
            for term in candidates:
                term = normalize_text(term)
                key = term.lower()
                if not term or key in seen:
                    continue
                seen.add(key)
                terms.append(term)
    return terms or DEFAULT_TERMS


def parse_search_cards(page_html: str) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    for raw_block in re.split(r'<div class="mtg-single">', page_html)[1:]:
        block = raw_block.split('<div class="mtg-single">', 1)[0]
        href_match = re.search(r'href="([^"]*view=cards/card[^"]+)"', block)
        title_match = re.search(r'<a href="[^"]*view=cards/card[^"]*">([^<]+)</a>', block)
        number_match = re.search(r'<div class="mtg-numeric-code">\(([^)]+)\)</div>', block)
        if not number_match:
            continue
        listing_id = normalize_number(number_match.group(1))
        card_number = normalize_base_number(listing_id)
        if not card_number or not listing_id:
            continue
        price_min = first_price(block, "price-min")
        price_avg = first_price(block, "price-avg")
        price_max = first_price(block, "price-max")
        if price_min is None and price_avg is None and price_max is None:
            continue
        href = html.unescape(href_match.group(1)) if href_match else ""
        url = urllib.parse.urljoin(LIGAGUNDAM_ROOT, href) if href else ""
        query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        edition_code = normalize_text((query.get("ed") or [""])[0]).upper()
        cards.append(
            {
                "card_number": card_number,
                "listing_id": listing_id,
                "edition_code": edition_code,
                "title": normalize_text(title_match.group(1)) if title_match else "",
                "low": price_min,
                "avg": price_avg,
                "high": price_max,
                "url": url,
            }
        )
    return cards


def first_price(block: str, class_name: str) -> float | None:
    match = re.search(rf'<div class="{re.escape(class_name)}">\s*(R\$\s*[\d.,]+)\s*</div>', block)
    return parse_price(match.group(1)) if match else None


def round_or_blank(value: float | None) -> str:
    return "" if value is None else f"{value:.2f}"


def load_existing_rows() -> dict[str, dict[str, Any]]:
    listings: dict[str, dict[str, Any]] = {}
    if LISTINGS_CSV_PATH.exists():
        with LISTINGS_CSV_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                listing_id = normalize_number(row.get("listing_id"))
                card_number = normalize_base_number(row.get("card_number"))
                low = parse_price(row.get("price_brl"))
                if not listing_id or not card_number or low is None:
                    continue
                listings[listing_id] = {
                    "card_number": card_number,
                    "listing_id": listing_id,
                    "edition_code": normalize_text(row.get("edition_code")).upper(),
                    "title": normalize_text(row.get("title")),
                    "low": low,
                    "avg": parse_price(row.get("avg_price_brl")),
                    "high": parse_price(row.get("high_price_brl")),
                    "url": normalize_text(row.get("url")),
                    "fetched_at_utc": normalize_text(row.get("fetched_at_utc")),
                }
                key = normalize_text(row.get("listing_key")) or listing_key(listings[listing_id])
                listings[key] = listings.pop(listing_id)
    return listings


def is_parallel_listing(item: dict[str, Any]) -> bool:
    listing_id = normalize_number(item.get("listing_id"))
    title = normalize_text(item.get("title")).upper()
    return any(token in listing_id for token in ("-LRP", "-LRPP", "-CP", "-CPP", "-RP", "-UP")) or any(
        token in title for token in ("(LR+)", "(LR++)", "(C+)", "(R+)", "(U+)")
    )


def build_lowest_base_listings(listings_by_id: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in listings_by_id.values():
        card_number = normalize_base_number(item.get("card_number"))
        if not card_number or is_parallel_listing(item) or item.get("low") is None:
            continue
        grouped.setdefault(card_number, []).append(item)
    return {
        card_number: min(
            items,
            key=lambda item: (
                float(item["low"]),
                normalize_text(item.get("listing_id")),
            ),
        )
        for card_number, items in grouped.items()
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch public LigaGundam search prices.")
    parser.add_argument("--terms", nargs="*", default=None, help="Search terms to scan. Defaults to local card names.")
    parser.add_argument("--sleep-seconds", type=float, default=0.35)
    parser.add_argument("--offset", type=int, default=0, help="Skip this many default terms.")
    parser.add_argument("--limit", type=int, default=0, help="Process at most this many default terms. 0 means all.")
    parser.add_argument("--workers", type=int, default=1, help="Concurrent public-search requests. Keep at 1; Liga throttles parallel scans.")
    parser.add_argument("--fresh", action="store_true", help="Rebuild the listing cache from this scan.")
    parser.add_argument("--browser-snapshot", type=Path, help="Import source-linked visible search observations from a JSON snapshot without making HTTP requests.")
    parser.add_argument(
        "--term-mode",
        choices=("codes", "names", "variants", "all", "both"),
        default="all",
        help="Default scan keys. 'all' scans card names plus rarity-specific parallel names.",
    )
    args = parser.parse_args()
    if args.workers != 1:
        parser.error("LigaGundam scans must use --workers 1 to respect source throttling.")
    if args.browser_snapshot and (args.fresh or args.terms):
        parser.error("Browser imports merge observations with the cache; omit --fresh and --terms.")

    fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    previous_report = json.loads(SCAN_REPORT_PATH.read_text(encoding="utf-8")) if SCAN_REPORT_PATH.exists() else {}
    existing_listings = load_existing_rows()
    is_full_scan = (
        not args.browser_snapshot
        and
        not args.terms
        and args.offset == 0
        and args.limit == 0
        and args.term_mode in {"all", "both"}
    )
    listings_by_id = {} if args.fresh or is_full_scan else dict(existing_listings)
    errors: list[dict[str, str]] = []
    terms = args.terms if args.terms else read_default_terms(args.term_mode)
    browser_items = None
    observed_at = fetched_at
    if args.browser_snapshot:
        observed_at, browser_items = read_browser_snapshot(args.browser_snapshot)
        terms = ["browser_snapshot"]
    elif not args.terms:
        start = max(args.offset, 0)
        end = start + args.limit if args.limit and args.limit > 0 else None
        terms = terms[start:end]
    completed_terms = 0
    successful_terms = 0
    observed_identities: set[tuple[str, str]] = set()
    checked_numbers: set[str] = set()
    blocked = False
    for term in terms:
        completed_terms += 1
        try:
            parsed_items = browser_items if browser_items is not None else parse_search_cards(fetch_search(term))
        except SearchBlockedError as exc:
            errors.append({"term": term, "error": str(exc)})
            blocked = True
            break
        except Exception as exc:  # noqa: BLE001
            errors.append({"term": term, "error": str(exc)})
            # Stop on network/access errors too; do not hammer an unavailable source.
            break
        successful_terms += 1
        if args.sleep_seconds > 0:
            time.sleep(args.sleep_seconds)
        exact_term = normalize_base_number(term)
        if exact_term and exact_term == normalize_text(term).upper():
            checked_numbers.add(exact_term)
            listings_by_id = {
                key: item for key, item in listings_by_id.items()
                if normalize_base_number(item.get("card_number")) != exact_term
            }
        for item in parsed_items:
            identity = (item["listing_id"], item.get("edition_code", ""))
            observed_identities.add(identity)
            listings_by_id = {key: old for key, old in listings_by_id.items()
                              if (old["listing_id"], old.get("edition_code", "")) != identity}
            item["fetched_at_utc"] = observed_at
            listings_by_id[listing_key(item)] = item
        if completed_terms % 50 == 0 or completed_terms == len(terms):
            print(f"LigaGundam scan: {completed_terms}/{len(terms)} terms, {len(listings_by_id)} listings", flush=True)

    report = {
        "attempted_at_utc": fetched_at,
        "status": "blocked" if blocked else "partial" if errors and successful_terms else "failed" if errors or not terms else "ok",
        "terms_requested": len(terms), "terms_attempted": completed_terms,
        "terms_succeeded": successful_terms, "errors": errors,
        "last_observation_utc": max((item.get("fetched_at_utc", "") for item in existing_listings.values()), default=""),
        "method": "browser_import" if args.browser_snapshot else "http",
        "automatic_status": previous_report.get("automatic_status", previous_report.get("status")) if args.browser_snapshot else ("blocked" if blocked else "failed" if errors else "ok"),
    }
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not successful_terms:
        SCAN_REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    if errors and (args.fresh or is_full_scan):
        for key, item in existing_listings.items():
            if item["card_number"] not in checked_numbers and (item["listing_id"], item.get("edition_code", "")) not in observed_identities:
                listings_by_id.setdefault(key, item)

    if (args.fresh or is_full_scan) and existing_listings and len(listings_by_id) < len(existing_listings) * 0.7:
        for key, item in existing_listings.items():
            if item["card_number"] not in checked_numbers and (item["listing_id"], item.get("edition_code", "")) not in observed_identities:
                listings_by_id.setdefault(key, item)
        errors.append(
            {
                "term": "__coverage_guard__",
                "error": (
                    "Fresh scan returned less than 70% of the previous listing coverage; "
                    "previous rows were retained to prevent destructive cache regression."
                ),
            }
        )

    tcg = read_tcg_reference()
    previous_checks = {}
    if OUTPUT_CSV_PATH.exists():
        with OUTPUT_CSV_PATH.open(encoding="utf-8-sig", newline="") as handle:
            previous_checks = {row["card_number"]: row.get("price_last_checked_utc", "") for row in csv.DictReader(handle)}
    by_card = build_lowest_base_listings(listings_by_id)
    rows = []
    for card_number in sorted(set(by_card) | set(tcg)):
        item = by_card.get(card_number, {})
        reference = tcg.get(card_number, {}).get("reference_brl") or None
        low = item.get("low")
        markup = ((low / reference - 1) * 100) if low is not None and reference else None
        if item and reference:
            status = "ok"
        elif item:
            status = "no_tcgplayer_reference"
        else:
            status = "no_ligagundam_listing"
        rows.append(
            {
                "card_number": card_number,
                "tcgplayer_market_price_usd": round_or_blank(tcg.get(card_number, {}).get("market_price_usd") or None),
                "tcgplayer_reference_brl": round_or_blank(reference),
                "ligagundam_low_price_brl": round_or_blank(low),
                "ligagundam_avg_price_brl": round_or_blank(item.get("avg")),
                "ligagundam_high_price_brl": round_or_blank(item.get("high")),
                "ligagundam_store_count": 1 if low is not None else 0,
                "ligagundam_listing_count": 1 if low is not None else 0,
                "ligagundam_best_shop": "LigaGundam marketplace" if low is not None else "",
                "ligagundam_best_url": item.get("url", ""),
                "ligagundam_markup_pct": round_or_blank(markup),
                "comparison_status": status,
                "price_last_checked_utc": item.get("fetched_at_utc", "") if item else (
                    fetched_at if card_number in checked_numbers or (is_full_scan and not errors) else previous_checks.get(card_number, "")
                ),
            }
        )

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_CSV_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    with LISTINGS_CSV_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=LISTING_COLUMNS)
        writer.writeheader()
        for item in sorted(
            listings_by_id.values(),
            key=lambda row: (row["card_number"], row["listing_id"], row.get("edition_code", ""), row.get("url", "")),
        ):
            writer.writerow(
                {
                    "listing_key": listing_key(item),
                    "card_number": item["card_number"],
                    "listing_id": item["listing_id"],
                    "edition_code": item.get("edition_code", ""),
                    "title": item["title"],
                    "price_brl": round_or_blank(item["low"]),
                    "avg_price_brl": round_or_blank(item.get("avg")),
                    "high_price_brl": round_or_blank(item.get("high")),
                    "shop": "LigaGundam marketplace",
                    "url": item.get("url", ""),
                    "status": "ok",
                    "available": "true",
                    "stock": "1",
                    "fetched_at_utc": item.get("fetched_at_utc", ""),
                }
            )

    SNAPSHOT_JSON_PATH.write_text(
        json.dumps(
            {
                "generated_at_utc": fetched_at,
                "source": "LigaGundam public card search pages",
                "terms": terms,
                "term_count": len(terms),
                "workers": max(1, args.workers),
                "cards_with_ligagundam_price": len(by_card),
                "ligagundam_listing_rows": len(listings_by_id),
                "cards_with_any_listing": len({item["card_number"] for item in listings_by_id.values()}),
                "comparison_rows": len(rows),
                "errors": errors,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"output": str(OUTPUT_CSV_PATH), "listings": str(LISTINGS_CSV_PATH), "cards_with_ligagundam_price": len(by_card), "cards_with_any_listing": len({item["card_number"] for item in listings_by_id.values()}), "listing_rows": len(listings_by_id), "errors": len(errors)}, indent=2))
    report["last_observation_utc"] = max((item.get("fetched_at_utc", "") for item in listings_by_id.values()), default="")
    report["observed_listings"] = len(observed_identities)
    report["retained_listings"] = len(listings_by_id) - len(observed_identities)
    report["oldest_observation_utc"] = min((item.get("fetched_at_utc", "") for item in listings_by_id.values()), default="")
    if (errors and not blocked) or args.browser_snapshot:
        report["status"] = "partial"
    SCAN_REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
