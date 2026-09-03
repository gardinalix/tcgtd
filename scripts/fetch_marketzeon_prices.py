from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ps_fetch import fetch_text as ps_fetch_text


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

MARKETZEON_ROOT = "https://marketzeon.com"
MARKETZEON_HOME = f"{MARKETZEON_ROOT}/"
DEFAULT_USD_BRL_MULTIPLIER = 5.0

TCGPLAYER_PRICE_PATH = DATA_DIR / "tcgplayer_prices.csv"
LISTINGS_CSV_PATH = DATA_DIR / "marketzeon_listings.csv"
COMPARISON_CSV_PATH = DATA_DIR / "marketzeon_price_comparison.csv"
SNAPSHOT_JSON_PATH = DATA_DIR / "marketzeon_prices.json"

LISTING_COLUMNS = [
    "listing_id",
    "card_number",
    "shop",
    "source",
    "title",
    "price_brl",
    "price_final",
    "stock",
    "available",
    "url",
    "status",
    "variant_excluded",
    "fetched_at_utc",
]

COMPARISON_COLUMNS = [
    "card_number",
    "tcgplayer_market_price_usd",
    "tcgplayer_reference_brl",
    "marketzeon_low_price_brl",
    "marketzeon_avg_price_brl",
    "marketzeon_high_price_brl",
    "marketzeon_store_count",
    "marketzeon_listing_count",
    "marketzeon_best_shop",
    "marketzeon_best_url",
    "marketzeon_markup_pct",
    "marketzeon_avg_markup_pct",
    "comparison_status",
    "price_last_checked_utc",
]


def normalize_text(value: object) -> str:
    text = str(value or "").replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def normalize_card_number(value: object) -> str:
    text = normalize_text(value).upper()
    match = re.search(r"\b([A-Z0-9]+-\d{3})\b", text)
    return match.group(1) if match else ""


def parse_price(value: object) -> float | None:
    text = normalize_text(value)
    if not text:
        return None
    text = text.replace("R$", "").strip()
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        number = float(text)
    except ValueError:
        return None
    return number if number >= 0 else None


def fetch_marketzeon_bundle_url() -> str:
    html = ps_fetch_text(MARKETZEON_HOME)
    match = re.search(r"/assets/mockData-[A-Za-z0-9_-]+\.js", html)
    if match:
        return f"{MARKETZEON_ROOT}{match.group(0)}"
    index_match = re.search(r"/assets/index-[A-Za-z0-9_-]+\.js", html)
    if not index_match:
        raise RuntimeError("Could not locate MarketZeon JavaScript assets.")
    index_js = ps_fetch_text(f"{MARKETZEON_ROOT}{index_match.group(0)}")
    match = re.search(r"mockData-[A-Za-z0-9_-]+\.js", index_js)
    if not match:
        raise RuntimeError("Could not locate MarketZeon mockData bundle.")
    return f"{MARKETZEON_ROOT}/assets/{match.group(0)}"


def has_existing_marketzeon_cache() -> bool:
    return all(path.exists() and path.stat().st_size > 0 for path in (LISTINGS_CSV_PATH, COMPARISON_CSV_PATH, SNAPSHOT_JSON_PATH))


def emit_cached_result(error: Exception) -> None:
    print(
        json.dumps(
            {
                "status": "cached",
                "source": "MarketZeon public listings bundle",
                "note": "MarketZeon no longer exposes its public listings bundle; keeping the last complete local cache.",
                "error": str(error),
                "listings": str(LISTINGS_CSV_PATH),
                "comparison": str(COMPARISON_CSV_PATH),
                "snapshot": str(SNAPSHOT_JSON_PATH),
            },
            ensure_ascii=False,
        )
    )


def quote_js_object_keys(js: str) -> str:
    return re.sub(r"([{,])([A-Za-z_$][A-Za-z0-9_$]*):", r'\1"\2":', js)


def js_array_to_json_array(js_array: str) -> list[dict[str, Any]]:
    payload = quote_js_object_keys(js_array)
    payload = payload.replace("!0", "true").replace("!1", "false")
    payload = re.sub(r"(?<=[:\[,])-?\.(\d+)", r"0.\1", payload)
    return json.loads(payload)


