from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.error
import urllib.request
from collections import OrderedDict, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ps_fetch import fetch_text as ps_fetch_text


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

CARDS_PATH = DATA_DIR / "cards.csv"
PRODUCT_MAP_PATH = DATA_DIR / "tcgplayer_product_map.csv"
PRICE_CACHE_CSV_PATH = DATA_DIR / "tcgplayer_prices.csv"
PRICE_CACHE_JSON_PATH = DATA_DIR / "tcgplayer_prices.json"
PRINTING_PRICE_CACHE_PATH = DATA_DIR / "tcgplayer_printing_prices.csv"
TCGCSV_GROUPS_CACHE_PATH = DATA_DIR / "tcgcsv_gundam_groups.json"
TCGCSV_PRODUCTS_CACHE_PATH = DATA_DIR / "tcgcsv_gundam_products.json"

TCGCSV_ROOT = "https://tcgcsv.com/tcgplayer"
GUNDAM_CATEGORY_ID = 86
DEFAULT_USD_BRL_MULTIPLIER = 5.0
USER_AGENT = "Mozilla/5.0 Codex Gundam Card DB; non-commercial community price cache"

MAP_COLUMNS = [
    "card_number",
    "card_name",
    "tcgplayer_product_id",
    "tcgplayer_url",
    "tcgplayer_product_name",
    "tcgplayer_group_name",
    "tcgplayer_printing",
    "match_status",
    "notes",
    "last_mapped_utc",
]

PRICE_COLUMNS = [
    "card_number",
    "card_name",
    "tcgplayer_product_id",
    "tcgplayer_url",
    "market_price_usd",
    "market_price_brl_x5",
    "low_price_usd",
    "mid_price_usd",
    "high_price_usd",
    "direct_low_price_usd",
    "price_last_checked_utc",
    "price_status",
    "price_source",
    "price_error",
]

