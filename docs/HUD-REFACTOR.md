# Military HUD interface

The shared interface uses graphite surfaces, restrained unit-color accents, amber module labels and a consistent reading scale. Gundam illustration stays in the home unit display. Research and operational views use opaque surfaces to keep data readable.

## Style ownership

- `src/navigation.css` owns the header, utility controls, primary navigation, sidebar and application frame. The frame uses a single `--frame-height` value.
- `src/military-hud.css` owns shared presentation and the integration with retained route styles. Its `#root .hud-app` scope takes precedence over historical HUD selectors without changing map node geometry.
- `TacticalPageShell` renders the module strip. `TacticalPageHeader` uses independent `module-heading` classes, and summary components use `hud-metrics` / `hud-metric` classes so retired hero and instrument rules cannot change their layout.
- The home unit image follows the selected Gundam theme. Existing card data, sources, deck analysis and map interaction behavior remain in their original services.

## Corrections

- Fixed header, navigation and filter alignment; responsive tables scroll within their panels.
- Gave small screens access to secondary modules, keyboard dismissal for controls and a skip-to-content link.
- Global search submits to the card archive from any module.
- Direct card/synergy URLs preserve identifier case, fixing reloads of codes such as `GD05-081`.
- Institutional sections can contain lists without paragraphs; the Legal page renders normally.
- The Portuguese home title uses the actual accented word `decisões` instead of a simulated tilde.

## Local verification

- `npm test`: 176 tests, including identifier round trips and case-insensitive route names.
- `npm run build`: production bundle and Worker assets built locally.
- Browser review: 31 routes at 390, 1024 and 1440 pixels; card and event detail routes use real identifiers from the public snapshot.
- Interaction checks: global search, themes, language, event navigation, deck generation, ZERO Forge, mobile controls, Escape focus restoration and mobile filters.
- Private views reviewed at desktop and mobile sizes with a mocked local session. Live authentication, external providers and production writes are outside this visual validation.

This work is local. Publishing requires explicit approval under `AGENTS.md`.
