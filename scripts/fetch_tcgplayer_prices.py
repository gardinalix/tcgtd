from __future__ import annotations

import argparse
import csv
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

CARDS_PATH = DATA_DIR / "cards.csv"
PRODUCT_MAP_PATH = DATA_DIR / "tcgplayer_product_map.csv"
PRICE_CACHE_CSV_PATH = DATA_DIR / "tcgplayer_prices.csv"
PRICE_CACHE_JSON_PATH = DATA_DIR / "tcgplayer_prices.json"

DEFAULT_API_BASE = "https://api.tcgplayer.com"
DEFAULT_USD_BRL_MULTIPLIER = 5.0

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


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch and cache TCGplayer market prices for mapped Gundam Card Game products."
    )
    parser.add_argument("--api-config", type=Path, help="Optional JSON file with publicKey/privateKey/accessToken.")
    parser.add_argument("--usd-brl-multiplier", type=float, default=DEFAULT_USD_BRL_MULTIPLIER)
    parser.add_argument("--chunk-size", type=int, default=100)
    parser.add_argument("--sleep-seconds", type=float, default=0.2)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cards = read_unique_cards()
    product_map, map_created_or_updated = load_or_initialize_product_map(cards)
    previous_prices = {
        row["card_number"]: row
        for row in read_csv_if_exists(PRICE_CACHE_CSV_PATH)
        if row.get("card_number")
    }

    mappings_with_ids = [
        row for row in product_map.values() if normalize_product_id(row.get("tcgplayer_product_id"))
    ]
    credentials = load_credentials(args.api_config)
    fetched_prices: dict[str, dict[str, Any]] = {}
    fetch_errors: dict[str, str] = {}
    checked_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    price_source = "TCGplayer API product market prices"

    if mappings_with_ids and credentials:
        bearer_token = request_bearer_token(credentials)
        product_ids = sorted(
            {normalize_product_id(row.get("tcgplayer_product_id")) for row in mappings_with_ids}
        )
        for chunk in chunked(product_ids, max(1, args.chunk_size)):
            chunk_prices, chunk_errors = fetch_product_prices(chunk, bearer_token, credentials.api_base)
            fetched_prices.update(chunk_prices)
            fetch_errors.update(chunk_errors)
            if args.sleep_seconds > 0:
                time.sleep(args.sleep_seconds)

    price_rows: list[dict[str, Any]] = []
    status_counts: dict[str, int] = {}
    for card_number, card in cards.items():
        mapping = product_map.get(card_number, {})
        previous = previous_prices.get(card_number, {})
        product_id = normalize_product_id(mapping.get("tcgplayer_product_id"))
        tcgplayer_url = str(mapping.get("tcgplayer_url") or "").strip()
        if product_id and not tcgplayer_url:
            tcgplayer_url = f"https://www.tcgplayer.com/product/{product_id}"

        if not product_id:
            row = build_price_row(
                card,
                mapping,
                previous,
                product_id="",
                tcgplayer_url=tcgplayer_url,
                status="needs_mapping",
                checked_at="",
                price_source=price_source,
                error="Add the TCGplayer product ID to data/tcgplayer_product_map.csv.",
                multiplier=args.usd_brl_multiplier,
            )
        elif not credentials:
            status = "stale_missing_credentials" if previous.get("market_price_usd") else "missing_credentials"
            row = build_price_row(
                card,
                mapping,
                previous,
                product_id=product_id,
                tcgplayer_url=tcgplayer_url,
                status=status,
                checked_at=previous.get("price_last_checked_utc") or "",
                price_source=price_source,
                error="Set TCGPLAYER_PUBLIC_KEY and TCGPLAYER_PRIVATE_KEY, or pass --api-config.",
                multiplier=args.usd_brl_multiplier,
            )
        else:
            fetched = fetched_prices.get(product_id)
            if fetched:
                market_price = normalize_price(fetched.get("marketPrice"))
                status = "ok" if market_price else "no_market_price"
                row = {
                    "card_number": card_number,
                    "card_name": card["card_name"],
                    "tcgplayer_product_id": product_id,
                    "tcgplayer_url": tcgplayer_url,
                    "market_price_usd": market_price,
                    "market_price_brl_x5": multiply_price(market_price, args.usd_brl_multiplier),
                    "low_price_usd": normalize_price(fetched.get("lowPrice")),
                    "mid_price_usd": normalize_price(fetched.get("midPrice")),
                    "high_price_usd": normalize_price(fetched.get("highPrice")),
                    "direct_low_price_usd": normalize_price(fetched.get("directLowPrice")),
                    "price_last_checked_utc": checked_at,
                    "price_status": status,
                    "price_source": price_source,
                    "price_error": "" if status == "ok" else "TCGplayer returned no marketPrice for this product.",
                }
            else:
                row = build_price_row(
                    card,
                    mapping,
                    previous,
                    product_id=product_id,
                    tcgplayer_url=tcgplayer_url,
                    status="not_found",
                    checked_at=checked_at,
                    price_source=price_source,
                    error=fetch_errors.get(product_id, "No product market price returned by TCGplayer."),
                    multiplier=args.usd_brl_multiplier,
                )

        status_counts[row["price_status"]] = status_counts.get(row["price_status"], 0) + 1
        price_rows.append(row)

    if not args.dry_run:
        write_csv(PRODUCT_MAP_PATH, MAP_COLUMNS, product_map.values())
        write_csv(PRICE_CACHE_CSV_PATH, PRICE_COLUMNS, price_rows)
        PRICE_CACHE_JSON_PATH.write_text(
            json.dumps(
                {
                    "generated_at_utc": checked_at,
                    "usd_brl_multiplier": args.usd_brl_multiplier,
                    "source": price_source,
                    "credentials_present": bool(credentials),
                    "mapped_products": len(mappings_with_ids),
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
                "product_map": str(PRODUCT_MAP_PATH),
                "price_cache_csv": str(PRICE_CACHE_CSV_PATH),
                "price_cache_json": str(PRICE_CACHE_JSON_PATH),
                "cards": len(cards),
                "mapped_products": len(mappings_with_ids),
                "credentials_present": bool(credentials),
                "product_map_created_or_updated": map_created_or_updated,
                "status_counts": status_counts,
            },
            ensure_ascii=False,
        )
    )