PRINTING_PRICE_COLUMNS = [
    "card_number",
    "tcgplayer_product_id",
    "tcgplayer_url",
    "tcgplayer_product_name",
    "tcgplayer_group_id",
    "tcgplayer_group_name",
    "tcgplayer_group_abbreviation",
    "tcgplayer_rarity",
    "tcgplayer_printing",
    "market_price_usd",
    "low_price_usd",
    "mid_price_usd",
    "high_price_usd",
    "direct_low_price_usd",
    "price_status",
    "price_last_checked_utc",
]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch Gundam Card Game pricing from Tcgcsv's cached TCGplayer JSON endpoints."
    )
    parser.add_argument("--category-id", type=int, default=GUNDAM_CATEGORY_ID)
    parser.add_argument("--usd-brl-multiplier", type=float, default=DEFAULT_USD_BRL_MULTIPLIER)
    parser.add_argument("--sleep-seconds", type=float, default=0.15)
    parser.add_argument(
        "--include-sealed-products",
        action="store_true",
        help="Keep sealed products in the raw product cache. Card-price mapping always ignores sealed products.",
    )
    args = parser.parse_args()

    cards = read_unique_cards()
    previous_map = load_existing_product_map()
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    try:
        groups = fetch_groups(args.category_id)
    except Exception as exc:  # noqa: BLE001
        if PRICE_CACHE_CSV_PATH.exists() and PRICE_CACHE_JSON_PATH.exists():
            print(
                json.dumps(
                    {
                        "source": "tcgcsv",
                        "category_id": args.category_id,
                        "status": "cached",
                        "note": "TCGCSV fetch failed; keeping existing price caches unchanged.",
                        "error": str(exc),
                        "price_cache_csv": str(PRICE_CACHE_CSV_PATH),
                        "price_cache_json": str(PRICE_CACHE_JSON_PATH),
                    },
                    ensure_ascii=False,
                )
            )
            return
        raise
    all_products: list[dict[str, Any]] = []
    all_prices: dict[str, dict[str, Any]] = {}

    for group in groups:
        group_id = int(group["groupId"])
        products_payload = fetch_json(f"{TCGCSV_ROOT}/{args.category_id}/{group_id}/products")
        prices_payload = fetch_json(f"{TCGCSV_ROOT}/{args.category_id}/{group_id}/prices")
        products = products_payload.get("results", [])
        prices = prices_payload.get("results", [])
        all_products.extend(products)
        for price in prices:
            product_id = normalize_product_id(price.get("productId"))
            if product_id:
                all_prices[product_id] = price
        if args.sleep_seconds > 0:
            time.sleep(args.sleep_seconds)

    group_by_id = {int(group["groupId"]): group for group in groups}
    products_by_number = index_products_by_card_number(all_products, group_by_id, all_prices)

    product_map_rows: OrderedDict[str, dict[str, str]] = OrderedDict()
    price_rows: list[dict[str, Any]] = []
    printing_price_rows = build_printing_price_rows(all_products, group_by_id, all_prices, generated_at)
    status_counts: dict[str, int] = {}
    selected_products = 0

    for card_number, card in cards.items():
        previous = previous_map.get(card_number, {})
        candidates = products_by_number.get(card_number, [])
        selected = choose_product(card_number, candidates, previous)

        if selected:
            selected_products += 1
            product_id = normalize_product_id(selected.get("productId"))
            group = group_by_id.get(int(selected.get("groupId") or 0), {})
            price = all_prices.get(product_id, {})
            market_price = normalize_price(price.get("marketPrice"))
            status = "ok" if market_price else "no_market_price"
            price_error = "" if market_price else "Tcgcsv product exists, but no marketPrice was available."
            product_map_row = {
                "card_number": card_number,
                "card_name": card["card_name"],
                "tcgplayer_product_id": product_id,
                "tcgplayer_url": str(selected.get("url") or f"https://www.tcgplayer.com/product/{product_id}"),
                "tcgplayer_product_name": str(selected.get("name") or ""),
                "tcgplayer_group_name": str(group.get("name") or ""),
                "tcgplayer_printing": str(price.get("subTypeName") or selected.get("_rarity") or ""),
                "match_status": "auto_tcgcsv",
                "notes": build_selection_note(selected, candidates),
                "last_mapped_utc": generated_at,
            }
            price_row = {
                "card_number": card_number,
                "card_name": card["card_name"],
                "tcgplayer_product_id": product_id,
                "tcgplayer_url": product_map_row["tcgplayer_url"],
                "market_price_usd": market_price,
                "market_price_brl_x5": multiply_price(market_price, args.usd_brl_multiplier),
                "low_price_usd": normalize_price(price.get("lowPrice")),
                "mid_price_usd": normalize_price(price.get("midPrice")),
                "high_price_usd": normalize_price(price.get("highPrice")),
                "direct_low_price_usd": normalize_price(price.get("directLowPrice")),
                "price_last_checked_utc": generated_at,
                "price_status": status,
                "price_source": "Tcgcsv cached TCGplayer prices",
                "price_error": price_error,
            }
        else:
            product_map_row = {
                "card_number": card_number,
                "card_name": card["card_name"],
                "tcgplayer_product_id": "",
                "tcgplayer_url": "",
                "tcgplayer_product_name": "",
                "tcgplayer_group_name": "",
                "tcgplayer_printing": "",
                "match_status": "tcgcsv_not_found",
                "notes": "No Tcgcsv product with matching extendedData.Number was found.",
                "last_mapped_utc": generated_at,
            }
            price_row = {
                "card_number": card_number,
                "card_name": card["card_name"],
                "tcgplayer_product_id": "",
                "tcgplayer_url": "",
                "market_price_usd": "",
                "market_price_brl_x5": "",
                "low_price_usd": "",
                "mid_price_usd": "",
                "high_price_usd": "",
                "direct_low_price_usd": "",
                "price_last_checked_utc": generated_at,
                "price_status": "tcgcsv_not_found",
                "price_source": "Tcgcsv cached TCGplayer prices",
                "price_error": "No Tcgcsv product with matching extendedData.Number was found.",
            }

        product_map_rows[card_number] = product_map_row
        status_counts[price_row["price_status"]] = status_counts.get(price_row["price_status"], 0) + 1
        price_rows.append(price_row)

    write_csv(PRODUCT_MAP_PATH, MAP_COLUMNS, product_map_rows.values())
    write_csv(PRICE_CACHE_CSV_PATH, PRICE_COLUMNS, price_rows)
    write_csv(PRINTING_PRICE_CACHE_PATH, PRINTING_PRICE_COLUMNS, printing_price_rows)
    TCGCSV_GROUPS_CACHE_PATH.write_text(json.dumps(groups, indent=2, ensure_ascii=False), encoding="utf-8")
    raw_products = all_products if args.include_sealed_products else [product for product in all_products if product_number(product)]
    TCGCSV_PRODUCTS_CACHE_PATH.write_text(json.dumps(raw_products, indent=2, ensure_ascii=False), encoding="utf-8")
    PRICE_CACHE_JSON_PATH.write_text(
        json.dumps(
            {
                "generated_at_utc": generated_at,
                "source": "Tcgcsv cached TCGplayer prices",
                "source_root": TCGCSV_ROOT,
                "category_id": args.category_id,
                "usd_brl_multiplier": args.usd_brl_multiplier,
                "groups": len(groups),
                "raw_products": len(all_products),
                "card_products": len(raw_products),
                "price_rows": len(all_prices),
                "official_cards": len(cards),
                "selected_products": selected_products,
                "status_counts": status_counts,
                "rows": price_rows,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "source": "tcgcsv",
                "category_id": args.category_id,
                "groups": len(groups),
                "raw_products": len(all_products),
                "price_rows": len(all_prices),
                "official_cards": len(cards),
                "selected_products": selected_products,
                "status_counts": status_counts,
                "product_map": str(PRODUCT_MAP_PATH),
                "price_cache_csv": str(PRICE_CACHE_CSV_PATH),
                "price_cache_json": str(PRICE_CACHE_JSON_PATH),
                "printing_price_cache": str(PRINTING_PRICE_CACHE_PATH),
            },
            ensure_ascii=False,
        )
    )


