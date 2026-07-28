from __future__ import annotations

import csv
import json
import os
import re
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DEFAULT_DATABASE_PATH = DATA_DIR / "gundam.db"

CSV_TABLES = {
    "cards": DATA_DIR / "cards.csv",
    "products": DATA_DIR / "products.csv",
    "packages": DATA_DIR / "packages.csv",
    "previews": DATA_DIR / "previews.csv",
    "faqs": DATA_DIR / "card_faqs.csv",
    "sources": DATA_DIR / "sources.csv",
    "prices": DATA_DIR / "tcgplayer_prices.csv",
    "tcgplayer_printing_prices": DATA_DIR / "tcgplayer_printing_prices.csv",
    "marketzeon_listings": DATA_DIR / "marketzeon_listings.csv",
    "marketzeon_price_comparison": DATA_DIR / "marketzeon_price_comparison.csv",
    "ligagundam_listings": DATA_DIR / "ligagundam_listings.csv",
    "ligagundam_price_comparison": DATA_DIR / "ligagundam_price_comparison.csv",
    "tcgplayer_product_map": DATA_DIR / "tcgplayer_product_map.csv",
    "meta_events": DATA_DIR / "meta_events.csv",
    "meta_results": DATA_DIR / "meta_results.csv",
    "meta_deck_cards": DATA_DIR / "meta_deck_cards.csv",
    "meta_source_coverage": DATA_DIR / "meta_source_coverage.csv",
    "meta_sources": DATA_DIR / "meta_sources.csv",
}

SNAPSHOT_FILES = {
    "gundam_gcg_snapshot": DATA_DIR / "gundam_gcg_snapshot.json",
    "gundam_meta_snapshot": DATA_DIR / "gundam_meta_snapshot.json",
    "gundam_deck_advisor_snapshot": DATA_DIR / "gundam_deck_advisor_snapshot.json",
    "gundam_card_keep_report": DATA_DIR / "gundam_card_keep_report.json",
    "latest_refresh_report": DATA_DIR / "latest_refresh_report.json",
    "tcgplayer_prices": DATA_DIR / "tcgplayer_prices.json",
    "marketzeon_prices": DATA_DIR / "marketzeon_prices.json",
    "tcgcsv_gundam_groups": DATA_DIR / "tcgcsv_gundam_groups.json",
    "tcgcsv_gundam_products": DATA_DIR / "tcgcsv_gundam_products.json",
    "gundam_card_image_cache": DATA_DIR / "gundam_card_image_cache.json",
    "gundam_card_thumbnail_cache": DATA_DIR / "gundam_card_thumbnail_cache.json",
}


def normalize_text(value: object) -> str:
    text = str(value or "").replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_identifier(value: str) -> str:
    identifier = re.sub(r"[^a-zA-Z0-9_]+", "_", value.strip().lower()).strip("_")
    if not identifier:
        identifier = "column"
    if identifier[0].isdigit():
        identifier = f"c_{identifier}"
    return identifier


def unique_columns(columns: Iterable[str]) -> list[str]:
    seen: dict[str, int] = {}
    output = []
    for column in columns:
        base = normalize_identifier(column)
        count = seen.get(base, 0)
        seen[base] = count + 1
        output.append(base if count == 0 else f"{base}_{count + 1}")
    return output


