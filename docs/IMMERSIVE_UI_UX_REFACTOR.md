# TCG Tactical Database — Immersive UI/UX Refactor

Status: implementation baseline — 2026-08-09

## 1. Audit of the current product

### Structural findings

- The application already has a useful shared component layer (`TacticalPageShell`, `TacticalPageHeader`, `TacticalDataPanel`, summary primitives, tables and status badges).
- The same layer is also the main source of visual sameness: at least 17 screens repeat a four-item `TacticalSummaryStrip` and most content is wrapped in isolated rectangular panels.
- `TacticalPageShell` labels every subsystem as `FORJA INTERFACE`, even when the user is in Cards, Meta, Community or account screens. This weakens spatial orientation and the operating-system metaphor.
- The global stylesheet accumulated multiple generations of overrides. Similar selectors for the header, page shell, panels and summaries appear repeatedly, which makes the final visual hierarchy difficult to predict.
- Navigation is a row of equal buttons. It communicates destinations, but not system context, active module, hierarchy or tactical state.
- The current brand mark still depends on the active Gundam theme/faction. That conflicts with the multi-TCG identity.
- The new Home improved its proposition and first action, but its capability and onboarding sections still use evenly distributed rectangular modules.

### UX findings

- Important information competes with decorative telemetry because both use the same panel weight.
- Summary cards duplicate information that is already present in page headers and tables.
- Filters are visually separated from their results instead of behaving like a contextual scanner.
- Meta Intelligence presents four KPI cards, four panels and then a table. This increases cognitive load before the user reaches the useful comparison.
- Deck operations split “Decks”, “Builder”, “Designer” and “Forge” into labels that are not always clear to a new user.
- Community and Tournament screens reuse card grids even when their content is sequential or relational.
- Mobile collapses desktop grids, but several modules still preserve desktop information density instead of changing interaction mode.

### Existing components worth preserving

- `TacticalPageShell` as the root subsystem frame.
- `TacticalPageHeader` as the consistent module identity and action entry point.
- `TacticalDataPanel` as a semantic grouping primitive, with a new visual treatment.
- `TacticalTable` for dense records where comparison is the task.
- `CardArt`, `CardDetail`, deck legality, Forge workspaces, hover/focus previews and existing filtering logic.
- Theme imagery as game-module atmosphere, not as product identity.

## 2. Product language

The product is an **Advanced Tactical Intelligence System for TCG Competitive Operations**.

Subsystem naming:

| Product area | System language |
| --- | --- |
| Cards | Card Intelligence Archive |
| Card detail | Object Dossier |
| Deck Builder | Tactical Loadout Assembly |
| Forge | Strategic Optimization System |
| Meta | Battlefield Intelligence |
| Tournaments | Combat Records |
| Collection | Arsenal / Logistics |
| Profile | Operator Identity |

The user moves between subsystems inside one command environment. Routes remain normal and accessible, but transitions, breadcrumbs, status and surfaces reinforce continuity.

## 3. Composition principles

1. Prefer one continuous operational surface over a grid of independent cards.
2. Use separators, alignment and proximity before adding borders.
3. Metrics belong in instrumentation rails, not KPI cards.
4. A contextual panel must be visually attached to the object or result it controls.
5. Tables remain tables when comparison is the task; they receive scan/focus states rather than decorative containers.
6. Asymmetry is allowed when it reinforces priority, not merely for novelty.
7. HUD geometry must communicate state, focus, relationship or action.
8. Game artwork establishes atmosphere; product controls and identity remain original and multi-game.

## 4. Tactical Design System

### Typography

- Display / module identity: `Rajdhani`, high weight, compact line-height.
- Instrumentation / labels: `Orbitron`, used only for short codes, states and coordinates.
- Reading text: `Rajdhani`, 16px minimum equivalent on content-heavy screens.
- Long legal and help copy uses normal case and relaxed line-height; no all-caps body text.

### Spacing

- Base step: 4px.
- Control rhythm: 8 / 12 / 16px.
- Content rhythm: 24 / 32 / 48px.
- Subsystem transitions: 64 / 96px.
- Dense tables may use 8–12px rows but preserve a 44px interactive target where rows are actionable.