def assigned_js_arrays(bundle: str) -> list[str]:
    arrays: list[str] = []
    assignment = re.compile(r"(?:const\s+|,)([A-Za-z_$][A-Za-z0-9_$]*)=\[")
    for match in assignment.finditer(bundle):
        start = match.end() - 1
        depth = 0
        quote = ""
        escaped = False
        for index in range(start, len(bundle)):
            character = bundle[index]
            if quote:
                if escaped:
                    escaped = False
                elif character == "\\":
                    escaped = True
                elif character == quote:
                    quote = ""
                continue
            if character in {'"', "'", "`"}:
                quote = character
            elif character == "[":
                depth += 1
            elif character == "]":
                depth -= 1
                if depth == 0:
                    arrays.append(bundle[start : index + 1])
                    break
    return arrays


def extract_listing_arrays(bundle: str) -> list[dict[str, Any]]:
    listings: list[dict[str, Any]] = []
    for js_array in assigned_js_arrays(bundle):
        if "shop:" not in js_array or "source:" not in js_array:
            continue
        try:
            listings.extend(js_array_to_json_array(js_array))
        except json.JSONDecodeError:
            continue
    if listings:
        unique: dict[tuple[str, str, str, str], dict[str, Any]] = {}
        for item in listings:
            key = (
                normalize_text(item.get("source")).lower(),
                normalize_text(item.get("id")).upper(),
                normalize_text(item.get("url")),
                normalize_text(item.get("price_final") or item.get("price")),
            )
            unique[key] = item
        return list(unique.values())

    # Fallback for future minified variable changes: collect compact listing objects.
    fallback = []
    for match in re.finditer(r"\{source:.*?warnings:\[\]\}", bundle):
        fallback.extend(js_array_to_json_array(f"[{match.group(0)}]"))
    return fallback


def is_variant_listing(listing_id: str, card_number: str) -> bool:
    normalized_id = normalize_text(listing_id).upper()
    return bool(card_number and normalized_id and normalized_id != card_number)


def normalize_listing(raw: dict[str, Any], fetched_at: str) -> dict[str, Any] | None:
    listing_id = normalize_text(raw.get("id")).upper()
    card_number = normalize_card_number(raw.get("code") or listing_id or raw.get("title"))
    candidate_prices = [
        price
        for price in (parse_price(raw.get("price")), parse_price(raw.get("price_final")))
        if price is not None
    ]
    price = min(candidate_prices) if candidate_prices else None
    if not card_number or price is None:
        return None
    stock = int(parse_price(raw.get("stock_quantity") if raw.get("stock_quantity") is not None else raw.get("stock")) or 0)
    available = bool(raw.get("available", stock > 0))
    return {
        "listing_id": listing_id,
        "card_number": card_number,
        "shop": normalize_text(raw.get("shop")),
        "source": normalize_text(raw.get("source")),
        "title": normalize_text(raw.get("title")),
        "price_brl": price,
        "price_final": normalize_text(raw.get("price_final")) or f"{price:.2f}",
        "stock": stock,
        "available": available,
        "url": normalize_text(raw.get("url")),
        "status": normalize_text(raw.get("status")),
        "variant_excluded": is_variant_listing(listing_id, card_number),
        "fetched_at_utc": fetched_at,
    }


def read_tcgplayer_prices(multiplier: float) -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    if not TCGPLAYER_PRICE_PATH.exists():
        return rows
    with TCGPLAYER_PRICE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            card_number = normalize_text(row.get("card_number")).upper()
            market_usd = parse_price(row.get("market_price_usd"))
            if not card_number or market_usd is None:
                continue
            ref_brl = parse_price(row.get("market_price_brl_x5"))
            rows[card_number] = {
                "market_price_usd": market_usd,
                "reference_brl": ref_brl if ref_brl is not None else round(market_usd * multiplier, 2),
            }
    return rows


def round_or_blank(value: float | None) -> str:
    if value is None:
        return ""
    return f"{value:.2f}"


