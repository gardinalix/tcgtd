"""Fail closed before replacing the official catalog or its public projection."""
from __future__ import annotations


def validate_catalog(snapshot: dict, previous: dict | None = None, public: dict | None = None) -> None:
    cards = snapshot.get("cards", [])
    if not cards or not snapshot.get("packages"):
        raise ValueError("Official catalog is empty or has no packages; existing data was preserved.")
    ids = [row.get("detail_search_id") for row in cards]
    if len(set(ids)) != len(ids):
        raise ValueError("Official catalog contains duplicate printing IDs.")
    for row in cards:
        if any(not str(row.get(key) or "").strip() for key in (
            "detail_search_id", "card_number", "card_name", "type", "image_url",
        )):
            raise ValueError(f"Incomplete official card: {row.get('detail_search_id')}")
    if snapshot.get("cards_count", len(cards)) != len(cards):
        raise ValueError("Official catalog count does not match its printing records.")
    prior_ids = {row["detail_search_id"] for row in (previous or {}).get("cards", [])}
    for card in [*(public or {}).get("cards", []), *(public or {}).get("resourceCards", [])]:
        prior_ids.update(row["detailSearchId"] for row in card.get("printings", []) if row.get("detailSearchId"))
    missing = prior_ids - set(ids)
    if missing:
        raise ValueError(f"Official collection lost {len(missing)} existing printing(s): {', '.join(sorted(missing)[:10])}. Review the source before replacing the catalog.")


def validate_package_count(package_id: str, expected: int, detail_ids: list[str]) -> None:
    if expected != len(detail_ids):
        raise ValueError(f"Incomplete package {package_id}: expected {expected} printings, found {len(detail_ids)}.")
