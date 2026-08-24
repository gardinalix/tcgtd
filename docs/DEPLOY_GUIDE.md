# Deploy Guide

This app is a Vite React app with static JSON data generated from official snapshots and the repository-versioned Competitive Data Engine.

Authentication is served by `server/authServer.mjs`. Configure `.env` from `.env.example` before testing login or production deployment.

## Local

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\react_build.ps1
```

Development server:

```powershell
$nodeDir=(Resolve-Path '.scratch\node-runtime\node-v24.14.0-win-x64').Path
$env:PATH="$nodeDir;$env:PATH"
& "$nodeDir\npm.cmd" run dev
```

Auth server:

```powershell
npm run migrate:auth
npm run auth
```

## Build

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\react_build.ps1
```

Output goes to `dist`.

## Data Refresh

Use the full refresh when the public site needs current official cards, prices, events/meta, database payloads, and workbooks:

```powershell
& 'C:\Users\bruno\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'scripts\refresh_gundam_full.py' --watch-package GD04
```

The full refresh updates official Bandai card/product/FAQ/preview snapshots, TCGCSV prices, public Egman/Limitless competitive inputs, the normalized Competitive Data Engine, advisor/keep reports, SQLite, `web/app-data.json`, cached card images, and Excel workbooks. It also runs a non-blocking comparison against GCGAPI to detect card coverage or identity drift without importing that external dataset. The latest status is written to `data/latest_full_refresh_report.json`; the external comparison is written to `data/gcgapi_card_audit.json`.

For competitive results only, use the zero-infrastructure local commands documented in [`data-engine.md`](data-engine.md): `npm run data:update`, `npm run data:validate`, `npm run data:build`, and `npm run data:export`.

For a faster refresh that skips official refetching and workbook/image generation:

```powershell
& 'C:\Users\bruno\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'scripts\refresh_gundam_full.py' --watch-package GD04 --skip-official-fetch --skip-workbooks --skip-images
```

Use `--skip-gcgapi-audit` when an offline refresh must avoid the external comparison. GCGAPI is validation-only: the official Bandai snapshot remains canonical, and no GCGAPI card rows are copied into public data.

## Production

Recommended static hosts:

- Vercel
- Netlify
- Cloudflare Pages

Build command:

```text
npm install
npm run migrate:auth
npm run build
```

Publish directory:

```text
dist
```

For a Node deployment, run:

```text
npm run start
```

OAuth callbacks are documented in `docs/AUTH_SETUP.md`.

## Rollback

Keep the latest zip in `_backups`. To rollback manually, extract the backup over a separate folder, build, and redeploy that `dist`.
