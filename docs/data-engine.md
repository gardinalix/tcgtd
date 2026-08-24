# Competitive Data Engine

## Promise and boundaries

The competitive layer is a deterministic, repository-versioned data pipeline. Its required monthly infrastructure cost is **R$ 0,00**:

| Component | Required service | Recurring cost |
| --- | --- | --- |
| Data store, raw archive and derived files | This Git repository | R$ 0,00 |
| Processing | Local Node.js and Python already used by the project | R$ 0,00 |
| Frontend delivery | Existing static-site build | R$ 0,00 additional |
| Optional scheduler | GitHub Actions, once daily | R$ 0,00 required; local execution remains the fallback |

There is no database, paid API, queue, always-on worker, credit-card requirement or paid backend in this engine. It does not use the existing D1 binding: D1 is a separate application feature for authentication/community data and is not a dependency of competitive results.

If GitHub Actions is disabled, unavailable, or reaches a free allowance, no results disappear and `npm run data:update` can be run locally and committed normally. The workflow never deploys the site and creates no cloud resource.

## Architecture

```text
Public sources / manual registry
  -> adapters and importer bridge
  -> data/competitive/raw
  -> data/competitive/normalized
  -> data/competitive/generated + web/data/competitive
  -> web/app-data.json compatibility payload -> React pages
```

`data/competitive/normalized` is the source of truth. CSV is accepted by `csvLegacyAdapter` only for migration/import and emitted again by `data:export`; no React page reads a tournament CSV.

The generated `frontend-meta.json` is the compatibility projection used by `scripts/build_gundam_web_data.py`, so Meta, Events, Event Detail, Players, Decks/Forge and their existing graphs keep their present shape while reading normalized JSON.

`web/data/competitive/` contains separately publishable static endpoints:

- `meta.json` — hash, counts, sources and the last run state;
- `tournament-index.json` — event discovery index, including events with no results;
- `archetype-stats.json` and `card-stats.json` — derived aggregates;
- `tournaments/<id>.json` — independently lazy-loadable event, result and deck-card payloads.

The app already only loads its full payload after a tactical route is opened; lightweight routes use `home-data.json`. The large `frontend-meta.json` compatibility projection stays inside the repository's generated layer and is folded into the existing application payload during build. It is not exposed as an additional public download. New route-level consumers can use the index and `tournaments/<id>.json` files without changing the canonical store.

## Model and provenance

Normalized files are one collection per file: `tournaments.json`, `results.json`, `decks.json`, `deck_cards.json`, `players.json`, `archetypes.json`, `cards.json`, and `conflicts.json`.

Every imported entity retains a `provenance` list with `source_id`, `source_name`, `source_url`, `source_type`, `confidence`, `retrieved_at`, `content_hash`, and `adapter_id`. This answers the origin question without replacing the original source value. Results/decks retain both `source_archetype_name` and `normalized_archetype_id`.

Confidence precedence is `official > trusted > community > manual`. A higher-confidence source may fill a missing field; conflicting known values are never silently overwritten. A source conflict is retained in `conflicts.json` and marked `needs_review`.

The reconciler only merges events when date and normalized event name match and known city/organizer values do not conflict. Multiple source identifiers and provenance records are retained. Bracket feeds that label multiple players as the same placement are preserved and marked `needs_review` rather than assigned invented tiebreakers.

## Sources and adapters

`data/competitive/sources/sources.json` is the source registry. Adapters have a uniform discover/fetch/parse/normalize contract:

- `manualAdapter` reads scheduled or discovered events from `sources/tournaments.json`.
- `csvLegacyAdapter` migrates the present `meta_*.csv` compatibility files.
- `egmanAdapter` is a source descriptor for the existing public collector bridge.
- `bandaiAdapter` tracks official public discovery and intentionally has no private/authenticated collector.

The current Egman/Limitless collector is retained behind the importer bridge to avoid a risky rewrite of its tested public parsing. Its output enters the engine only as legacy import input. New source adapters must prefer a public JSON/API endpoint, then embedded structured page data, and public HTML only as a final option. Never bypass login, CAPTCHA, Cloudflare, rate limiting, or any private endpoint.

To add a source, add its public URL, confidence and adapter ID to `sources.json`, implement the adapter under `scripts/data-engine/adapters/`, add parser fixtures/tests, and return normalized candidates plus provenance. A failed adapter must record an error and leave the previous normalized files untouched.

## Registry and aliases

Add known events to `data/competitive/sources/tournaments.json`, even when no result source exists. For example, the repository contains `mexico-city-2026-08-23` with `awaiting_results`; it will be included in the event index immediately.

Add archetype aliases in `data/competitive/sources/archetype-aliases.json`. Keep the canonical `id` stable and add source spellings to `aliases`. The engine preserves the supplied spelling in `source_archetype_name`; an unknown spelling becomes its own deterministic candidate instead of being guessed.

## Local operations

Use the project Node runtime through npm:

```bash
npm run data:migrate
npm run data:validate
npm run data:build
npm run data:export
```

`npm run data:update` is the complete local update: it checks the existing public collector, imports the latest valid legacy bridge output, validates, regenerates static files, and rebuilds `web/app-data.json`. A targeted invocation is accepted for reporting/review:

```bash
npm run data:update -- --tournament mexico-city-2026-08-23
```

The present public collectors discover globally, so that target does not force an unsupported source-specific scrape; it scopes the update report. A future direct tournament adapter can use the same option for a precise fetch.

The engine prints a concise update summary with known, checked, updated, unchanged and failed source counts. It uses input content hashes and writes only files whose content actually changed. Raw `legacy-csv/current/source.json.gz` is the reproducible, compressed snapshot for the current imported CSV state; `manifest.json` makes its hash and source inputs inspectable. Git history preserves previous snapshots.

To reprocess after an alias or reconciliation correction, edit the source configuration, run `data:migrate`, validate, build, then run the normal site build. To export interoperable data, run `data:export`; `data/competitive/exports/` receives CSVs and a full JSON export.

## Validation and fail-safe behavior

Validation blocks broken foreign keys, unknown tournament/deck/card/archetype references, placements less than one, card quantities outside 1–4, invalid statuses, and an empty import that would replace an existing tournament/result dataset. Ambiguous source data becomes `needs_review`; it is not auto-corrected.

The public collector is best-effort. If it is unavailable or parsing fails, the engine reports the error and migrates only the last valid local bridge files. It never writes an empty dataset over a non-empty normalized dataset.

## GitHub Actions

`.github/workflows/update-tournament-data.yml` runs once daily and supports **Run workflow** (`workflow_dispatch`). It has a 15-minute timeout, one concurrent run, validates before committing, and commits only a real diff. It is deliberately a convenience rather than a dependency: do not enable paid GitHub Actions spending or add a billing method for this engine. If the repository's free automation is unavailable, disable the schedule and use the same local commands above.

The workflow only updates versioned data and static build artifacts; it never publishes. Follow the repository's local-first approval flow before any live deployment.
