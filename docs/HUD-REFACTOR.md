# Military HUD interface

The interface follows the orbital Gundam cockpit reference: a panoramic Earth window, metallic structural artwork, blue illuminated glass panels, a lateral command menu and lower instrument displays. All controls, pilot identity, events and card signals remain HTML backed by application state. Operational screens share the same blue frame treatment with denser, more opaque reading surfaces.

## Style ownership

- `src/navigation.css` owns the header, utility controls, primary navigation, sidebar and application frame. The frame uses a single `--frame-height` value.
- `src/cockpit-bridge.css` owns the orbital scene, glass frame treatment, home instruments, unit display and keyboard-accessible mission selector. Its independent classes isolate the bridge from retired landing-page layouts.
- `src/military-hud.css` owns shared presentation and the integration with retained route styles. Its `#root .hud-app` scope takes precedence over historical HUD selectors without changing map node geometry.
- `TacticalPageShell` renders the module strip. `TacticalPageHeader` uses independent `module-heading` classes, and summary components use `hud-metrics` / `hud-metric` classes so retired hero and instrument rules cannot change their layout.
- The home unit image follows the selected Gundam theme. Existing card data, sources, deck analysis and map interaction behavior remain in their original services.

## Cockpit refinement

The generated background at `web/assets/backgrounds/orbital-cockpit.webp` contains only scenery and structural metal, without baked-in text or controls. It was created from the user-provided direction with OpenAI image generation and encoded as a 415 KB WebP; its provenance is maintained by `scripts/build_public_payloads.mjs` in the asset manifest.

The selected unit and faction follow the existing theme. The pilot greeting uses the current session, and the guest action opens login. The tactical map action opens the real synergy map for the first available meta signal. The illustrated orbital chart is decorative; the catalogue, decklist and event counts come from the selected scope. On phones the welcome/action leads, with unit and instrument panels stacked below; primary navigation stays available at the bottom.

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
- 25 orbital-cockpit checks: all seven unit themes at desktop/mobile sizes, keyboard mission selection, Forge navigation, card signals, synergy-map entry, guest login and authenticated pilot/profile flow.
- Private views reviewed at desktop and mobile sizes with a mocked local session. Live authentication, external providers and production writes are outside this visual validation.

Publication follows the approval and validation flow in `AGENTS.md`.