def read_csv_rows(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.exists():
        return [], []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        return fieldnames, list(reader)


def drop_existing_tables(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    for name, object_type in rows:
        quoted = quote_identifier(name)
        if object_type == "view":
            conn.execute(f"DROP VIEW IF EXISTS {quoted}")
        else:
            conn.execute(f"DROP TABLE IF EXISTS {quoted}")


def quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def create_metadata_tables(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE database_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at_utc TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE snapshots (
            snapshot_key TEXT PRIMARY KEY,
            source_file TEXT NOT NULL,
            generated_at_utc TEXT,
            payload_json TEXT NOT NULL,
            loaded_at_utc TEXT NOT NULL
        )
        """
    )


def insert_metadata(conn: sqlite3.Connection, key: str, value: object) -> None:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    conn.execute(
        """
        INSERT INTO database_metadata (key, value, updated_at_utc)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at_utc = excluded.updated_at_utc
        """,
        (key, json.dumps(value, ensure_ascii=False), now),
    )


def create_csv_table(
    conn: sqlite3.Connection,
    table_name: str,
    source_path: Path,
    original_columns: list[str],
    rows: list[dict[str, str]],
) -> int:
    if not original_columns:
        conn.execute(
            f"""
            CREATE TABLE {quote_identifier(table_name)} (
                _source_file TEXT NOT NULL,
                _source_row INTEGER NOT NULL,
                raw_json TEXT NOT NULL
            )
            """
        )
        return 0

    columns = unique_columns(original_columns)
    column_defs = ",\n                ".join(f"{quote_identifier(column)} TEXT" for column in columns)
    conn.execute(
        f"""
        CREATE TABLE {quote_identifier(table_name)} (
            id INTEGER PRIMARY KEY,
            {column_defs},
            _source_file TEXT NOT NULL,
            _source_row INTEGER NOT NULL,
            raw_json TEXT NOT NULL
        )
        """
    )

    insert_columns = columns + ["_source_file", "_source_row", "raw_json"]
    placeholders = ", ".join("?" for _ in insert_columns)
    insert_sql = (
        f"INSERT INTO {quote_identifier(table_name)} "
        f"({', '.join(quote_identifier(column) for column in insert_columns)}) "
        f"VALUES ({placeholders})"
    )

    for row_index, row in enumerate(rows, start=1):
        values = [normalize_text(row.get(original_column)) for original_column in original_columns]
        values.extend([source_path.name, row_index, json.dumps(row, ensure_ascii=False)])
        conn.execute(insert_sql, values)

    return len(rows)


def load_snapshots(conn: sqlite3.Connection) -> dict[str, int]:
    counts = {}
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    for snapshot_key, path in SNAPSHOT_FILES.items():
        if not path.exists():
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        generated_at = ""
        if isinstance(payload, dict):
            generated_at = normalize_text(
                payload.get("snapshot_generated_utc")
                or payload.get("generated_at_utc")
                or payload.get("refreshed_at_utc")
            )
        conn.execute(
            """
            INSERT INTO snapshots (snapshot_key, source_file, generated_at_utc, payload_json, loaded_at_utc)
            VALUES (?, ?, ?, ?, ?)
            """,
            (snapshot_key, path.name, generated_at, json.dumps(payload, ensure_ascii=False), now),
        )
        counts[snapshot_key] = len(payload) if isinstance(payload, list) else len(payload.keys())
    return counts


def sort_variant_priority(row: dict[str, str]) -> tuple[int, int, str]:
    is_parallel = normalize_text(row.get("is_parallel_variant")).upper() == "TRUE"
    variant_code = normalize_text(row.get("variant_code"))
    detail_search_id = normalize_text(row.get("detail_search_id"))
    return (1 if is_parallel else 0, 1 if variant_code else 0, detail_search_id)


def build_unique_cards(conn: sqlite3.Connection, card_rows: list[dict[str, str]]) -> None:
    conn.execute(
        """
        CREATE TABLE cards_unique (
            card_number TEXT PRIMARY KEY,
            canonical_detail_search_id TEXT,
            card_name TEXT,
            color TEXT,
            card_type TEXT,
            rarity TEXT,
            level TEXT,
            cost TEXT,
            ap TEXT,
            hp TEXT,
            effect_text TEXT,
            trait TEXT,
            link TEXT,
            package_codes TEXT,
            package_labels TEXT,
            printings_count INTEGER NOT NULL DEFAULT 0,
            alternate_art_count INTEGER NOT NULL DEFAULT 0,
            has_alt_art INTEGER NOT NULL DEFAULT 0,
            image_url TEXT,
            detail_url TEXT,
            raw_json TEXT NOT NULL
        )
        """
    )

    grouped: dict[str, list[dict[str, str]]] = {}
    for row in card_rows:
        card_number = normalize_text(row.get("card_number")).upper()
        if card_number:
            grouped.setdefault(card_number, []).append(row)

    insert_sql = """
        INSERT INTO cards_unique (
            card_number, canonical_detail_search_id, card_name, color, card_type, rarity,
            level, cost, ap, hp, effect_text, trait, link, package_codes, package_labels,
            printings_count, alternate_art_count, has_alt_art, image_url, detail_url, raw_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    for card_number, rows in grouped.items():
        canonical = sorted(rows, key=sort_variant_priority)[0]
        package_codes = sorted(
            {
                normalize_text(row.get("package_code")).upper()
                for row in rows
                if normalize_text(row.get("package_code"))
            }
        )
        package_labels = sorted(
            {
                normalize_text(row.get("package_label"))
                for row in rows
                if normalize_text(row.get("package_label"))
            }
        )
        alternate_art_count = sum(
            1 for row in rows if normalize_text(row.get("is_parallel_variant")).upper() == "TRUE"
        )
        conn.execute(
            insert_sql,
            (
                card_number,
                normalize_text(canonical.get("detail_search_id")),
                normalize_text(canonical.get("card_name")),
                normalize_text(canonical.get("color")) or "Neutral",
                normalize_text(canonical.get("type")).upper(),
                normalize_text(canonical.get("rarity")),
                normalize_text(canonical.get("level")),
                normalize_text(canonical.get("cost")),
                normalize_text(canonical.get("ap")),
                normalize_text(canonical.get("hp")),
                normalize_text(canonical.get("effect_text")),
                normalize_text(canonical.get("trait")),
                normalize_text(canonical.get("link")),
                ",".join(package_codes),
                ",".join(package_labels),
                len(rows),
                alternate_art_count,
                1 if alternate_art_count else 0,
                normalize_text(canonical.get("image_url")),
                normalize_text(canonical.get("detail_url")),
                json.dumps(canonical, ensure_ascii=False),
            ),
        )


def create_views(conn: sqlite3.Connection) -> None:
    conn.execute("CREATE VIEW card_printings AS SELECT * FROM cards")
    conn.execute(
        """
        CREATE VIEW card_market_view AS
        SELECT
            c.card_number,
            c.card_name,
            c.color,
            c.card_type,
            c.rarity,
            c.has_alt_art,
            p.market_price_usd,
            p.market_price_brl_x5,
            p.price_status,
            p.price_last_checked_utc,
            p.tcgplayer_url
        FROM cards_unique c
        LEFT JOIN prices p ON p.card_number = c.card_number
        """
    )
    conn.execute(
        """
        CREATE VIEW card_meta_view AS
        SELECT
            c.card_number,
            c.card_name,
            c.color,
            c.card_type,
            COUNT(DISTINCT m.deck_id) AS meta_decks_using,
            COALESCE(SUM(CAST(NULLIF(m.quantity, '') AS INTEGER)), 0) AS total_meta_copies,
            MIN(NULLIF(m.placing_rank, '')) AS best_recorded_placing
        FROM cards_unique c
        LEFT JOIN meta_deck_cards m ON m.card_number = c.card_number
        GROUP BY c.card_number, c.card_name, c.color, c.card_type
        """
    )


def create_indexes(conn: sqlite3.Connection) -> None:
    indexes = [
        ("cards", "card_number"),
        ("cards", "detail_search_id"),
        ("cards", "card_name"),
        ("cards", "package_code"),
        ("cards", "color"),
        ("cards", "type"),
        ("cards", "rarity"),
        ("cards", "is_parallel_variant"),
        ("cards_unique", "card_name"),
        ("cards_unique", "color"),
        ("cards_unique", "card_type"),
        ("cards_unique", "rarity"),
        ("prices", "card_number"),
        ("previews", "product_code"),
        ("previews", "preview_status"),
        ("previews", "card_number_hint"),
        ("meta_events", "event_date"),
        ("meta_results", "event_id"),
        ("meta_results", "deck_id"),
        ("meta_results", "event_date"),
        ("meta_deck_cards", "card_number"),
        ("meta_deck_cards", "deck_id"),
        ("meta_deck_cards", "event_id"),
    ]
    for table_name, column_name in indexes:
        if table_has_column(conn, table_name, column_name):
            conn.execute(
                f"CREATE INDEX idx_{table_name}_{column_name} "
                f"ON {quote_identifier(table_name)} ({quote_identifier(column_name)})"
            )


def table_has_column(conn: sqlite3.Connection, table_name: str, column_name: str) -> bool:
    try:
        rows = conn.execute(f"PRAGMA table_info({quote_identifier(table_name)})").fetchall()
    except sqlite3.OperationalError:
        return False
    return any(row[1] == column_name for row in rows)


def create_fts(conn: sqlite3.Connection) -> bool:
    try:
        conn.execute(
            """
            CREATE VIRTUAL TABLE cards_fts USING fts5(
                card_number,
                card_name,
                color,
                card_type,
                trait,
                link,
                effect_text,
                canonical_detail_search_id
            )
            """
        )
        conn.execute(
            """
            INSERT INTO cards_fts (
                card_number, card_name, color, card_type, trait, link, effect_text, canonical_detail_search_id
            )
            SELECT
                card_number, card_name, color, card_type, trait, link, effect_text, canonical_detail_search_id
            FROM cards_unique
            """
        )
        return True
    except sqlite3.OperationalError:
        return False


def resolve_database_path() -> Path:
    configured = os.environ.get("GUNDAM_DB_PATH")
    return Path(configured).expanduser().resolve() if configured else DEFAULT_DATABASE_PATH


def build_database(database_path: Path) -> dict:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    temp_handle = tempfile.NamedTemporaryFile(
        prefix=f"{database_path.stem}-",
        suffix=".db",
        dir=database_path.parent,
        delete=False,
    )
    temp_path = Path(temp_handle.name)
    temp_handle.close()

    csv_counts: dict[str, int] = {}
    card_rows: list[dict[str, str]] = []
    conn: sqlite3.Connection | None = None
    try:
        conn = sqlite3.connect(temp_path)
        conn.execute("PRAGMA foreign_keys = ON")
        drop_existing_tables(conn)
        create_metadata_tables(conn)

        for table_name, source_path in CSV_TABLES.items():
            columns, rows = read_csv_rows(source_path)
            csv_counts[table_name] = create_csv_table(conn, table_name, source_path, columns, rows)
            if table_name == "cards":
                card_rows = rows

        build_unique_cards(conn, card_rows)
        snapshot_counts = load_snapshots(conn)
        create_views(conn)
        create_indexes(conn)
        fts_enabled = create_fts(conn)

        insert_metadata(
            conn,
            "build",
            {
                "built_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                "source": "local Gundam CSV/JSON pipeline",
                "schema_version": 1,
                "fts_enabled": fts_enabled,
            },
        )
        insert_metadata(conn, "csv_counts", csv_counts)
        insert_metadata(conn, "snapshot_counts", snapshot_counts)

        conn.commit()
        conn.close()
        conn = None

        temp_path.replace(database_path)
    except Exception:
        if conn is not None:
            conn.close()
        try:
            temp_path.unlink(missing_ok=True)
        finally:
            raise

    return {
        "database": str(database_path),
        "csv_counts": csv_counts,
        "unique_cards": len({normalize_text(row.get("card_number")).upper() for row in card_rows if normalize_text(row.get("card_number"))}),
        "snapshots": snapshot_counts,
    }


def main() -> None:
    result = build_database(resolve_database_path())
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
