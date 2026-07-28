from __future__ import annotations

import argparse
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
WEB_DATA_PATH = ROOT / "web" / "app-data.json"
PRODUCTS_PATH = DATA_DIR / "tcgcsv_gundam_products.json"
GROUPS_PATH = DATA_DIR / "tcgcsv_gundam_groups.json"
REPORT_PATH = DATA_DIR / "price_audit_report.json"
ANOMALIES_PATH = DATA_DIR / "price_audit_anomalies.csv"


def normalize(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def extended_value(product: dict, name: str) -> str:
    for row in product.get("extendedData") or []:
        if normalize(row.get("name")).lower() == name.lower():
            return normalize(row.get("value"))
    return ""


def is_plus(value: object) -> bool:
    return "+" in normalize(value)


def normalize_group(value: object) -> str:
    text = normalize(value).upper()
    return text[:-2] if text.endswith("_B") else text


def event_markers(source: object) -> list[str]:
    text = normalize(source).upper()
    return [
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
        if marker in text
    ]


def product_matches_event(product: dict, group: dict, marker: str) -> bool:
    haystack = f"{normalize(product.get('name')).upper()} {normalize(group.get('name')).upper()}"
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


def write_anomalies(rows: list[dict]) -> None:
    columns = ["severity", "type", "card_number", "printing_id", "detail"]
    with ANOMALIES_PATH.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Gundam price coverage and printing mappings.")
    parser.add_argument("--strict", action="store_true", help="Exit non-zero when coverage or mapping checks fail.")
    args = parser.parse_args()

    payload = json.loads(WEB_DATA_PATH.read_text(encoding="utf-8"))
    products = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
    groups = json.loads(GROUPS_PATH.read_text(encoding="utf-8"))
    products_by_id = {str(row.get("productId")): row for row in products}
    groups_by_id = {str(row.get("groupId")): row for row in groups}
    printings = [
        (card, printing)
        for card in payload.get("cards", [])
        for printing in card.get("printings", [])
    ]

    anomalies: list[dict] = []
    tcgp_priced = 0
    liga_priced = 0
    marketzeon_priced = 0
    deviations = []

    for card, printing in printings:
        card_number = normalize(card.get("cardNumber"))
        printing_id = normalize(printing.get("detailSearchId"))
        tcg_price = printing.get("marketPriceBrlFx")
        liga_price = printing.get("ligaGundamLowPriceBrl")
        marketzeon_price = printing.get("marketZeonLowPriceBrl")
        tcgp_priced += tcg_price is not None
        liga_priced += liga_price is not None
        marketzeon_priced += marketzeon_price is not None

        product_id = normalize(printing.get("tcgplayerProductId"))
        if product_id:
            product = products_by_id.get(product_id, {})
            product_rarity = extended_value(product, "Rarity")
            if is_plus(printing.get("rarity")) != is_plus(product_rarity):
                anomalies.append(
                    {
                        "severity": "error",
                        "type": "tcgp_rarity_mismatch",
                        "card_number": card_number,
                        "printing_id": printing_id,
                        "detail": f"Official {printing.get('rarity')} mapped to TCGP {product_rarity} / {product.get('name')}",
                    }
                )

            package_code = normalize(printing.get("packageCode")).upper()
            group = groups_by_id.get(str(product.get("groupId")), {})
            group_code = normalize_group(group.get("abbreviation"))
            if package_code and group_code and package_code != group_code:
                anomalies.append(
                    {
                        "severity": "error",
                        "type": "tcgp_set_mismatch",
                        "card_number": card_number,
                        "printing_id": printing_id,
                        "detail": f"Official {package_code} mapped to TCGP {group_code} / {group.get('name')}",
                    }
                )
            markers = event_markers(printing.get("whereToGetIt"))
            if markers and not any(product_matches_event(product, group, marker) for marker in markers):
                anomalies.append(
                    {
                        "severity": "error",
                        "type": "tcgp_event_mismatch",
                        "card_number": card_number,
                        "printing_id": printing_id,
                        "detail": f"Official event printing mapped to unrelated TCGP product {product.get('name')}",
                    }
                )

        for provider, value in (("ligagundam", liga_price), ("marketzeon", marketzeon_price)):
            if tcg_price and value:
                ratio = float(value) / float(tcg_price)
                if ratio >= 5 or ratio <= 0.2:
                    deviations.append(
                        {
                            "severity": "watch",
                            "type": f"{provider}_extreme_deviation",
                            "card_number": card_number,
                            "printing_id": printing_id,
                            "detail": f"{provider} R${float(value):.2f} vs TCGP FX R${float(tcg_price):.2f} ({ratio:.2f}x)",
                            "_ratio": max(ratio, 1 / ratio),
                        }
                    )

    anomalies.extend(sorted(deviations, key=lambda row: row["_ratio"], reverse=True)[:100])
    for row in anomalies:
        row.pop("_ratio", None)

    total = len(printings)
    coverage = {
        "tcgplayer": round(tcgp_priced / total, 4) if total else 0,
        "ligagundam": round(liga_priced / total, 4) if total else 0,
        "marketzeon": round(marketzeon_priced / total, 4) if total else 0,
    }
    failures = []
    if coverage["tcgplayer"] < 0.85:
        failures.append("TCGPlayer printing coverage below 85%.")
    if coverage["ligagundam"] < 0.50:
        failures.append("LigaGundam printing coverage below 50%.")
    if coverage["marketzeon"] < 0.70:
        failures.append("MarketZeon printing coverage below 70%.")
    if any(row["severity"] == "error" for row in anomalies):
        failures.append("TCGPlayer printing mapping errors detected.")

    report = {
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "printings": total,
        "priced_printings": {
            "tcgplayer": tcgp_priced,
            "ligagundam": liga_priced,
            "marketzeon": marketzeon_priced,
        },
        "coverage": coverage,
        "errors": sum(row["severity"] == "error" for row in anomalies),
        "watch_items": sum(row["severity"] == "watch" for row in anomalies),
        "failures": failures,
        "status": "failed" if failures else "ok",
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_anomalies(anomalies)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 1 if args.strict and failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