def build_printing_price_rows(
    products: list[dict[str, Any]],
    group_by_id: dict[int, dict[str, Any]],
    prices_by_id: dict[str, dict[str, Any]],
    generated_at: str,
) -> list[dict[str, Any]]:
    rows = []
    for product in products:
        card_number = normalize_card_number(product_number(product))
        product_id = normalize_product_id(product.get("productId"))
        if not card_number or not product_id:
            continue
        group_id = int(product.get("groupId") or 0)
        group = group_by_id.get(group_id, {})
        price = prices_by_id.get(product_id, {})
        market_price = normalize_price(price.get("marketPrice"))
        rows.append(
            {
                "card_number": card_number,
                "tcgplayer_product_id": product_id,
                "tcgplayer_url": str(product.get("url") or f"https://www.tcgplayer.com/product/{product_id}"),
                "tcgplayer_product_name": str(product.get("name") or ""),
                "tcgplayer_group_id": group_id,
                "tcgplayer_group_name": str(group.get("name") or ""),
                "tcgplayer_group_abbreviation": str(group.get("abbreviation") or ""),
                "tcgplayer_rarity": product_extended_value(product, "Rarity"),
                "tcgplayer_printing": str(price.get("subTypeName") or ""),
                "market_price_usd": market_price,
                "low_price_usd": normalize_price(price.get("lowPrice")),
                "mid_price_usd": normalize_price(price.get("midPrice")),
                "high_price_usd": normalize_price(price.get("highPrice")),
                "direct_low_price_usd": normalize_price(price.get("directLowPrice")),
                "price_status": "ok" if market_price else "no_market_price",
                "price_last_checked_utc": generated_at,
            }
        )
    return sorted(
        rows,
        key=lambda row: (
            row["card_number"],
            row["tcgplayer_group_name"],
            row["tcgplayer_product_name"],
            int(row["tcgplayer_product_id"]),
        ),
    )


def fetch_groups(category_id: int) -> list[dict[str, Any]]:
    payload = fetch_json(f"{TCGCSV_ROOT}/{category_id}/groups")
    groups = payload.get("results", [])
    return sorted(groups, key=lambda row: str(row.get("publishedOn") or ""), reverse=True)


def fetch_json(url: str) -> dict[str, Any]:
    if sys.platform.startswith("win"):
        try:
            payload_text = ps_fetch_text(url, user_agent=USER_AGENT, timeout_seconds=90)
            payload = json.loads(payload_text or "{}")
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"Tcgcsv request failed for {url}: {exc}") from exc
    else:
        request = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"Tcgcsv request failed for {url}: HTTP {exc.code} {exc.reason}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Tcgcsv request failed for {url}: {exc.reason}") from exc

    if payload.get("success") is False:
        raise RuntimeError(f"Tcgcsv request returned errors for {url}: {payload.get('errors')}")
    return payload


