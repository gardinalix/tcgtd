# Gundam Tactical Database

The project now has an open-source database layer. The canonical local database is:

```text
data/gundam.db
```

SQLite is the first production-safe step because it is fast, open source, portable, and has no server requirement. It lets us stop treating Excel workbooks as a data source while keeping the current static web app deployable. Excel/CSV files can still exist as exports or ingestion compatibility, but the browser dataset can now be generated from the database.

## Rebuild

```powershell
& 'C:\Users\bruno\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\bruno\Documents\Codex\2026-04-19-we-need-to-create-a-full\scripts\build_gundam_sqlite_database.py'
```

Then rebuild the browser payload:

```powershell
& 'C:\Users\bruno\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\bruno\Documents\Codex\2026-04-19-we-need-to-create-a-full\scripts\build_gundam_web_data.py'
```

`build_gundam_web_data.py` reads from `data/gundam.db` when it exists and falls back to the old JSON/CSV files only if the database is missing or unreadable.

## Refresh Pipeline

The existing refresh scripts now rebuild the database automatically:

```powershell
& 'C:\Users\bruno\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\bruno\Documents\Codex\2026-04-19-we-need-to-create-a-full\scripts\refresh_gundam_gcg_database.py' --watch-package GD04
```

```powershell
& 'C:\Users\bruno\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\bruno\Documents\Codex\2026-04-19-we-need-to-create-a-full\scripts\refresh_gundam_deck_advisor.py'
```

## Important Tables

- `cards`: one row per official card printing from the current official-data pipeline.
- `cards_unique`: one canonical row per card number, with printing and alt-art counts.
- `products`, `packages`, `previews`, `faqs`, `sources`: official product/card metadata.
- `prices`: Tcgcsv/TCGplayer market price cache.
- `meta_events`, `meta_results`, `meta_deck_cards`: event and decklist meta data.
- `snapshots`: JSON snapshots kept inside the database for compatibility with the current app-data generator.

## Useful Views

- `card_printings`: compatibility view over `cards`.
- `card_market_view`: cards joined with market prices.
- `card_meta_view`: cards joined with aggregate meta usage.

## Search

When the local SQLite build supports FTS5, the builder creates `cards_fts` for fast full-text card search over name, number, color, type, traits, links, and effect text.

## Next Production Step

For public launch, SQLite can power the static data build immediately. If we add public accounts, cloud collection sync, ratings, comments, or write-heavy community features, the next migration target should be PostgreSQL with the same logical tables.