class Credentials:
    def __init__(self, public_key: str, private_key: str, access_token: str = "", api_base: str = DEFAULT_API_BASE):
        self.public_key = public_key
        self.private_key = private_key
        self.access_token = access_token
        self.api_base = api_base.rstrip("/")

    def __bool__(self) -> bool:
        return bool(self.public_key and self.private_key)


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


def load_or_initialize_product_map(cards: OrderedDict[str, dict[str, str]]) -> tuple[OrderedDict[str, dict[str, str]], bool]:
    existing_rows = read_csv_if_exists(PRODUCT_MAP_PATH)
    existing = {
        str(row.get("card_number") or "").strip(): row
        for row in existing_rows
        if str(row.get("card_number") or "").strip()
    }

    changed = not PRODUCT_MAP_PATH.exists()
    product_map: OrderedDict[str, dict[str, str]] = OrderedDict()
    for card_number, card in cards.items():
        row = dict(existing.get(card_number, {}))
        if not row:
            changed = True
            row = {
                "card_number": card_number,
                "card_name": card["card_name"],
                "tcgplayer_product_id": "",
                "tcgplayer_url": "",
                "tcgplayer_product_name": "",
                "tcgplayer_group_name": "",
                "tcgplayer_printing": "",
                "match_status": "needs_mapping",
                "notes": "",
                "last_mapped_utc": "",
            }
        else:
            if row.get("card_name") != card["card_name"]:
                row["card_name"] = card["card_name"]
                changed = True
            row.setdefault("match_status", "mapped" if row.get("tcgplayer_product_id") else "needs_mapping")
            for column in MAP_COLUMNS:
                row.setdefault(column, "")
        product_map[card_number] = {column: str(row.get(column) or "") for column in MAP_COLUMNS}

    return product_map, changed