def build_comparison(listings: list[dict[str, Any]], multiplier: float, fetched_at: str) -> list[dict[str, Any]]:
    tcg_prices = read_tcgplayer_prices(multiplier)
    grouped: dict[str, list[dict[str, Any]]] = {}
    for listing in listings:
        if listing["variant_excluded"] or not listing["available"] or listing["stock"] <= 0:
            continue
        grouped.setdefault(listing["card_number"], []).append(listing)

    rows = []
    for card_number in sorted(set(tcg_prices) | set(grouped)):
        tcg = tcg_prices.get(card_number, {})
        active = grouped.get(card_number, [])
        prices = [float(item["price_brl"]) for item in active]
        reference = tcg.get("reference_brl")
        best = min(
            active,
            key=lambda item: (float(item["price_brl"]), normalize_text(item.get("shop"))),
        ) if active else None
        low = min(prices) if prices else None
        high = max(prices) if prices else None
        avg = (sum(prices) / len(prices)) if prices else None
        markup = ((low / reference - 1) * 100) if low is not None and reference else None
        avg_markup = ((avg / reference - 1) * 100) if avg is not None and reference else None
        if active and reference:
            status = "ok"
        elif active:
            status = "no_tcgplayer_reference"
        else:
            status = "no_marketzeon_listing"
        rows.append(
            {
                "card_number": card_number,
                "tcgplayer_market_price_usd": round_or_blank(tcg.get("market_price_usd")),
                "tcgplayer_reference_brl": round_or_blank(reference),
                "marketzeon_low_price_brl": round_or_blank(low),
                "marketzeon_avg_price_brl": round_or_blank(avg),
                "marketzeon_high_price_brl": round_or_blank(high),
                "marketzeon_store_count": len({item["shop"] for item in active if item["shop"]}),
                "marketzeon_listing_count": len(active),
                "marketzeon_best_shop": best["shop"] if best else "",
                "marketzeon_best_url": best["url"] if best else "",
                "marketzeon_markup_pct": round_or_blank(markup),
                "marketzeon_avg_markup_pct": round_or_blank(avg_markup),
                "comparison_status": status,
                "price_last_checked_utc": fetched_at,
            }
        )
    return rows


def write_csv(path: Path, columns: list[str], rows: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in columns})


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch public MarketZeon BR listings and compare them to TCGPlayer.")
    parser.add_argument("--usd-brl-multiplier", type=float, default=DEFAULT_USD_BRL_MULTIPLIER)
    args = parser.parse_args()

    fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    try:
        bundle_url = fetch_marketzeon_bundle_url()
        bundle = ps_fetch_text(bundle_url)
        raw_listings = extract_listing_arrays(bundle)
        listings = [listing for listing in (normalize_listing(raw, fetched_at) for raw in raw_listings) if listing]
        comparison = build_comparison(listings, args.usd_brl_multiplier, fetched_at)
    except Exception as exc:  # noqa: BLE001
        if has_existing_marketzeon_cache():
            emit_cached_result(exc)
            return
        raise

    write_csv(LISTINGS_CSV_PATH, LISTING_COLUMNS, listings)
    write_csv(COMPARISON_CSV_PATH, COMPARISON_COLUMNS, comparison)
    active_exact = [
        row
        for row in listings
        if not row["variant_excluded"] and row["available"] and int(row["stock"] or 0) > 0
    ]
    ok_rows = [row for row in comparison if row["comparison_status"] == "ok"]
    SNAPSHOT_JSON_PATH.write_text(
        json.dumps(
            {
                "generated_at_utc": fetched_at,
                "source": "MarketZeon public listings bundle",
                "source_url": bundle_url,
                "robots_txt": f"{MARKETZEON_ROOT}/robots.txt",
                "usd_brl_multiplier": args.usd_brl_multiplier,
                "raw_listings": len(raw_listings),
                "normalized_listings": len(listings),
                "active_exact_listings": len(active_exact),
                "comparison_rows": len(comparison),
                "comparable_cards": len(ok_rows),
                "average_low_markup_pct": round(
                    sum(float(row["marketzeon_markup_pct"]) for row in ok_rows if row["marketzeon_markup_pct"])
                    / max(1, sum(1 for row in ok_rows if row["marketzeon_markup_pct"])),
                    2,
                ),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "status": "ok",
                "source_url": bundle_url,
                "listings": len(listings),
                "active_exact_listings": len(active_exact),
                "comparison_rows": len(comparison),
                "comparable_cards": len(ok_rows),
                "output": str(COMPARISON_CSV_PATH),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"status": "failed", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise
