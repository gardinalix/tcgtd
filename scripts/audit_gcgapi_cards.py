from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ps_fetch import fetch_text


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DEFAULT_SNAPSHOT_PATH = DATA_DIR / "gundam_gcg_snapshot.json"
DEFAULT_REPORT_PATH = DATA_DIR / "gcgapi_card_audit.json"

MANIFEST_URL = "https://api.gcgapi.com/v1/manifest"
BULK_URL = "https://api.gcgapi.com/v1/bulk"
SOURCE_URL = "https://gcgapi.com/"

CORE_FIELD_MAP = {
    "card_number": "card_number",
    "card_name": "name",
    "rarity": "rarity",
    "type": "card_type",
    "color": "color",
    "level": "level",
    "cost": "cost",
    "ap": "ap_raw",
    "hp": "hp_raw",
    "zone": "zone",
    "trait": "trait",
    "link": "link",
    "source_title": "source_title",
    "effect_text": "effect",
}

IDENTITY_FIELDS = {
    "card_number",
    "card_name",
    "rarity",
    "type",
    "color",
}


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Compare the canonical local Bandai card snapshot with GCGAPI without "
            "importing or publishing the external dataset."
        )
    )
    parser.add_argument(
        "--snapshot",
        type=Path,
        default=DEFAULT_SNAPSHOT_PATH,
        help="Local canonical Bandai snapshot to audit.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_REPORT_PATH,
        help="JSON report path.",
    )
    parser.add_argument(
        "--manifest-url",
        default=MANIFEST_URL,
        help="GCGAPI manifest endpoint.",
    )
    parser.add_argument(
        "--bulk-url",
        default=BULK_URL,
        help="GCGAPI NDJSON bulk endpoint.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=60,
        help="Network timeout for each request.",
    )
    parser.add_argument(
        "--max-examples",
        type=int,
        default=25,
        help="Maximum examples retained for each discrepancy class.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return a non-zero exit code when coverage or identity fields diverge.",
    )
    return parser.parse_args()


def normalize_space(value: Any) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value)).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_scalar(value: Any, field: str) -> str:
    text = normalize_space(value)
    if field in {"color", "level", "cost", "ap", "hp"} and text == "-":
        return ""
    if field == "type":
        return re.sub(r"[^A-Z0-9]+", " ", text.upper()).strip()
    return text


def truncate(value: Any, limit: int = 180) -> str:
    text = normalize_space(value)
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def load_local_snapshot(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Canonical snapshot not found: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("cards"), list):
        raise ValueError(f"Invalid canonical snapshot: {path}")
    return payload


def fetch_json(url: str, timeout_seconds: int) -> dict[str, Any]:
    payload = json.loads(fetch_text(url, timeout_seconds=timeout_seconds))
    if not isinstance(payload, dict):
        raise ValueError(f"Expected a JSON object from {url}")
    return payload


def fetch_ndjson(url: str, timeout_seconds: int) -> list[dict[str, Any]]:
    text = fetch_text(url, timeout_seconds=timeout_seconds)
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        row = json.loads(line)
        if not isinstance(row, dict):
            raise ValueError(f"Expected an object on NDJSON line {line_number} from {url}")
        rows.append(row)
    return rows


def keyed_rows(rows: list[dict[str, Any]], key: str, label: str) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    duplicates: list[str] = []
    for row in rows:
        row_id = normalize_space(row.get(key))
        if not row_id:
            raise ValueError(f"{label} contains a row without {key}")
        if row_id in result:
            duplicates.append(row_id)
        result[row_id] = row
    if duplicates:
        sample = ", ".join(sorted(set(duplicates))[:10])
        raise ValueError(f"{label} contains duplicate identifiers: {sample}")
    return result


def compare_rows(
    local_by_id: dict[str, dict[str, Any]],
    external_by_id: dict[str, dict[str, Any]],
    max_examples: int,
) -> tuple[dict[str, int], dict[str, list[dict[str, str]]], int]:
    field_mismatch_counts = {field: 0 for field in CORE_FIELD_MAP}
    examples: dict[str, list[dict[str, str]]] = {field: [] for field in CORE_FIELD_MAP}
    identity_mismatch_ids: set[str] = set()

    for card_id in sorted(local_by_id.keys() & external_by_id.keys()):
        local = local_by_id[card_id]
        external = external_by_id[card_id]
        for local_field, external_field in CORE_FIELD_MAP.items():
            local_value = normalize_scalar(local.get(local_field), local_field)
            external_value = normalize_scalar(external.get(external_field), local_field)
            if local_value == external_value:
                continue
            field_mismatch_counts[local_field] += 1
            if local_field in IDENTITY_FIELDS:
                identity_mismatch_ids.add(card_id)
            if len(examples[local_field]) < max_examples:
                examples[local_field].append(
                    {
                        "card_id": card_id,
                        "local": truncate(local_value),
                        "gcgapi": truncate(external_value),
                    }
                )

    return (
        field_mismatch_counts,
        {field: rows for field, rows in examples.items() if rows},
        len(identity_mismatch_ids),
    )


