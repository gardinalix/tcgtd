# Gundam Tactical Database Lean Refactor Blueprint

## Objective

Refactor the project into a smaller, reliable product that keeps only the parts that are useful every day:

- card search and card dossier
- deck builder and deck viewer
- price comparison
- competitive monitor
- preview radar for unreleased card reveals
- deck import/export tools

The home remains the cockpit/battle view. Subpages should become compact tactical terminals, not separate cockpit recreations.

## Product Core

### 1. Cards

The cards module is the canonical archive. It must own:

- normalized card identity
- printings and alt arts
- image references
- text, traits, links and keywords
- price references by printing
- card dossier and synergy entry points

### 2. Decks

The decks module must own:

- user decks
- public decklists
- import/export
- deck telemetry
- card hover preview
- synergy suggestions

### 3. Competitive Monitor

This replaces scattered "events/meta/latest winning" logic with one tactical feed.

Official and public event sources must always capture Top 16 when standings/decklists are available.

Digital platform sources are tracked separately from paper/official events so their signal can be weighted differently.

Initial source classes:

- `official_event`: Bandai or official/recognized tournament coverage
- `public_event`: Egman Events, Limitless and similar public tournament archives
- `digital_platform`: Mobile Suit Arena, ZumboSim and other simulators
- `community_deck_platform`: ExBurst public decks and user imports
- `manual_import`: curated CSV when automation is blocked or unstable

### 4. Prices

The prices module must own:

- TCGPlayer USD market/reference
- live USD-BRL conversion
- LigaGundam low/average/high
- MarketZeon low/average/high
- availability flags
- source confidence

No card page should calculate market meaning locally. UI should only render normalized price rows.

### 5. Preview Radar

Preview Radar should show future card reveals only, not old products. GD04 and older cards are no longer preview content.

## Competitive Monitor Data Rules

Top 16 is the default competitive cut.

The system should store:

- event id
- source id
- event name
- date
- format/set legality
- player count
- official status
- platform type
- placement rank
- player
- archetype
- colors
- deck URL
- deck cards
- source URL
- ingestion status

For digital platforms:

- ladder rank, if available
- tournament rank, if available
- sample window
- platform name
- deck popularity
- win rate only if the platform exposes it clearly

Never mix digital ladder consistency with official event wins without showing the source class.

## Refactor Strategy

### Phase 1: Stabilize Data Names

- Keep existing payload fields for compatibility.
- Add new semantic aliases such as `topCutDecks`, `recentTopCutDecks`, `competitiveCutLimit`.
- Stop adding UI logic directly to cards/pages.
- Move all scoring into domain/services.

### Phase 2: Cut the UI Down

- Home shows only cockpit essentials:
  - selected Gundam state
  - latest winning lists
  - meta movement
  - preview radar
  - data filter summary
  - synchronized pilot

- Subpages use one shared tactical terminal shell.
- Remove oversized cards, nested scroll compartments and duplicate dashboards.

### Phase 3: Competitive Monitor Page

Create a dedicated `/competitive` page with:

- Top 16 event feed
- winning deck carousel
- archetype consistency ranking
- color distribution
- source confidence
- official versus digital split
- links to event dossier and deck dossier

### Phase 4: Source Pipeline

Automated where safe:

- Egman Events
- Limitless public Gundam events

Manual/permission-gated until confirmed:

- Mobile Suit Arena
- ZumboSim
- other digital platforms

Every source run must log:

- source
- timestamp
- status
- found rows
- normalized rows
- warnings
- blocked reason

## Keep / Remove Guidance

Keep:

- SQLite database generation
- React app
- cockpit theme system
- card image cache
- price audit
- auth server
- deck import/export
- synergy analysis

Remove or demote:

- old non-React `web/app.js` UI path
- workbook-first flows as primary UX
- duplicated page-specific HUD experiments
- UI calculations that should be data/domain logic
- fake or placeholder source automation

## Current Decision

As of this refactor, competitive ingestion should target Top 16, not Top 8. Existing internal field names containing `top8` are temporarily retained for compatibility, but their displayed meaning should be "Top 16" until they are renamed to `topCut`.