### Surfaces

- `system-canvas`: full viewport atmosphere, technical grid and module-specific light field.
- `operational-surface`: continuous working area; transparent or lightly translucent, without a card shadow.
- `context-plane`: filters, inspectors and drawers attached to the active task.
- `data-layer`: tables, lists and graphs; separators instead of boxes.
- `modal-layer`: strong depth, blur and focus trap only for real interruption or confirmation.

### Primitives

- `SystemFrame`: global header, module switcher, active-game context and operator state.
- `SystemRail`: compact breadcrumb with subsystem code, network state and contextual status.
- `OperationalHeader`: module identity, mission statement and primary action.
- `InstrumentStrip`: inline metrics separated by ticks; replaces KPI cards.
- `TacticalSurface`: semantic section with bracket anchors and optional contextual actions.
- `ScanList`: connected records with focus, target-lock and progressive disclosure.
- `ContextRail`: sticky desktop inspector that becomes a mobile drawer.
- `CommandButton`: primary, secondary, destructive and quiet variants.
- `SystemInput`: input with explicit label, validation and acquisition state.
- `StatusSignal`: short semantic state, never decoration without meaning.
- `ObjectDossier`: image/object on one plane, intelligence callouts on an attached plane.

### Interaction states

- Hover: 120–180ms scan line or bracket reveal.
- Focus: high-contrast double marker and visible outline.
- Selection: persistent target-lock geometry and semantic `aria-current` / `aria-selected`.
- Loading: short data-acquisition indicator; no multi-second boot sequence.
- Warning: amber; destructive/error: red; synchronized/valid: green; active/focus: cyan.
- Reduced motion: transitions collapse to opacity/color changes.

### Accessibility

- Minimum 44px touch targets for primary mobile controls.
- Keyboard focus is never removed.
- Motion is supplementary and respects `prefers-reduced-motion`.
- Critical state never relies only on color.
- Decorative HUD layers are hidden from assistive technology and cannot intercept input.

## 5. Navigation architecture

- Replace the faction-dependent mark with an original CSS-built targeting insignia.
- Treat the header as a command bridge: brand/system state, connected module switcher, active format/game and operator access.
- Each module button carries a stable operational code and active state.
- `SystemRail` supplies the current subsystem name inside every route.
- Mobile keeps the compact identity bar at the top and a five-target module switcher at the bottom.
- Contextual routes such as Card Dossier and Event Dossier remain inside their parent module’s active navigation state.

## 6. Progressive implementation plan

### Phase A — foundation

- Create product-owned insignia and command navigation.
- Replace universal card summaries with instrumentation rails.
- Convert shared panels into continuous tactical surfaces.
- Add focus, target-lock, scan and reduced-motion states.

### Phase B — priority subsystems

- Home: asymmetric mission map, continuous intelligence field and operational entry paths.
- Deck Designer / Forge: preserve workspaces, but connect brief, loadout, validation and assistant as one optimization flow.
- Meta: replace KPI grid with one battlefield signal surface and attached watch rail.
- Cards: turn filters into a scanner rail and the selected card into a contextual dossier.
- Tournaments: preserve dense tables and connect records to event context and Forge actions.

### Phase C — supporting subsystems

- Deck library: continuous loadout records rather than generic cards.
- Community, Players and Venues: network/map language rather than equal module cards.
- Profile and account: operator dossier and logistics, with calmer density.
- Legal: readable document surface, complete disclaimers, asset attribution and takedown process.

## 7. Performance rules

- Route-level code splitting for all non-Home subsystems.
- Home uses its generated lightweight payload; the full dataset loads only when a data subsystem opens.
- Existing optimized WebP card art remains lazy-loaded.
- Animation uses opacity and transform only where possible.
- No new visual dependency is introduced for HUD effects.
- Generated and third-party assets retain a rights manifest and review gate.

## 8. Release gates

- No public access until all `review_required` assets are cleared, replaced or removed.
- Rights-holder contact channel must be supplied before public launch.
- Legal copy must remain explicit that the project owns only original platform work.
- Build and automated tests must pass before a private release candidate is saved.