def count_structured_fields(rows: list[dict[str, Any]]) -> dict[str, int]:
    fields = ("traits", "link_refs", "keyword_effects", "timing_markers", "keywords_text")
    return {
        field: sum(1 for row in rows if row.get(field))
        for field in fields
    }


def build_report(
    local_snapshot: dict[str, Any],
    manifest: dict[str, Any],
    external_cards: list[dict[str, Any]],
    max_examples: int,
) -> dict[str, Any]:
    local_cards = local_snapshot.get("cards", [])
    local_by_id = keyed_rows(local_cards, "detail_search_id", "Local snapshot")
    external_by_id = keyed_rows(external_cards, "product_id", "GCGAPI bulk dataset")

    missing_locally = sorted(external_by_id.keys() - local_by_id.keys())
    missing_in_gcgapi = sorted(local_by_id.keys() - external_by_id.keys())
    mismatch_counts, mismatch_examples, identity_mismatch_count = compare_rows(
        local_by_id,
        external_by_id,
        max_examples,
    )

    coverage_diverged = bool(missing_locally or missing_in_gcgapi)
    status = "warning" if coverage_diverged or identity_mismatch_count else "ok"

    return {
        "audited_at_utc": now_utc(),
        "status": status,
        "mode": "validation_only",
        "canonical_source": {
            "name": "GUNDAM CARD GAME official English catalog",
            "url": local_snapshot.get("source_root", "https://www.gundam-gcg.com/en/"),
            "snapshot_generated_utc": local_snapshot.get("snapshot_generated_utc", ""),
        },
        "external_reference": {
            "name": "GCGAPI",
            "url": SOURCE_URL,
            "manifest_url": MANIFEST_URL,
            "bulk_url": BULK_URL,
            "dataset_version": manifest.get("dataset_version", ""),
            "license": "ODbL-1.0 data compilation; attribution and share-alike apply if imported",
            "disclaimer": manifest.get("disclaimer", ""),
        },
        "coverage": {
            "local_printings": len(local_cards),
            "gcgapi_printings": len(external_cards),
            "manifest_printings": manifest.get("card_count"),
            "overlap": len(local_by_id.keys() & external_by_id.keys()),
            "missing_locally_count": len(missing_locally),
            "missing_in_gcgapi_count": len(missing_in_gcgapi),
            "missing_locally_sample": missing_locally[:max_examples],
            "missing_in_gcgapi_sample": missing_in_gcgapi[:max_examples],
        },
        "field_comparison": {
            "identity_mismatch_cards": identity_mismatch_count,
            "mismatch_counts": mismatch_counts,
            "examples": mismatch_examples,
        },
        "external_structured_fields_available": count_structured_fields(external_cards),
        "external_manifest_counts": {
            "rulings": manifest.get("ruling_count"),
            "rules_faq": manifest.get("rules_faq_count"),
            "errata": manifest.get("errata_count"),
            "products": manifest.get("product_count"),
        },
        "imported_into_canonical_data": False,
    }


def write_report(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, OSError):
        pass
    try:
        local_snapshot = load_local_snapshot(args.snapshot)
        manifest = fetch_json(args.manifest_url, args.timeout_seconds)
        external_cards = fetch_ndjson(args.bulk_url, args.timeout_seconds)
        report = build_report(
            local_snapshot,
            manifest,
            external_cards,
            max(1, args.max_examples),
        )
    except Exception as error:  # noqa: BLE001 - report network/parser failures for refresh telemetry
        report = {
            "audited_at_utc": now_utc(),
            "status": "error",
            "mode": "validation_only",
            "error": str(error),
            "imported_into_canonical_data": False,
        }
        write_report(args.output, report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    write_report(args.output, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if args.strict and report["status"] != "ok":
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
