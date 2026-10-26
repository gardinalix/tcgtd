# Military HUD interface

The shared interface uses graphite surfaces, restrained unit-color accents, amber module labels and a consistent reading scale. The home is a three-station command bridge: mission controls, a central Gundam unit monitor, and live catalogue/competitive readouts. Research and operational views use opaque surfaces to keep data readable.

## Style ownership

- `src/navigation.css` owns the header, utility controls, primary navigation, sidebar and application frame. The frame uses a single `--frame-height` value.
- `src/cockpit-bridge.css` owns the home bridge, unit display, scope readouts and keyboard-accessible mission selector. Its independent classes isolate the bridge from retired landing-page layouts.
- `src/military-hud.css` owns shared presentation and the integration with retained route styles. Its `#root .hud-app` scope takes precedence over historical HUD selectors without changing map node geometry.
- `TacticalPageShell` renders the module strip. `TacticalPageHeader` uses independent `module-heading` classes, and summary components use `hud-metrics` / `hud-metric` classes so retired hero and instrument rules cannot change their layout.
- The home unit image follows the selected Gundam theme. Existing card data, sources, deck analysis and map interaction behavior remain in their original services.

## Cockpit refinement

The shared header, module frames, instrument panels and home now use a consistent cockpit chassis with theme-colored rails, inset surfaces and angular corners. The selected unit, faction and palette follow the existing theme configuration. The monitor has static targeting graphics; metrics come from the actual selected data scope. On small screens the non-interactive unit monitor leads, while command keyboard order is preserved.

## Corrections

- Fixed header, navigation and filter alignment; responsive tables scroll within their panels.
- Gave small screens access to secondary modules, keyboard dismissal for controls and a skip-to-content link.
- Global search submits to the card archive from any module.
- Direct card/synergy URLs preserve identifier case, fixing reloads of codes such as `GD05-081`.
- Institutional sections can contain lists without paragraphs; the Legal page renders normally.
- The Portuguese home title uses the actual accented word `decisões` instead of a simulated tilde.

## Local verification

- `npm test`: 177 tests, including identifier round trips and case-insensitive route names.
- Python collector suite: 14 tests passed.
- `npm run build`: production bundle and Worker assets built locally.
- Browser review: 31 routes at 390, 1024, 1440 and 1875 pixels; card and event detail routes use real identifiers from the public snapshot.
- 20 interaction checks: global search, themes, language, event navigation, deck generation, ZERO Forge, mobile controls, Escape focus restoration, mobile filters and private views.
- 20 command-bridge checks: all seven selected-unit themes at desktop/mobile sizes, keyboard mission selection, module navigation and card signal links.
- Private views reviewed at desktop and mobile sizes with a mocked local session. Live authentication, external providers and production writes are outside this visual validation.

This work is local. Publishing requires explicit approval under `AGENTS.md`.
