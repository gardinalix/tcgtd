# TCG Tactical Database

Static community UI generated from the local SQLite tactical database, official Gundam card snapshot, competitive advisor snapshot, and optional Tcgcsv/TCGplayer pricing cache.

## What it does

- ZERO System cockpit home with tactical card totals, collection signals, latest detected cards, meta signal, and price radar.
- Card database with TCG-style grid/table modes, image previews, dense filters, sorting, pagination, and detail panel.
- Local collection and classification fields saved in the browser without changing the official database.
- Deck advisor and builder for 50-card main deck plus 10-card resource deck.
- Price view using the generated Tcgcsv/TCGplayer market price fields when available.
- CSV import/export plus deck exports for MSA, ZumboSim/TTS, JSON, and `4xGD01-086` style lists.

## Files

- `index.html`: static app shell
- `styles.css`: UI styling
- `cockpit.css`: current ZERO System cockpit styling
- `app.js`: browser logic for dashboard, card browser, deck builder, collection, classification, prices, and import/export
- `app-data.js`: generated browser dataset
- `app-data.json`: generated React/browser dataset
- `../data/gundam.db`: local SQLite database used as the preferred app-data source
- `assets/card-images/`: locally cached official card art used by the site

## React migration

The stable app still lives in this `web/` folder. New HTML5 + React work is being organized in `../src/`, with `../index.html`, `../vite.config.js`, and `../package.json` as the future React/Vite entrypoint.

See `../REACT_MIGRATION.md` for the migration standard and route status.

React helper commands from the project root:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\react_dev.ps1
powershell.exe -ExecutionPolicy Bypass -File .\scripts\react_build.ps1
powershell.exe -ExecutionPolicy Bypass -File .\scripts\react_preview.ps1
```

## Refreshing the app data

First rebuild the local SQLite database:

```powershell
& 'C:\Users\bruno\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\bruno\Documents\Codex\2026-04-19-we-need-to-create-a-full\scripts\build_gundam_sqlite_database.py'
```

Run:

```powershell
& 'C:\Users\bruno\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'E:\Codex\2026-04-19-we-need-to-create-a-full\scripts\build_gundam_web_data.py'
```

To refresh the local card-art cache first:

```powershell
& 'C:\Users\bruno\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'E:\Codex\2026-04-19-we-need-to-create-a-full\scripts\cache_gundam_card_images.py'
```

Or rebuild the advisor refresh pipeline, which now rebuilds the local database, refreshes the local image cache, and regenerates `app-data.js`.

## Local use

Because the data is embedded as `app-data.js`, you can open `index.html` directly.

If you prefer a local server:

```powershell
Set-Location 'E:\Codex\2026-04-19-we-need-to-create-a-full\web'
& 'C:\Users\bruno\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 4173
```
