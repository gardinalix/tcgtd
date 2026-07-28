# React Migration Standard

The current stable production UI still lives in `web/`. It is a static HTML/CSS/JavaScript app and should remain available until every workflow reaches React parity.

New UI work should be built in `src/` with HTML5 + React components.

## Current Structure

```text
index.html              React app entry for Vite
vite.config.js          Vite + React config
package.json            React/Vite scripts and dependencies
src/
  App.jsx               React route shell
  main.jsx              React mount + CSS imports
  components/
    cards/
    home/
    hud/
    layout/
  data/
  pages/
  utils/
web/
  index.html            Legacy stable app
  app.js                Legacy stable browser logic
  app-data.js           Legacy generated browser data
  app-data.json         React/generated browser data
  assets/
```

## Source Of Truth

Data should flow like this:

```text
official/meta/price fetchers -> data/gundam.db -> scripts/build_gundam_web_data.py -> web/app-data.json
```

`web/app-data.js` is kept for the legacy app. React should prefer `web/app-data.json`.

## Component Rules

- Put reusable visual primitives in `src/components/`.
- Put route-level screens in `src/pages/`.
- Keep data loading isolated in `src/data/`.
- Keep filtering/sorting helpers in `src/utils/`.
- Do not add new UI directly to `web/app.js` unless it is a hotfix for the legacy production shell.
- CSS can reuse the existing cockpit classes during migration, but new route-specific overrides should go into `src/react.css`.

## Migration Status

- `Home`: React cockpit route with theme, parameters, reset scan, data feed, and pilot platform.
- `Cards`: React grid/table route with filters, selected-card detail, BRL-first pricing, and meta signal.
- `Deck ops`: React deck builder route with main/resource sections, counts, legality checks, and plain-list export preview.
- `Market`: React price route with BRL-first price radar and TCGplayer/Tcgcsv references.
- `I/O`: React deck text export route.

## Remaining Parity Work

- Move advanced legacy search syntax into `src/utils/`.
- Port the full card detail printings/FAQ/related-versions panel.
- Port full simulator export formats for MSA, ZumboSim, JSON, and TTS.
- Add pagination or virtualization before showing the entire card pool.
- Add automated component tests after dependencies are installed.

## Commands

After installing dependencies:

```powershell
npm install
npm run dev
npm run build
npm run preview
```

On this machine, `npm` was not available globally. A local official Node runtime was downloaded under `.scratch/node-runtime/`, and the helper scripts below use it automatically when present:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\react_dev.ps1
powershell.exe -ExecutionPolicy Bypass -File .\scripts\react_build.ps1
powershell.exe -ExecutionPolicy Bypass -File .\scripts\react_preview.ps1
```

Important: run Vite from the real `E:\Codex\...` path or through the helper scripts. Running from the old `C:\Users\bruno\Documents\Codex\...` junction can make Vite/Rollup see mixed `C:` and `E:` paths.
