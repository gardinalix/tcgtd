# Deploy Guide

This app is a Vite React app with static JSON data generated from SQLite and official snapshots.

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

The full refresh updates official Bandai card/product/FAQ/preview snapshots, TCGCSV prices, Egman/Limitless meta event data, advisor/keep reports, SQLite, `web/app-data.json`, cached card images, and Excel workbooks. The latest status is written to `data/latest_full_refresh_report.json`.

For a faster refresh that skips official refetching and workbook/image generation:

```powershell
& 'C:\Users\bruno\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'scripts\refresh_gundam_full.py' --watch-package GD04 --skip-official-fetch --skip-workbooks --skip-images
```

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
