from __future__ import annotations

import json
import csv
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
WEB_DIR = ROOT / "web"
CARD_IMAGE_DIR = WEB_DIR / "assets" / "card-images"

ADVISOR_PATH = DATA_DIR / "gundam_deck_advisor_snapshot.json"
GCG_PATH = DATA_DIR / "gundam_gcg_snapshot.json"
OUTPUT_JS_PATH = WEB_DIR / "app-data.js"
OUTPUT_JSON_PATH = WEB_DIR / "app-data.json"
PRICE_PATH = DATA_DIR / "tcgplayer_prices.csv"
TCGPLAYER_PRINTING_PRICE_PATH = DATA_DIR / "tcgplayer_printing_prices.csv"
FX_RATE_PATH = DATA_DIR / "fx_rates.json"
MARKETZEON_PRICE_PATH = DATA_DIR / "marketzeon_price_comparison.csv"
MARKETZEON_LISTINGS_PATH = DATA_DIR / "marketzeon_listings.csv"
LIGAGUNDAM_PRICE_PATH = DATA_DIR / "ligagundam_price_comparison.csv"
LIGAGUNDAM_LISTINGS_PATH = DATA_DIR / "ligagundam_listings.csv"
DATABASE_PATH = DATA_DIR / "gundam.db"
COMPETITIVE_FRONTEND_PATH = DATA_DIR / "competitive" / "generated" / "frontend-meta.json"


def parse_image_extension(url: str) -> str:
    parsed = urlparse(url)
    suffix = Path(parsed.path).suffix.lower()
    return suffix if suffix else ".webp"


def resolve_web_image_url(image_key: str, remote_url: str) -> str:
    normalized_remote = normalize_text(remote_url)
    if not normalized_remote:
        return ""
    local_file = CARD_IMAGE_DIR / f"{image_key}{parse_image_extension(normalized_remote)}"
    if local_file.exists():
        return f"./assets/card-images/{local_file.name}"
    return normalized_remote


def normalize_text(value: object) -> str:
    text = str(value or "").replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_upper(value: object) -> str:
    return normalize_text(value).upper()


def parse_csvish_list(value: object) -> list[str]:
    text = normalize_text(value)
    if not text:
        return []
    return [item.strip() for item in text.split(",") if item.strip()]


def read_csv_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def parse_count_list(value: object) -> list[dict]:
    items = []
    for raw_item in parse_csvish_list(value):
        match = re.match(r"^(.*)\s+\((\d+)\)$", raw_item)
        if match:
            items.append({"label": normalize_text(match.group(1)), "count": int(match.group(2))})
        else:
            items.append({"label": raw_item, "count": 0})
    return items


def load_snapshot(snapshot_key: str, fallback_path: Path) -> dict:
    fallback = (
        json.loads(fallback_path.read_text(encoding="utf-8"))
        if fallback_path.exists()
        else {}
    )
    if DATABASE_PATH.exists():
        try:
            with sqlite3.connect(DATABASE_PATH) as conn:
                row = conn.execute(
                    "SELECT payload_json FROM snapshots WHERE snapshot_key = ?",
                    (snapshot_key,),
                ).fetchone()
            if row:
                database = json.loads(row[0])
                fallback_timestamp = normalize_text(fallback.get("snapshot_generated_utc"))
                database_timestamp = normalize_text(database.get("snapshot_generated_utc"))
                return fallback if fallback_timestamp >= database_timestamp else database
        except (sqlite3.Error, json.JSONDecodeError):
            pass

    return fallback


def load_price_map() -> dict[str, dict]:
    if DATABASE_PATH.exists():
        try:
            rows: dict[str, dict] = {}
            with sqlite3.connect(DATABASE_PATH) as conn:
                for card_number, raw_json in conn.execute("SELECT card_number, raw_json FROM prices"):
                    normalized_number = normalize_upper(card_number)
                    if not normalized_number:
                        continue
                    rows[normalized_number] = json.loads(raw_json)
            if rows:
                return rows
        except (sqlite3.Error, json.JSONDecodeError):
            pass

    if not PRICE_PATH.exists():
        return {}

    rows: dict[str, dict] = {}
    with PRICE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            card_number = normalize_upper(row.get("card_number"))
            if not card_number:
                continue
            rows[card_number] = row
    return rows


def load_tcgplayer_printing_price_groups() -> dict[str, list[dict]]:
    if not TCGPLAYER_PRINTING_PRICE_PATH.exists():
        return {}
    rows: dict[str, list[dict]] = {}
    with TCGPLAYER_PRINTING_PRICE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            card_number = normalize_upper(row.get("card_number"))
            if not card_number:
                continue
            rows.setdefault(card_number, []).append(row)
    return rows