def load_credentials(config_path: Path | None) -> Credentials | None:
    config: dict[str, Any] = {}
    if config_path and config_path.exists():
        config = json.loads(config_path.read_text(encoding="utf-8"))

    public_key = str(config.get("publicKey") or os.environ.get("TCGPLAYER_PUBLIC_KEY") or "").strip()
    private_key = str(config.get("privateKey") or os.environ.get("TCGPLAYER_PRIVATE_KEY") or "").strip()
    access_token = str(config.get("accessToken") or os.environ.get("TCGPLAYER_ACCESS_TOKEN") or "").strip()
    api_base = str(config.get("apiBase") or os.environ.get("TCGPLAYER_API_BASE") or DEFAULT_API_BASE).strip()
    credentials = Credentials(public_key, private_key, access_token, api_base)
    return credentials if credentials else None


def request_bearer_token(credentials: Credentials) -> str:
    payload = {
        "grant_type": "client_credentials",
        "client_id": credentials.public_key,
        "client_secret": credentials.private_key,
    }
    data = urllib.parse.urlencode(payload).encode("utf-8")
    headers = {"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"}
    if credentials.access_token:
        headers["X-Tcg-Access-Token"] = credentials.access_token
    request = urllib.request.Request(f"{credentials.api_base}/token", data=data, headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=45) as response:
        token_payload = json.loads(response.read().decode("utf-8"))
    token = token_payload.get("access_token")
    if not token:
        raise RuntimeError("TCGplayer token response did not include access_token.")
    return str(token)


def fetch_product_prices(product_ids: list[str], bearer_token: str, api_base: str) -> tuple[dict[str, dict[str, Any]], dict[str, str]]:
    ids = ",".join(product_ids)
    endpoints = [
        f"{api_base}/pricing/product/{ids}",
        f"{api_base}/v1.39.0/pricing/product/{ids}",
    ]
    last_error = ""
    for endpoint in endpoints:
        request = urllib.request.Request(
            endpoint,
            headers={"Accept": "application/json", "Authorization": f"bearer {bearer_token}"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.loads(response.read().decode("utf-8"))
            results = payload.get("results") or payload.get("Results") or []
            errors = payload.get("errors") or payload.get("Errors") or []
            prices = {
                str(item.get("productId") or item.get("ProductId") or "").strip(): item
                for item in results
                if str(item.get("productId") or item.get("ProductId") or "").strip()
            }
            error_text = "; ".join(str(error) for error in errors)
            missing = {product_id: error_text or "No product market price returned." for product_id in product_ids if product_id not in prices}
            return prices, missing
        except urllib.error.HTTPError as exc:
            last_error = f"HTTP {exc.code}: {exc.reason}"
            if exc.code not in {404, 405}:
                break
        except urllib.error.URLError as exc:
            last_error = str(exc.reason)
            break
    return {}, {product_id: last_error or "TCGplayer pricing request failed." for product_id in product_ids}


def build_price_row(
    card: dict[str, str],
    mapping: dict[str, str],
    previous: dict[str, str],
    *,
    product_id: str,
    tcgplayer_url: str,
    status: str,
    checked_at: str,
    price_source: str,
    error: str,
    multiplier: float,
) -> dict[str, Any]:
    market_price = normalize_price(previous.get("market_price_usd")) if previous else ""
    return {
        "card_number": card["card_number"],
        "card_name": card["card_name"],
        "tcgplayer_product_id": product_id,
        "tcgplayer_url": tcgplayer_url or str(mapping.get("tcgplayer_url") or ""),
        "market_price_usd": market_price,
        "market_price_brl_x5": multiply_price(market_price, multiplier),
        "low_price_usd": normalize_price(previous.get("low_price_usd")) if previous else "",
        "mid_price_usd": normalize_price(previous.get("mid_price_usd")) if previous else "",
        "high_price_usd": normalize_price(previous.get("high_price_usd")) if previous else "",
        "direct_low_price_usd": normalize_price(previous.get("direct_low_price_usd")) if previous else "",
        "price_last_checked_utc": checked_at,
        "price_status": status,
        "price_source": price_source,
        "price_error": error,
    }


def normalize_product_id(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if text.endswith(".0"):
        text = text[:-2]
    return text if text.isdigit() else ""


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


def chunked(values: list[str], size: int) -> list[list[str]]:
    return [values[index : index + size] for index in range(0, len(values), size)]


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