def index_products_by_card_number(
    products: list[dict[str, Any]],
    group_by_id: dict[int, dict[str, Any]],
    prices_by_id: dict[str, dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    by_number: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for product in products:
        number = normalize_card_number(product_number(product))
        if not number:
            continue
        product_id = normalize_product_id(product.get("productId"))
        group = group_by_id.get(int(product.get("groupId") or 0), {})
        price = prices_by_id.get(product_id, {})
        enriched = {
            **product,
            "_number": number,
            "_rarity": product_extended_value(product, "Rarity"),
            "_subtype": str(price.get("subTypeName") or ""),
            "_group_abbreviation": str(group.get("abbreviation") or ""),
            "_group_name": str(group.get("name") or ""),
            "_market_price": price.get("marketPrice"),
        }
        by_number[number].append(enriched)
    return by_number


def choose_product(card_number: str, candidates: list[dict[str, Any]], previous: dict[str, str]) -> dict[str, Any] | None:
    if not candidates:
        return None

    previous_product_id = normalize_product_id(previous.get("tcgplayer_product_id"))
    if previous_product_id:
        for candidate in candidates:
            if normalize_product_id(candidate.get("productId")) == previous_product_id:
                return candidate

    prefix = normalize_prefix(card_number)
    return sorted(candidates, key=lambda product: product_selection_score(product, prefix))[0]


def product_selection_score(product: dict[str, Any], card_prefix: str) -> tuple[int, str, int]:
    name = str(product.get("name") or "")
    lower_name = name.lower()
    rarity = str(product.get("_rarity") or "")
    subtype = str(product.get("_subtype") or "")
    group_abbreviation = normalize_group_abbreviation(str(product.get("_group_abbreviation") or ""))
    product_id = int(normalize_product_id(product.get("productId")) or 0)

    score = 0
    if group_abbreviation and group_abbreviation != card_prefix:
        score += 60
    if group_abbreviation == card_prefix:
        score -= 40
    if subtype.lower() == "normal":
        score -= 25
    if subtype.lower() == "holofoil":
        score += 4
    if re.search(r"\((?:c|u|r|lr|sr|sp)\+{1,2}\)", lower_name):
        score += 90
    if " sp)" in lower_name or "(sp)" in lower_name or " alt" in lower_name:
        score += 90
    if "+" in rarity:
        score += 80
    if "promo" in lower_name:
        score += 25
    if has_market_price(product):
        score -= 3

    return (score, name, product_id)


def build_selection_note(selected: dict[str, Any], candidates: list[dict[str, Any]]) -> str:
    product_id = normalize_product_id(selected.get("productId"))
    note = f"Selected automatically from {len(candidates)} Tcgcsv candidate(s)."
    if len(candidates) > 1:
        note += " Base-print heuristic prefers matching product group, Normal subtype, and non-plus/non-SP listings."
    note += f" Product {product_id}."
    return note


def product_number(product: dict[str, Any]) -> str:
    return product_extended_value(product, "Number")


def product_extended_value(product: dict[str, Any], name: str) -> str:
    for item in product.get("extendedData") or []:
        if str(item.get("name") or "").lower() == name.lower():
            return str(item.get("value") or "").strip()
    return ""


def normalize_prefix(card_number: str) -> str:
    return normalize_group_abbreviation(card_number.split("-", 1)[0])


def normalize_group_abbreviation(value: str) -> str:
    value = value.strip().upper()
    if value.endswith("_B"):
        value = value[:-2]
    if value == "GCG-PR":
        return "PR"
    return value


def normalize_card_number(value: str) -> str:
    return value.strip().upper().replace(" ", "")


def normalize_product_id(value: Any) -> str:
    text = str(value or "").strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text if text.isdigit() else ""


def has_market_price(product: dict[str, Any]) -> bool:
    return normalize_price(product.get("_market_price")) != ""


def normalize_price(value: Any) -> str:
    if value in (None, ""):
        return ""
    try:
        return f"{float(value):.2f}"
    except (TypeError, ValueError):
        return ""


def multiply_price(value: Any, multiplier: float) -> str:
    normalized = normalize_price(value)
    if not normalized:
        return ""
    return f"{float(normalized) * multiplier:.2f}"


def read_unique_cards() -> OrderedDict[str, dict[str, str]]:
    rows = read_csv_if_exists(CARDS_PATH)
    cards: OrderedDict[str, dict[str, str]] = OrderedDict()
    for row in rows:
        card_number = str(row.get("card_number") or "").strip()
        if not card_number or card_number in cards:
            continue
        cards[card_number] = {
            "card_number": card_number,
            "card_name": str(row.get("card_name") or "").strip(),
        }
    return cards


def load_existing_product_map() -> dict[str, dict[str, str]]:
    return {
        str(row.get("card_number") or "").strip(): row
        for row in read_csv_if_exists(PRODUCT_MAP_PATH)
        if str(row.get("card_number") or "").strip()
    }


def read_csv_if_exists(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, fieldnames: list[str], rows: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in fieldnames})


if __name__ == "__main__":
    main()