def load_fx_rate() -> dict:
    if not FX_RATE_PATH.exists():
        return {}
    try:
        payload = json.loads(FX_RATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    rate = float_or_none(payload.get("usd_brl_rate"))
    if rate is None:
        return {}
    return {
        "usd_brl_rate": rate,
        "source": normalize_text(payload.get("source")),
        "fetched_at_utc": normalize_text(payload.get("fetched_at_utc")),
        "as_of": normalize_text(payload.get("as_of")),
    }


def load_marketzeon_price_map() -> dict[str, dict]:
    if DATABASE_PATH.exists():
        try:
            rows: dict[str, dict] = {}
            with sqlite3.connect(DATABASE_PATH) as conn:
                for card_number, raw_json in conn.execute("SELECT card_number, raw_json FROM marketzeon_price_comparison"):
                    normalized_number = normalize_upper(card_number)
                    if not normalized_number:
                        continue
                    rows[normalized_number] = json.loads(raw_json)
            if rows:
                return rows
        except (sqlite3.Error, json.JSONDecodeError):
            pass

    if not MARKETZEON_PRICE_PATH.exists():
        return {}

    rows: dict[str, dict] = {}
    with MARKETZEON_PRICE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            card_number = normalize_upper(row.get("card_number"))
            if not card_number:
                continue
            rows[card_number] = row
    return rows


def load_ligagundam_price_map() -> dict[str, dict]:
    if DATABASE_PATH.exists():
        try:
            rows: dict[str, dict] = {}
            with sqlite3.connect(DATABASE_PATH) as conn:
                for card_number, raw_json in conn.execute("SELECT card_number, raw_json FROM ligagundam_price_comparison"):
                    normalized_number = normalize_upper(card_number)
                    if not normalized_number:
                        continue
                    rows[normalized_number] = json.loads(raw_json)
            if rows:
                return rows
        except (sqlite3.Error, json.JSONDecodeError):
            pass

    if not LIGAGUNDAM_PRICE_PATH.exists():
        return {}

    rows: dict[str, dict] = {}
    with LIGAGUNDAM_PRICE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            card_number = normalize_upper(row.get("card_number"))
            if not card_number:
                continue
            rows[card_number] = row
    return rows


def load_marketzeon_listing_groups() -> dict[str, list[dict]]:
    rows: dict[str, list[dict]] = {}
    if DATABASE_PATH.exists():
        try:
            with sqlite3.connect(DATABASE_PATH) as conn:
                for card_number, raw_json in conn.execute("SELECT card_number, raw_json FROM marketzeon_listings"):
                    normalized_number = normalize_upper(card_number)
                    if not normalized_number:
                        continue
                    item = json.loads(raw_json)
                    if listing_is_available(item):
                        rows.setdefault(normalized_number, []).append(item)
            if rows:
                return sort_listing_groups(rows)
        except (sqlite3.Error, json.JSONDecodeError):
            pass

    if not MARKETZEON_LISTINGS_PATH.exists():
        return {}

    with MARKETZEON_LISTINGS_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            card_number = normalize_upper(row.get("card_number"))
            if not card_number or not listing_is_available(row):
                continue
            rows.setdefault(card_number, []).append(row)
    return sort_listing_groups(rows)


def load_ligagundam_listing_groups() -> dict[str, list[dict]]:
    rows: dict[str, list[dict]] = {}
    if DATABASE_PATH.exists():
        try:
            with sqlite3.connect(DATABASE_PATH) as conn:
                for card_number, raw_json in conn.execute("SELECT card_number, raw_json FROM ligagundam_listings"):
                    normalized_number = normalize_upper(card_number)
                    if not normalized_number:
                        continue
                    item = json.loads(raw_json)
                    if listing_is_available(item):
                        rows.setdefault(normalized_number, []).append(item)
            if rows:
                return sort_listing_groups(rows)
        except (sqlite3.Error, json.JSONDecodeError):
            pass

    if not LIGAGUNDAM_LISTINGS_PATH.exists():
        return {}

    with LIGAGUNDAM_LISTINGS_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            card_number = normalize_upper(row.get("card_number"))
            if not card_number or not listing_is_available(row):
                continue
            rows.setdefault(card_number, []).append(row)
    return sort_listing_groups(rows)


def sort_listing_groups(rows: dict[str, list[dict]]) -> dict[str, list[dict]]:
    return {
        card_number: sorted(listings, key=lambda item: (float_or_none(item.get("price_brl")) or 999999, normalize_text(item.get("shop"))))
        for card_number, listings in rows.items()
    }


def lowest_price_listing(listings: list[dict]) -> dict | None:
    priced = [item for item in listings if float_or_none(item.get("price_brl")) is not None]
    if not priced:
        return None
    return min(
        priced,
        key=lambda item: (
            float_or_none(item.get("price_brl")) or 999999,
            normalize_text(item.get("shop")),
            normalize_text(item.get("listing_id")),
        ),
    )


def listing_is_available(row: dict) -> bool:
    status = normalize_text(row.get("status")).lower()
    available = normalize_text(row.get("available")).lower()
    stock = float_or_none(row.get("stock")) or 0
    return status in {"", "ok"} and available not in {"false", "0", "no"} and stock > 0


def float_or_none(value: object) -> float | None:
    text = normalize_text(value)
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def apply_price_fields(card: dict, price_map: dict[str, dict], fx_rate: dict, card_number: str) -> None:
    price = price_map.get(card_number, {})
    market_usd = float_or_none(price.get("market_price_usd"))
    usd_brl_rate = float_or_none(fx_rate.get("usd_brl_rate"))
    card["tcgplayerProductId"] = normalize_text(price.get("tcgplayer_product_id"))
    card["tcgplayerUrl"] = normalize_text(price.get("tcgplayer_url"))
    card["marketPriceUsd"] = market_usd
    card["marketPriceBrlX5"] = float_or_none(price.get("market_price_brl_x5"))
    card["marketPriceBrlFx"] = round(market_usd * usd_brl_rate, 2) if market_usd is not None and usd_brl_rate is not None else None
    card["usdBrlRate"] = usd_brl_rate
    card["usdBrlRateSource"] = normalize_text(fx_rate.get("source"))
    card["usdBrlRateCheckedUtc"] = normalize_text(fx_rate.get("fetched_at_utc"))
    card["lowPriceUsd"] = float_or_none(price.get("low_price_usd"))
    card["midPriceUsd"] = float_or_none(price.get("mid_price_usd"))
    card["highPriceUsd"] = float_or_none(price.get("high_price_usd"))
    card["priceLastCheckedUtc"] = normalize_text(price.get("price_last_checked_utc"))
    card["priceStatus"] = normalize_text(price.get("price_status")) or ("not_found" if price_map else "not_loaded")


def apply_tcgplayer_printing_price_fields(printing: dict, price: dict | None, fx_rate: dict) -> None:
    if not price:
        printing["priceStatus"] = "variant_not_mapped"
        return
    market_usd = float_or_none(price.get("market_price_usd"))
    usd_brl_rate = float_or_none(fx_rate.get("usd_brl_rate"))
    printing["tcgplayerProductId"] = normalize_text(price.get("tcgplayer_product_id"))
    printing["tcgplayerUrl"] = normalize_text(price.get("tcgplayer_url"))
    printing["marketPriceUsd"] = market_usd
    printing["marketPriceBrlFx"] = round(market_usd * usd_brl_rate, 2) if market_usd is not None and usd_brl_rate is not None else None
    printing["lowPriceUsd"] = float_or_none(price.get("low_price_usd"))
    printing["midPriceUsd"] = float_or_none(price.get("mid_price_usd"))
    printing["highPriceUsd"] = float_or_none(price.get("high_price_usd"))
    printing["priceStatus"] = normalize_text(price.get("price_status")) or "no_market_price"
    printing["priceLastCheckedUtc"] = normalize_text(price.get("price_last_checked_utc"))


def pick_tcgplayer_printing_price(card_number: str, printing: dict, groups: dict[str, list[dict]]) -> dict | None:
    candidates = groups.get(card_number, [])
    if not candidates:
        return None

    rarity = normalize_upper(printing.get("rarity")).replace(" ", "")
    package_code = normalize_upper(printing.get("packageCode"))
    source = normalize_upper(printing.get("whereToGetIt"))
    is_plus = "+" in rarity
    event_markers = [
        marker
        for marker in (
            "NEWTYPE CHALLENGE",
            "WORLD CHAMPIONSHIP",
            "CHAMPIONSHIP",
            "STORE TOURNAMENT",
            "LAUNCH EVENT",
            "RELEASE EVENT",
            "PREMIUM CARD COLLECTION",
            "PREMIUM ACCESSORY",
            "PARTICIPATION",
            "PARTICIPANT",
            "WINNER",
        )
        if marker in source
    ]
    if event_markers:
        event_candidates = [
            item
            for item in candidates
            if any(tcgplayer_product_matches_event_marker(item, marker) for marker in event_markers)
        ]
        if not event_candidates:
            return None
        candidates = event_candidates

    def candidate_score(item: dict) -> tuple[int, float, str]:
        name = normalize_upper(item.get("tcgplayer_product_name"))
        group_name = normalize_upper(item.get("tcgplayer_group_name"))
        group_code = normalize_upper(item.get("tcgplayer_group_abbreviation"))
        product_rarity = normalize_upper(item.get("tcgplayer_rarity")).replace(" ", "")
        product_plus = "+" in product_rarity or bool(re.search(r"\([A-Z]{1,3}\+{1,2}\)", name))
        score = 0

        if package_code:
            score += -80 if group_code == package_code else 80
        elif "EDITION BETA" in source:
            score += -90 if "EDITION BETA" in group_name else 90
        elif "NEWTYPE CHALLENGE" in source:
            score += -90 if "NEWTYPE CHALLENGE" in name else 70

        score += -55 if product_plus == is_plus else 120
        if rarity and product_rarity:
            score += -25 if product_rarity == rarity else 12
        if "SP" in source or "STEEL REQUIEM" in source:
            score += -25 if "(SP)" in name else 8
        if "PROMOTION" in source or "PARTICIPANT" in source or "WINNER" in source:
            score += -18 if any(token in name for token in ("PROMO", "PARTICIPANT", "WINNER")) else 8
        if normalize_text(item.get("price_status")) == "ok":
            score -= 3

        market_price = float_or_none(item.get("market_price_usd"))
        return (score, market_price if market_price is not None else 999999, name)

    selected = min(candidates, key=candidate_score)
    return selected if candidate_score(selected)[0] < 100 else None


def tcgplayer_product_matches_event_marker(item: dict, marker: str) -> bool:
    name = normalize_upper(item.get("tcgplayer_product_name"))
    group = normalize_upper(item.get("tcgplayer_group_name"))
    haystack = f"{name} {group}"
    aliases = {
        "NEWTYPE CHALLENGE": ("NEWTYPE CHALLENGE",),
        "WORLD CHAMPIONSHIP": ("WORLD CHAMPIONSHIP", "WCS"),
        "CHAMPIONSHIP": ("CHAMPIONSHIP", "WCS"),
        "STORE TOURNAMENT": ("STORE TOURNAMENT",),
        "LAUNCH EVENT": ("LAUNCH EVENT",),
        "RELEASE EVENT": ("RELEASE EVENT",),
        "PREMIUM CARD COLLECTION": ("PREMIUM CARD COLLECTION",),
        "PREMIUM ACCESSORY": ("PREMIUM ACCESSORY",),
        "PARTICIPATION": ("PARTICIPATION", "PARTICIPANT"),
        "PARTICIPANT": ("PARTICIPANT", "PARTICIPATION"),
        "WINNER": ("WINNER",),
    }
    return any(alias in haystack for alias in aliases.get(marker, (marker,)))


def apply_marketzeon_price_fields(card: dict, marketzeon_price_map: dict[str, dict], card_number: str) -> None:
    price = marketzeon_price_map.get(card_number, {})
    card["marketZeonLowPriceBrl"] = float_or_none(price.get("marketzeon_low_price_brl"))
    card["marketZeonAvgPriceBrl"] = float_or_none(price.get("marketzeon_avg_price_brl"))
    card["marketZeonHighPriceBrl"] = float_or_none(price.get("marketzeon_high_price_brl"))
    card["marketZeonStoreCount"] = int(float_or_none(price.get("marketzeon_store_count")) or 0)
    card["marketZeonListingCount"] = int(float_or_none(price.get("marketzeon_listing_count")) or 0)
    card["marketZeonBestShop"] = normalize_text(price.get("marketzeon_best_shop"))
    card["marketZeonBestUrl"] = normalize_text(price.get("marketzeon_best_url"))
    card["marketZeonMarkupPct"] = float_or_none(price.get("marketzeon_markup_pct"))
    card["marketZeonAvgMarkupPct"] = float_or_none(price.get("marketzeon_avg_markup_pct"))
    card["marketZeonComparisonStatus"] = normalize_text(price.get("comparison_status")) or (
        "not_found" if marketzeon_price_map else "not_loaded"
    )
    card["marketZeonPriceLastCheckedUtc"] = normalize_text(price.get("price_last_checked_utc"))


def apply_ligagundam_price_fields(card: dict, ligagundam_price_map: dict[str, dict], card_number: str) -> None:
    price = ligagundam_price_map.get(card_number, {})
    card["ligaGundamLowPriceBrl"] = float_or_none(price.get("ligagundam_low_price_brl"))
    card["ligaGundamAvgPriceBrl"] = float_or_none(price.get("ligagundam_avg_price_brl"))
    card["ligaGundamHighPriceBrl"] = float_or_none(price.get("ligagundam_high_price_brl"))
    card["ligaGundamStoreCount"] = int(float_or_none(price.get("ligagundam_store_count")) or 0)
    card["ligaGundamListingCount"] = int(float_or_none(price.get("ligagundam_listing_count")) or 0)
    card["ligaGundamBestShop"] = normalize_text(price.get("ligagundam_best_shop"))
    card["ligaGundamBestUrl"] = normalize_text(price.get("ligagundam_best_url"))
    card["ligaGundamMarkupPct"] = float_or_none(price.get("ligagundam_markup_pct"))
    card["ligaGundamComparisonStatus"] = normalize_text(price.get("comparison_status")) or (
        "not_found" if ligagundam_price_map else "not_loaded"
    )
    card["ligaGundamPriceLastCheckedUtc"] = normalize_text(price.get("price_last_checked_utc"))


def apply_marketzeon_listing_fields(printing: dict, listing: dict | None) -> None:
    if not listing:
        printing["marketZeonVariantPriceStatus"] = "not_found"
        return
    printing["marketZeonLowPriceBrl"] = float_or_none(listing.get("price_brl"))
    printing["marketZeonBestShop"] = normalize_text(listing.get("shop"))
    printing["marketZeonBestUrl"] = normalize_text(listing.get("url"))
    printing["marketZeonListingId"] = normalize_upper(listing.get("listing_id"))
    printing["marketZeonStoreCount"] = 1
    printing["marketZeonListingCount"] = 1
    printing["marketZeonVariantPriceStatus"] = "exact_match" if printing["marketZeonListingId"] == normalize_upper(printing.get("cardNumber")) else "variant_match"
    printing["marketZeonPriceLastCheckedUtc"] = normalize_text(listing.get("fetched_at_utc"))


def apply_ligagundam_listing_fields(printing: dict, listing: dict | None) -> None:
    if not listing:
        printing["ligaGundamVariantPriceStatus"] = "not_found"
        return
    printing["ligaGundamLowPriceBrl"] = float_or_none(listing.get("price_brl"))
    printing["ligaGundamAvgPriceBrl"] = float_or_none(listing.get("avg_price_brl"))
    printing["ligaGundamHighPriceBrl"] = float_or_none(listing.get("high_price_brl"))
    printing["ligaGundamBestShop"] = normalize_text(listing.get("shop"))
    printing["ligaGundamBestUrl"] = normalize_text(listing.get("url"))
    printing["ligaGundamListingId"] = normalize_upper(listing.get("listing_id"))
    printing["ligaGundamStoreCount"] = 1
    printing["ligaGundamListingCount"] = 1
    printing["ligaGundamVariantPriceStatus"] = "exact_match" if printing["ligaGundamListingId"] == normalize_upper(printing.get("cardNumber")) else "variant_match"
    printing["ligaGundamPriceLastCheckedUtc"] = normalize_text(listing.get("fetched_at_utc"))


def pick_marketzeon_listing(card_number: str, printing: dict, marketzeon_listing_groups: dict[str, list[dict]]) -> dict | None:
    listings = marketzeon_listing_groups.get(card_number, [])
    if not listings:
        return None

    rarity = normalize_upper(printing.get("rarity")).replace(" ", "")
    is_plus = "+" in rarity
    package_code = normalize_upper(printing.get("packageCode"))
    source = normalize_upper(printing.get("whereToGetIt"))
    if is_plus:
        candidates = [item for item in listings if marketzeon_listing_matches_rarity(item, rarity)]
    else:
        candidates = [item for item in listings if not marketzeon_listing_is_parallel(item)]
    if not candidates:
        return None

    expected_edition = package_code or ("BETA" if "EDITION BETA" in source else "")
    event_markers = [
        marker
        for marker in (
            "NEWTYPE CHALLENGE",
            "CHAMPIONSHIP",
            "PARTICIPATION",
            "PARTICIPANT",
            "WINNER",
            "LAUNCH EVENT",
            "RELEASE EVENT",
            "STORE TOURNAMENT",
            "WORLD CHAMPIONSHIP",
            "PREMIUM CARD COLLECTION",
        )
        if marker in source
    ]
    if event_markers:
        event_candidates = [
            item
            for item in candidates
            if any(price_listing_matches_event_marker(item, marker) for marker in event_markers)
        ]
        if not event_candidates:
            return None
        candidates = event_candidates

    def score(item: dict) -> tuple[int, float, str]:
        listing_id = normalize_upper(item.get("listing_id"))
        title = normalize_upper(item.get("title"))
        edition = marketzeon_listing_edition(item)
        value = 0
        if expected_edition:
            value += -120 if edition == expected_edition else 90
        elif event_markers:
            value += -35 if edition in {"RP", "EXRP"} else 20
        for marker in event_markers:
            value += -70 if marker in title else 24
        if not is_plus and listing_id == card_number:
            value -= 12
        if is_plus and "(SP)" in source:
            value += -30 if "(SP)" in title else 12
        price = float_or_none(item.get("price_brl"))
        return (value, price if price is not None else 999999, listing_id)

    selected = min(candidates, key=score)
    best_score = score(selected)[0]
    if expected_edition and best_score >= 70:
        return None
    if event_markers and best_score >= 55:
        return None
    return selected


def marketzeon_listing_is_parallel(item: dict) -> bool:
    listing_id = normalize_upper(item.get("listing_id"))
    title = normalize_upper(item.get("title"))
    return any(token in listing_id for token in ("-LRP", "-LRPP", "-CP", "-CPP", "-RP", "-UP")) or any(
        token in title for token in ("(LR+)", "(LR++)", "(C+)", "(C++)", "(R+)", "(U+)")
    )


def marketzeon_listing_matches_rarity(item: dict, rarity: str) -> bool:
    return ligagundam_listing_matches_rarity(item, rarity)


def marketzeon_listing_edition(item: dict) -> str:
    url = normalize_text(item.get("url"))
    match = re.search(r"(?:[?&])edicao=(\d+)", url, re.IGNORECASE)
    if match:
        return {
            "1": "BETA",
            "2": "EXBP",
            "3": "EXRP",
            "4": "RP",
            "5": "RP",
            "6": "ST01",
            "7": "ST02",
            "8": "ST03",
            "9": "ST04",
            "10": "GD01",
            "11": "ST05",
            "12": "GD02",
            "13": "ST06",
            "14": "GD03",
            "15": "ST07",
            "16": "ST08",
            "17": "ST09",
            "18": "GD04",
        }.get(match.group(1), "")

    listing_id = normalize_upper(item.get("listing_id"))
    for code in ("GD04", "GD03", "GD02", "GD01", "ST09", "ST08", "ST07", "ST06", "ST05", "ST04", "ST03", "ST02", "ST01"):
        if f"-{code}" in listing_id:
            return code
    return ""


def pick_ligagundam_listing(card_number: str, printing: dict, ligagundam_listing_groups: dict[str, list[dict]]) -> dict | None:
    listings = ligagundam_listing_groups.get(card_number, [])
    if not listings:
        return None

    rarity = normalize_upper(printing.get("rarity")).replace(" ", "")
    is_plus = "+" in rarity
    package_code = normalize_upper(printing.get("packageCode"))
    source = normalize_upper(printing.get("whereToGetIt"))
    if is_plus:
        candidates = [item for item in listings if ligagundam_listing_matches_rarity(item, rarity)]
    else:
        candidates = [item for item in listings if not ligagundam_listing_is_parallel(item)]
    if not candidates:
        return None

    expected_edition = ""
    if package_code:
        expected_edition = package_code
    elif "EDITION BETA" in source:
        expected_edition = "BETA"

    event_markers = [
        marker
        for marker in (
            "NEWTYPE CHALLENGE",
            "CHAMPIONSHIP",
            "PARTICIPATION",
            "PARTICIPANT",
            "WINNER",
            "LAUNCH EVENT",
            "RELEASE EVENT",
            "STORE TOURNAMENT",
            "WORLD CHAMPIONSHIP",
            "PREMIUM CARD COLLECTION",
        )
        if marker in source
    ]
    if event_markers:
        event_candidates = [
            item
            for item in candidates
            if any(price_listing_matches_event_marker(item, marker) for marker in event_markers)
        ]
        if not event_candidates:
            return None
        candidates = event_candidates

    def score(item: dict) -> tuple[int, float, str]:
        listing_id = normalize_upper(item.get("listing_id"))
        title = normalize_upper(item.get("title"))
        edition = ligagundam_listing_edition(item)
        value = 0

        if expected_edition:
            value += -120 if edition == expected_edition else 90
        elif event_markers:
            value += -35 if edition in {"RP", "RPT", "EXRP"} else 20

        for marker in event_markers:
            value += -70 if marker in title else 24

        if not is_plus and listing_id == card_number:
            value -= 12
        if is_plus and "(SP)" in source:
            value += -30 if "(SP)" in title else 12

        price = float_or_none(item.get("price_brl"))
        return (value, price if price is not None else 999999, listing_id)

    selected = min(candidates, key=score)
    best_score = score(selected)[0]
    if expected_edition and best_score >= 70:
        return None
    if event_markers and best_score >= 55:
        return None
    return selected


def ligagundam_listing_is_parallel(item: dict) -> bool:
    listing_id = normalize_upper(item.get("listing_id"))
    title = normalize_upper(item.get("title"))
    return any(token in listing_id for token in ("-LRP", "-CP", "-RP", "-UP")) or any(
        token in title for token in ("(LR+)", "(C+)", "(R+)", "(U+)")
    )


def price_listing_matches_event_marker(item: dict, marker: str) -> bool:
    listing_id = normalize_upper(item.get("listing_id"))
    title = normalize_upper(item.get("title"))
    haystack = f"{listing_id} {title}"
    aliases = {
        "NEWTYPE CHALLENGE": ("NEWTYPE CHALLENGE", "-NC", "NCM"),
        "CHAMPIONSHIP": ("CHAMPIONSHIP", "WCS", "-WC", "CFC"),
        "PARTICIPATION": ("PARTICIPATION", "PARTICIPANT", "-PP", "SPP"),
        "PARTICIPANT": ("PARTICIPANT", "PARTICIPATION", "-PP", "SPP"),
        "WINNER": ("WINNER", "SWP", "-WC"),
        "LAUNCH EVENT": ("LAUNCH EVENT", "-LCH", "LCH"),
        "RELEASE EVENT": ("RELEASE EVENT", "-RE"),
        "STORE TOURNAMENT": ("STORE TOURNAMENT", "SPP", "SWP"),
        "WORLD CHAMPIONSHIP": ("WORLD CHAMPIONSHIP", "WCS", "-WC"),
        "PREMIUM CARD COLLECTION": ("PREMIUM CARD COLLECTION", "PCC"),
    }
    return any(alias in haystack for alias in aliases.get(marker, (marker,)))


def ligagundam_listing_matches_rarity(item: dict, rarity: str) -> bool:
    listing_id = normalize_upper(item.get("listing_id"))
    title = normalize_upper(item.get("title"))
    if "LR++" in rarity:
        return "-LRPP" in listing_id or "(LR++)" in title
    if "LR+" in rarity:
        return ("-LRP" in listing_id or "(LR+)" in title) and "-LRPP" not in listing_id and "(LR++)" not in title
    if "U+" in rarity:
        return "-UP" in listing_id or "(U+)" in title
    if "R+" in rarity:
        return ("-RP" in listing_id or "(R+)" in title) and "-LRP" not in listing_id
    if "C++" in rarity:
        return "-CPP" in listing_id or "(C++)" in title
    if "C+" in rarity:
        return "-CP" in listing_id or "(C+)" in title
    return False


def ligagundam_listing_edition(item: dict) -> str:
    edition = normalize_upper(item.get("edition_code"))
    if edition:
        return edition
    url = normalize_text(item.get("url"))
    match = re.search(r"(?:[?&])ed=([^&]+)", url, re.IGNORECASE)
    return normalize_upper(match.group(1)) if match else ""


def ligagundam_listing_matches_package(item: dict, package_suffixes: list[str]) -> bool:
    listing_id = normalize_upper(item.get("listing_id"))
    title = normalize_upper(item.get("title"))
    url = normalize_upper(item.get("url"))
    return any(
        suffix
        and (
            suffix in listing_id
            or suffix in title
            or f"ED={suffix}" in url
            or f"-{suffix}" in listing_id
        )
        for suffix in package_suffixes
    )


def refine_variant_candidates(card_number: str, printing: dict, candidates: list[dict]) -> list[dict]:
    if not candidates:
        return []

    package_code = normalize_upper(printing.get("packageCode"))
    source = normalize_upper(printing.get("whereToGetIt"))
    if package_code and package_code != "GD01":
        package_matches = [
            item for item in candidates
            if package_code in normalize_upper(item.get("listing_id")) or package_code in normalize_upper(item.get("title"))
        ]
        if package_matches:
            return package_matches

    if package_code == "GD01":
        base_variant_matches = [
            item for item in candidates
            if normalize_upper(item.get("listing_id")) in {f"{card_number}-UP", f"{card_number}-RP", f"{card_number}-CP", f"{card_number}-LRP"}
        ]
        if base_variant_matches:
            return base_variant_matches

    return candidates


def sort_variant_priority(row: dict) -> tuple[int, int, str]:
    is_parallel = normalize_upper(row.get("is_parallel_variant")) == "TRUE"
    variant_code = normalize_text(row.get("variant_code"))
    detail_search_id = normalize_text(row.get("detail_search_id"))
    return (1 if is_parallel else 0, 1 if variant_code else 0, detail_search_id)


def choose_canonical_rows(cards: list[dict]) -> dict[str, dict]:
    grouped: dict[str, list[dict]] = {}
    for row in cards:
        card_number = normalize_upper(row.get("card_number"))
        if not card_number:
            continue
        grouped.setdefault(card_number, []).append(row)
    return {
        card_number: sorted(rows, key=sort_variant_priority)[0]
        for card_number, rows in grouped.items()
    }


def group_printing_rows(cards: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for row in cards:
        card_number = normalize_upper(row.get("card_number"))
        if not card_number:
            continue
        grouped.setdefault(card_number, []).append(row)
    return {
        card_number: sorted(rows, key=lambda item: (sort_variant_priority(item), normalize_text(item.get("detail_search_id"))))
        for card_number, rows in grouped.items()
    }


def build_printings(
    card_number: str,
    rows: list[dict],
    marketzeon_listing_groups: dict[str, list[dict]] | None = None,
    ligagundam_listing_groups: dict[str, list[dict]] | None = None,
    tcgplayer_printing_price_groups: dict[str, list[dict]] | None = None,
    fx_rate: dict | None = None,
) -> list[dict]:
    printings = []
    for row in rows:
        detail_search_id = normalize_text(row.get("detail_search_id")) or card_number
        is_parallel = normalize_upper(row.get("is_parallel_variant")) == "TRUE"
        remote_image_url = normalize_text(row.get("image_url"))
        printing = {
            "detailSearchId": detail_search_id,
            "cardNumber": card_number,
            "variantCode": normalize_text(row.get("variant_code")),
            "isParallelVariant": is_parallel,
            "rarity": normalize_text(row.get("rarity")),
            "whereToGetIt": normalize_text(row.get("where_to_get_it")),
            "packageCode": normalize_upper(row.get("package_code")),
            "packageLabel": normalize_text(row.get("package_label")),
            "imageUrl": resolve_web_image_url(detail_search_id, remote_image_url),
            "remoteImageUrl": remote_image_url,
            "detailUrl": normalize_text(row.get("detail_url")),
        }
        apply_tcgplayer_printing_price_fields(
            printing,
            pick_tcgplayer_printing_price(card_number, printing, tcgplayer_printing_price_groups or {}),
            fx_rate or {},
        )
        apply_marketzeon_listing_fields(printing, pick_marketzeon_listing(card_number, printing, marketzeon_listing_groups or {}))
        apply_ligagundam_listing_fields(printing, pick_ligagundam_listing(card_number, printing, ligagundam_listing_groups or {}))
        printings.append(printing)
    return printings


def build_main_cards(
    advisor_rows: list[dict],
    canonical_rows: dict[str, dict],
    printing_rows: dict[str, list[dict]],
    price_map: dict[str, dict],
    fx_rate: dict,
    marketzeon_price_map: dict[str, dict],
    ligagundam_price_map: dict[str, dict],
    marketzeon_listing_groups: dict[str, list[dict]],
    ligagundam_listing_groups: dict[str, list[dict]],
    tcgplayer_printing_price_groups: dict[str, list[dict]],
) -> list[dict]:
    cards = []
    for row in advisor_rows:
        card_number = normalize_upper(row.get("card_number"))
        canonical = canonical_rows.get(card_number, {})
        color = normalize_text(row.get("color")) or normalize_text(canonical.get("color"))
        if not color or color == "-":
            color = "Neutral"
        printings = build_printings(
            card_number,
            printing_rows.get(card_number, []),
            marketzeon_listing_groups,
            ligagundam_listing_groups,
            tcgplayer_printing_price_groups,
            fx_rate,
        )
        card = {
            "cardNumber": card_number,
            "cardName": normalize_text(row.get("card_name")),
            "color": color,
            "cardType": normalize_upper(row.get("card_type")),
            "level": normalize_text(row.get("level")) or "-",
            "cost": normalize_text(row.get("cost")) or "-",
            "copyLimit": int(row["copy_limit"]) if str(row.get("copy_limit", "")).strip() else 4,
            "restrictionNote": normalize_text(row.get("restriction_note")),
            "recentMetaScore": float(row.get("recent_meta_score", 0) or 0),
            "overallMetaScore": float(row.get("overall_meta_score", 0) or 0),
            "recentTop8DecksUsing": int(row.get("recent_top8_decks_using", 0) or 0),
            "allTop8DecksUsing": int(row.get("all_top8_decks_using", 0) or 0),
            "topArchetypes": parse_count_list(row.get("top_archetypes")),
            "topColorPairs": parse_count_list(row.get("top_color_pairs")),
            "synergyTags": parse_csvish_list(row.get("synergy_tags")),
            "traits": parse_csvish_list(row.get("traits")),
            "linkTargets": parse_csvish_list(row.get("link_targets")),
            "effectPreview": normalize_text(row.get("effect_preview")) or normalize_text(canonical.get("effect_text")),
            "whereToGetIt": normalize_text(row.get("where_to_get_it")) or normalize_text(canonical.get("where_to_get_it")),
            "packageCodes": parse_csvish_list(row.get("package_codes")),
            "packageLabels": parse_csvish_list(row.get("package_labels")),
            "imageUrl": resolve_web_image_url(normalize_text(canonical.get("detail_search_id")) or card_number, normalize_text(canonical.get("image_url"))),
            "detailUrl": normalize_text(canonical.get("detail_url")),
            "detailSearchId": normalize_text(canonical.get("detail_search_id")),
            "variantCode": normalize_text(canonical.get("variant_code")),
            "isParallelVariant": normalize_upper(canonical.get("is_parallel_variant")) == "TRUE",
            "printings": printings,
            "hasAltArt": any(printing["isParallelVariant"] for printing in printings),
            "alternateArtCount": sum(1 for printing in printings if printing["isParallelVariant"]),
            "rarity": normalize_text(canonical.get("rarity")),
            "ap": normalize_text(canonical.get("ap")) or "-",
            "hp": normalize_text(canonical.get("hp")) or "-",
            "sourceTitle": normalize_text(canonical.get("source_title")),
        }
        apply_price_fields(card, price_map, fx_rate, card_number)
        apply_marketzeon_price_fields(card, marketzeon_price_map, card_number)
        apply_ligagundam_price_fields(card, ligagundam_price_map, card_number)
        card["searchText"] = " ".join(
            [
                card["cardNumber"],
                card["cardName"],
                card["color"],
                card["cardType"],
                " ".join(card["synergyTags"]),
                " ".join(card["traits"]),
                " ".join(card["linkTargets"]),
                card["effectPreview"],
                card["whereToGetIt"],
            ]
        ).lower()
        cards.append(card)
    cards.sort(key=lambda item: (-item["recentMetaScore"], -item["overallMetaScore"], item["cardName"]))
    return cards


def build_resource_cards(
    resource_rows: list[dict],
    canonical_rows: dict[str, dict],
    printing_rows: dict[str, list[dict]],
    price_map: dict[str, dict],
    fx_rate: dict,
    marketzeon_price_map: dict[str, dict],
    ligagundam_price_map: dict[str, dict],
    marketzeon_listing_groups: dict[str, list[dict]],
    ligagundam_listing_groups: dict[str, list[dict]],
    tcgplayer_printing_price_groups: dict[str, list[dict]],
) -> list[dict]:
    resources = []
    for row in resource_rows:
        card_number = normalize_upper(row.get("card_number"))
        canonical = canonical_rows.get(card_number, {})
        color = normalize_text(row.get("color")) or normalize_text(canonical.get("color"))
        if not color or color == "-":
            color = "Neutral"
        printings = build_printings(
            card_number,
            printing_rows.get(card_number, []),
            marketzeon_listing_groups,
            ligagundam_listing_groups,
            tcgplayer_printing_price_groups,
            fx_rate,
        )
        item = {
            "cardNumber": card_number,
            "cardName": normalize_text(row.get("card_name")),
            "color": color,
            "cardType": normalize_upper(row.get("card_type")),
            "traits": parse_csvish_list(row.get("traits")),
            "effectPreview": normalize_text(row.get("effect_preview")) or normalize_text(canonical.get("effect_text")),
            "whereToGetIt": normalize_text(row.get("where_to_get_it")) or normalize_text(canonical.get("where_to_get_it")),
            "packageCodes": parse_csvish_list(row.get("package_codes")),
            "packageLabels": parse_csvish_list(row.get("package_labels")),
            "imageUrl": resolve_web_image_url(normalize_text(canonical.get("detail_search_id")) or card_number, normalize_text(canonical.get("image_url"))),
            "detailUrl": normalize_text(canonical.get("detail_url")),
            "detailSearchId": normalize_text(canonical.get("detail_search_id")),
            "variantCode": normalize_text(canonical.get("variant_code")),
            "isParallelVariant": normalize_upper(canonical.get("is_parallel_variant")) == "TRUE",
            "printings": printings,
            "hasAltArt": any(printing["isParallelVariant"] for printing in printings),
            "alternateArtCount": sum(1 for printing in printings if printing["isParallelVariant"]),
            "rarity": normalize_text(canonical.get("rarity")),
            "searchText": " ".join(
                [
                    card_number,
                    normalize_text(row.get("card_name")),
                    color,
                    normalize_upper(row.get("card_type")),
                    normalize_text(row.get("traits")),
                    normalize_text(row.get("effect_preview")),
                ]
            ).lower(),
        }
        apply_price_fields(item, price_map, fx_rate, card_number)
        apply_marketzeon_price_fields(item, marketzeon_price_map, card_number)
        apply_ligagundam_price_fields(item, ligagundam_price_map, card_number)
        resources.append(item)
    resources.sort(key=lambda item: (item["color"], item["cardName"], item["cardNumber"]))
    return resources


def build_archetypes(rows: list[dict]) -> list[dict]:
    archetypes = []
    for row in rows:
        archetype = {
            "archetype": normalize_text(row.get("archetype")),
            "commonColorCombination": normalize_text(row.get("common_color_combination")),
            "templateConfidence": normalize_text(row.get("template_confidence")),
            "templateScope": normalize_text(row.get("template_scope")),
            "recentDecklists": int(row.get("recent_decklists", 0) or 0),
            "recentTop8Decks": int(row.get("recent_top8_decks", 0) or 0),
            "recentWins": int(row.get("recent_wins", 0) or 0),
            "allDecklists": int(row.get("all_decklists", 0) or 0),
            "allTop8Decks": int(row.get("all_top8_decks", 0) or 0),
            "allWins": int(row.get("all_wins", 0) or 0),
            "recentMetaScore": float(row.get("recent_meta_score", 0) or 0),
            "overallMetaScore": float(row.get("overall_meta_score", 0) or 0),
            "bestFinish": normalize_text(row.get("best_finish")),
            "signatureTraits": parse_csvish_list(row.get("signature_traits")),
            "signatureTags": parse_csvish_list(row.get("signature_tags")),
            "coreCardsPreview": parse_csvish_list(row.get("core_cards_preview")),
        }
        archetype["searchText"] = " ".join(
            [
                archetype["archetype"],
                archetype["commonColorCombination"],
                " ".join(archetype["signatureTraits"]),
                " ".join(archetype["signatureTags"]),
                " ".join(archetype["coreCardsPreview"]),
            ]
        ).lower()
        archetypes.append(archetype)
    return archetypes


def build_templates(rows: list[dict]) -> list[dict]:
    templates = []
    for row in rows:
        templates.append(
            {
                "archetype": normalize_text(row.get("archetype")),
                "templateScope": normalize_text(row.get("template_scope")),
                "templateConfidence": normalize_text(row.get("template_confidence")),
                "templateDecks": int(row.get("template_decks", 0) or 0),
                "roleClass": normalize_text(row.get("role_class")).lower(),
                "inclusionRate": float(row.get("inclusion_rate", 0) or 0),
                "avgQuantity": float(row.get("avg_quantity", 0) or 0),
                "recommendedQuantity": max(1, min(4, round(float(row.get("avg_quantity", 0) or 0)))),
                "cardNumber": normalize_upper(row.get("card_number")),
                "cardName": normalize_text(row.get("card_name")),
                "color": normalize_text(row.get("color")) or "Neutral",
                "cardType": normalize_upper(row.get("card_type")),
                "synergyTags": parse_csvish_list(row.get("synergy_tags")),
                "traits": parse_csvish_list(row.get("traits")),
            }
        )
    return templates


def build_previews(rows: list[dict]) -> list[dict]:
    previews = []
    for row in rows:
        previews.append(
            {
                "previewId": normalize_text(row.get("preview_id")),
                "classification": normalize_text(row.get("classification")),
                "previewStatus": normalize_text(row.get("preview_status")),
                "confidence": normalize_text(row.get("confidence")),
                "sourceType": normalize_text(row.get("source_type")),
                "sourceTitle": normalize_text(row.get("source_title")),
                "sourceDate": normalize_text(row.get("source_date")),
                "sectionHeading": normalize_text(row.get("section_heading")),
                "cardNumberHint": normalize_upper(row.get("card_number_hint")),
                "cardNameHint": normalize_text(row.get("card_name_hint")),
                "productCode": normalize_upper(row.get("product_code")),
                "productName": normalize_text(row.get("product_name")),
                "productReleaseDate": normalize_text(row.get("product_release_date")),
                "matchedReleasedCard": normalize_upper(row.get("matched_released_card")) == "TRUE",
                "matchedReleasedPrintings": int(row.get("matched_released_printings", 0) or 0),
                "contextText": normalize_text(row.get("context_text")),
                "sourceUrl": normalize_text(row.get("source_url")),
                "productUrl": normalize_text(row.get("product_url")),
                "imageUrl": normalize_text(row.get("image_url")),
            }
        )
    return previews


def build_products(rows: list[dict]) -> list[dict]:
    products = []
    for row in rows:
        products.append(
            {
                "listPage": normalize_text(row.get("list_page")),
                "category": normalize_text(row.get("category")),
                "productName": normalize_text(row.get("product_name")),
                "productCode": normalize_upper(row.get("product_code")),
                "productKind": normalize_text(row.get("product_kind")),
                "releaseDate": normalize_text(row.get("release_date")),
                "msrp": normalize_text(row.get("msrp")),
                "productUrl": normalize_text(row.get("product_url")),
                "imageUrl": normalize_text(row.get("image_url")),
            }
        )
    return products


def build_packages(rows: list[dict]) -> list[dict]:
    packages = []
    for row in rows:
        packages.append(
            {
                "packageId": normalize_text(row.get("package_id")),
                "packageCode": normalize_upper(row.get("package_code")),
                "packageLabel": normalize_text(row.get("package_label")),
                "packageKind": normalize_text(row.get("package_kind")),
                "resultCount": int(row.get("result_count", 0) or 0),
                "detailCount": int(row.get("detail_count", 0) or 0),
                "packageUrl": normalize_text(row.get("package_url")),
            }
        )
    return packages


def load_competitive_frontend() -> dict:
    """Load the versioned competitive data-engine output.

    CSVs remain import/export artifacts.  The public payload must only be
    derived from the normalized competitive datastore so the frontend has one
    deterministic source for event, result and deck-card records.
    """
    if not COMPETITIVE_FRONTEND_PATH.exists():
        raise FileNotFoundError(
            "Competitive data is missing. Run `npm run data:migrate` and "
            "`npm run data:build` before rebuilding web data."
        )
    payload = json.loads(COMPETITIVE_FRONTEND_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Competitive frontend payload must be a JSON object.")
    return payload


def build_meta_events() -> list[dict]:
    return load_competitive_frontend().get("metaEvents", [])


def build_meta_results() -> list[dict]:
    return load_competitive_frontend().get("metaResults", [])


def build_meta_deck_cards() -> list[dict]:
    return load_competitive_frontend().get("metaDeckCards", [])


def build_market_listings(groups: dict[str, list[dict]]) -> list[dict]:
    listings = []
    for card_number, rows in groups.items():
        for row in rows:
            price = float_or_none(row.get("price_brl"))
            stock = int(float_or_none(row.get("stock")) or 0)
            if price is None or stock <= 0:
                continue
            listings.append(
                {
                    "listingId": normalize_upper(row.get("listing_id")),
                    "cardNumber": card_number,
                    "shop": normalize_text(row.get("shop")),
                    "source": normalize_text(row.get("source")),
                    "title": normalize_text(row.get("title")),
                    "priceBrl": price,
                    "stock": stock,
                    "available": True,
                    "url": normalize_text(row.get("url")),
                    "isVariant": normalize_upper(row.get("listing_id")) != card_number,
                    "fetchedAtUtc": normalize_text(row.get("fetched_at_utc")),
                }
            )
    listings.sort(key=lambda item: (item["cardNumber"], item["listingId"], item["priceBrl"], item["shop"]))
    return listings


def build_rules(advisor_snapshot: dict) -> dict:
    restrictions = []
    for row in advisor_snapshot.get("current_restrictions", []):
        restrictions.append(
            {
                "cardNumber": normalize_upper(row.get("card_number")),
                "cardName": normalize_text(row.get("card_name")),
                "restrictionType": normalize_text(row.get("restriction_type")),
                "maxCopies": int(row.get("max_copies", 0) or 0),
                "effectiveDate": normalize_text(row.get("effective_date")),
                "note": normalize_text(row.get("note")),
                "sourceTitle": normalize_text(row.get("source_title")),
                "sourceUrl": normalize_text(row.get("source_url")),
            }
        )
    banned_pairs = [
        {
            "id": normalize_text(row.get("id")),
            "cardNumbers": [normalize_upper(value) for value in row.get("card_numbers", [])],
            "effectiveDate": normalize_text(row.get("effective_date")),
            "note": normalize_text(row.get("note")),
            "sourceTitle": normalize_text(row.get("source_title")),
            "sourceUrl": normalize_text(row.get("source_url")),
        }
        for row in advisor_snapshot.get("banned_pairs", [])
    ]
    exclusive_groups = [
        {
            "id": normalize_text(row.get("id")),
            "name": normalize_text(row.get("name")),
            "cardNumbers": [normalize_upper(value) for value in row.get("card_numbers", [])],
            "matcher": normalize_text(row.get("matcher")),
            "maxDistinct": int(row.get("max_distinct", 1) or 1),
            "effectiveDate": normalize_text(row.get("effective_date")),
            "note": normalize_text(row.get("note")),
            "sourceTitle": normalize_text(row.get("source_title")),
            "sourceUrl": normalize_text(row.get("source_url")),
        }
        for row in advisor_snapshot.get("exclusive_card_groups", [])
    ]

    return {
        "mainDeckSize": 50,
        "maxColors": 2,
        "mainDeckTypes": ["UNIT", "PILOT", "COMMAND", "BASE"],
        "resourceDeckSize": 10,
        "resourceDeckTypes": ["RESOURCE"],
        "defaultCopyLimit": 4,
        "resourceCopyLimit": "unlimited",
        "currentColorPool": ["Blue", "Green", "Red", "White", "Purple"],
        "notes": [
            "The official July 25, 2025 deck-building guide defines a 50-card main deck and a 10-card resource deck.",
            "The current English product pool now includes Purple, so the builder treats the live color pool as Blue, Green, Red, White, and Purple.",
            "Public event decklists are currently strongest for main-deck analysis, so simulator exports include resource cards separately.",
        ],
        "officialRules": advisor_snapshot.get("official_rules", []),
        "currentRestrictions": restrictions,
        "bannedPairs": banned_pairs,
        "exclusiveCardGroups": exclusive_groups,
        "legalityEffectiveDate": "2026-07-24",
        "legalitySourceUrl": "https://www.gundam-gcg.com/en/news/01_279.html",
    }


def main() -> None:
    WEB_DIR.mkdir(parents=True, exist_ok=True)
    advisor_snapshot = load_snapshot("gundam_deck_advisor_snapshot", ADVISOR_PATH)
    gcg_snapshot = load_snapshot("gundam_gcg_snapshot", GCG_PATH)
    price_map = load_price_map()
    fx_rate = load_fx_rate()
    marketzeon_price_map = load_marketzeon_price_map()
    ligagundam_price_map = load_ligagundam_price_map()
    marketzeon_listing_groups = load_marketzeon_listing_groups()
    ligagundam_listing_groups = load_ligagundam_listing_groups()
    tcgplayer_printing_price_groups = load_tcgplayer_printing_price_groups()

    canonical_rows = choose_canonical_rows(gcg_snapshot.get("cards", []))
    printing_rows = group_printing_rows(gcg_snapshot.get("cards", []))
    main_cards = build_main_cards(
        advisor_snapshot.get("card_advisor_rows", []),
        canonical_rows,
        printing_rows,
        price_map,
        fx_rate,
        marketzeon_price_map,
        ligagundam_price_map,
        marketzeon_listing_groups,
        ligagundam_listing_groups,
        tcgplayer_printing_price_groups,
    )
    resource_cards = build_resource_cards(
        advisor_snapshot.get("resource_rows", []),
        canonical_rows,
        printing_rows,
        price_map,
        fx_rate,
        marketzeon_price_map,
        ligagundam_price_map,
        marketzeon_listing_groups,
        ligagundam_listing_groups,
        tcgplayer_printing_price_groups,
    )
    archetypes = build_archetypes(advisor_snapshot.get("archetype_advisor_rows", []))
    templates = build_templates(advisor_snapshot.get("archetype_template_rows", []))
    previews = build_previews(gcg_snapshot.get("previews", []))
    products = build_products(gcg_snapshot.get("products", []))
    packages = build_packages(gcg_snapshot.get("packages", []))
    meta_events = build_meta_events()
    meta_results = build_meta_results()
    meta_deck_cards = build_meta_deck_cards()
    market_listings = build_market_listings(marketzeon_listing_groups)
    indexed_event_dates = [
        str(row.get("eventDate", ""))[:10]
        for row in [*meta_events, *meta_results]
        if str(row.get("eventDate", ""))[:10]
    ]
    latest_indexed_event_date = max(indexed_event_dates, default=advisor_snapshot.get("latest_event_date"))
    payload_generated_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

    payload = {
        "generatedAt": payload_generated_at,
        "advisorSnapshotGeneratedAt": advisor_snapshot.get("snapshot_generated_utc"),
        "metaSnapshotGeneratedAt": advisor_snapshot.get("meta_snapshot_generated_utc"),
        "cardSnapshotGeneratedAt": gcg_snapshot.get("snapshot_generated_utc"),
        "recentWindowDays": advisor_snapshot.get("recent_window_days"),
        "recentCutoffDate": advisor_snapshot.get("recent_cutoff_date"),
        "latestEventDate": latest_indexed_event_date,
        "fxRate": fx_rate,
        "defaults": advisor_snapshot.get("defaults", {}),
        "counts": advisor_snapshot.get("counts", {}),
        "rules": build_rules(advisor_snapshot),
        "filters": {
            "colors": advisor_snapshot.get("input_options", {}).get("colors", []),
            "cardTypes": advisor_snapshot.get("input_options", {}).get("card_types", []),
            "synergyTags": advisor_snapshot.get("input_options", {}).get("synergy_tags", []),
            "traits": advisor_snapshot.get("input_options", {}).get("traits", []),
            "archetypes": advisor_snapshot.get("input_options", {}).get("archetypes", []),
        },
        "exportProfiles": [
            {
                "id": "msa_text",
                "label": "MSA Text",
                "description": "Readable decklist text with main and resource sections.",
            },
            {
                "id": "egman_url",
                "label": "Egman-Compatible URL",
                "description": "Main-deck export that works well for ZumboSim and scripted tabletop import flows.",
            },
            {
                "id": "simulator_json",
                "label": "Simulator JSON",
                "description": "Canonical deck payload with card numbers, quantities, and image URLs.",
            },
        ],
        "colorPairs": advisor_snapshot.get("color_pair_rows", []),
        "sources": advisor_snapshot.get("sources", []),
        "cards": main_cards,
        "resourceCards": resource_cards,
        "archetypes": archetypes,
        "templates": templates,
        "previews": previews,
        "products": products,
        "packages": packages,
        "metaEvents": meta_events,
        "metaResults": meta_results,
        "metaDeckCards": meta_deck_cards,
        "marketListings": market_listings,
    }

    js_payload = "window.GUNDAM_DECK_BUILDER_DATA = " + json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
    ) + ";\n"
    OUTPUT_JSON_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    OUTPUT_JS_PATH.write_text(js_payload, encoding="utf-8")

    print(
        json.dumps(
            {
                "output": str(OUTPUT_JS_PATH),
                "json_output": str(OUTPUT_JSON_PATH),
                "cards": len(main_cards),
                "resource_cards": len(resource_cards),
                "archetypes": len(archetypes),
                "templates": len(templates),
                "previews": len(previews),
                "products": len(products),
                "packages": len(packages),
                "meta_events": len(meta_events),
                "meta_results": len(meta_results),
                "meta_deck_cards": len(meta_deck_cards),
                "market_listings": len(market_listings),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
