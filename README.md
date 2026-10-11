# TCG Tactical Database

TCGTD is a Gundam Card Game database, competitive research tool and deck builder. The React application includes card search, preview tracking, market references, event and player research, community schedules, deck analysis and the ZERO Forge deck workspace.

Repository: [gardinalix/tcgtd](https://github.com/gardinalix/tcgtd)

## Run locally

Use Node.js 24 and npm. From a fresh clone:

```bash
git clone https://github.com/gardinalix/tcgtd.git
cd tcgtd
npm ci
npm run data:validate
npm test
npm run build
npm run dev
```

Open `http://127.0.0.1:4173`. The repository contains the public datasets and image assets required to build the application; a fresh clone does not need the workstation's SQLite database or a new data fetch.

For local authentication and API testing, copy `.env.example` to `.env`, configure its local settings, then run these commands in a second terminal:

```bash
npm run migrate:auth
npm run auth
```

Vite proxies `/api`, partner redirects and supported OAuth callbacks to the local server at `http://127.0.0.1:4180`. OAuth login and remote AI require the corresponding provider credentials. Keep `.env` private. See [authentication setup](docs/AUTH_SETUP.md).

`npm run preview` serves the compiled frontend. For API integration checks, use the local authentication server alongside `npm run dev`.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/` | React pages, components, domain logic, deck analysis and translations |
| `worker/` | Hosted Worker APIs, static asset routing and security headers |
| `server/authServer.mjs` | Local Node server, SQLite authentication and API compatibility |
| `data/competitive/` | Versioned public source registry, evidence, normalized records and derived competitive datasets |
| `web/` | Public JSON payloads, cached card images and the retained legacy UI |
| `scripts/` | Data ingestion, validation, payload builds and optional Python refresh/export tools |
| `drizzle/`, `migrations/` | Hosted and local database schema migrations |
| `tests/` | Node tests and Python price collector tests |
| `docs/`, `templates/` | Product and operational documentation and import templates |
| `.openai/hosting.json` | Existing Sites project metadata and D1 binding declaration |

`npm run build` validates and rebuilds competitive projections, creates the lightweight home payload and asset rights manifest, then compiles the frontend. Its deployment output is `dist/client/` for static assets and `dist/server/` for Worker code. The build also copies existing hosting metadata to `dist/.openai/hosting.json`.

General card, price and SQLite caches under `data/` remain local. The public snapshot in `web/app-data.json` and the canonical competitive records under `data/competitive/normalized/` remain versioned.

## Data operations

```bash
npm run data:validate  # Read-only validation of normalized competitive data
npm run data:build     # Rebuild competitive projections from versioned records
npm run data:update    # Fetch public sources and refresh data; review changes before committing
npm run data:export    # Generate local CSV/JSON exports
```

The normal frontend build requires Node only. Source refresh and workbook/image generation also use Python. Individual tools require additional packages such as `lxml`, `openpyxl` and Pillow; install the packages used by the tool you intend to run. See [the data engine guide](docs/data-engine.md), [database notes](DATABASE.md) and [deployment guide](docs/DEPLOY_GUIDE.md).

## Git and hosting

Git contains application code, public data, assets, schema and documentation. It does not transfer the hosted D1 database, user records, secrets, provider registrations, domain/DNS configuration or browser-local collections and decks.

The Git migration preserves the existing Sites deployment. Changes must be implemented and validated locally, and live publication requires explicit approval under [AGENTS.md](AGENTS.md). The validation workflow performs no deployment. The optional tournament update workflow updates repository data and performs no deployment.

See [the Git migration notes](docs/GIT-MIGRATION.md) for scope, exclusions and verification.
