import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const cardSource = fs.readFileSync(new URL("../src/pages/CardsPage.jsx", import.meta.url), "utf8");
const railSource = fs.readFileSync(new URL("../src/components/layout/TacticalSideRail.jsx", import.meta.url), "utf8");
const deckMapSource = fs.readFileSync(new URL("../src/components/decks/DeckMap.jsx", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("../src/ops-hud.css", import.meta.url), "utf8");
const mainSource = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

test("operational routes share one persistent tactical subsystem rail", () => {
  assert.match(appSource, /has-tactical-rail/);
  assert.match(appSource, /<TacticalSideRail/);
  assert.match(railSource, /ARCHIVE/);
  assert.match(railSource, /OPERATIONS/);
  assert.match(railSource, /NETWORK/);
  assert.match(railSource, /Field Intel/);
});

test("card archive uses compact chromatic controls instead of summary dashboard cards", () => {
  assert.match(cardSource, /className="card-color-filter"/);
  assert.match(cardSource, /data-card-color=/);
  assert.match(cardSource, /className="card-results-toolbar"/);
  assert.doesNotMatch(cardSource, /TacticalSummaryStrip/);
});

test("the final HUD layer compresses controls and turns shared cards into telemetry planes", () => {
  assert.match(cssSource, /\.has-tactical-rail \.tactical-summary-strip/);
  assert.match(cssSource, /\.has-tactical-rail \.tactical-data-panel/);
  assert.match(cssSource, /min-height: 30px !important/);
  assert.match(cssSource, /repeat\(auto-fill, minmax\(148px, 1fr\)\)/);
  assert.match(cssSource, /\.has-tactical-rail \.builder-terminal-grid/);
});

test("localized card colors resolve to distinct HUD channels", () => {
  assert.match(cardSource, /includes\("azul"\)/);
  assert.match(cardSource, /includes\("vermelh"\)/);
  assert.match(cardSource, /includes\("verde"\)/);
  assert.match(cardSource, /includes\("branc"\)/);
  assert.match(cardSource, /includes\("rox"\)/);
  assert.match(cssSource, /data-card-color="green"/);
  assert.match(cssSource, /data-card-color="purple"/);
});

test("the operational header is fixed and its grid reserves readable space", () => {
  assert.match(cssSource, /grid-template-rows: 76px minmax\(0, 1fr\) auto/);
  assert.match(cssSource, /position: fixed !important/);
  assert.match(cssSource, /top: 76px !important/);
});

test("the active dossier stretches with the complete card field instead of creating its own scroll", () => {
  assert.match(cssSource, /The gallery establishes the row height/);
  assert.match(cssSource, /\.cards-terminal-side-stack \{[\s\S]*?align-self: stretch;[\s\S]*?align-content: start;[\s\S]*?grid-auto-rows: max-content;[\s\S]*?max-height: none !important;[\s\S]*?overflow: visible !important;/);
  assert.match(cssSource, /\.react-card-detail \{[\s\S]*?position: static !important;[\s\S]*?max-height: none !important;[\s\S]*?overflow: visible !important;/);
});

test("the deck mission station assigns every parameter a readable field and keeps execution out of the side column", () => {
  assert.match(cssSource, /"head head"\s*\n\s*"colors fields"\s*\n\s*"constraints constraints"\s*\n\s*"launch launch"/);
  assert.match(cssSource, /"unit strategy"\s*\n\s*"focus meta"/);
  assert.match(cssSource, /\.deck-designer__meta-field \{ grid-area: meta !important; \}/);
  assert.match(cssSource, /deck-designer-input-mode > button::before[\s\S]*?border-radius: 0 !important/);
});

test("responsive HUD rules preserve full-width controls and stack dense subsystem grids", () => {
  assert.match(cssSource, /Responsive validation pass/);
  assert.match(cssSource, /grid-template-columns: 44px minmax\(0, 1fr\) minmax\(264px, 342px\) !important/);
  assert.match(cssSource, /\.meta-window-selector \{[\s\S]*?width: 100% !important/);
  assert.match(cssSource, /\.preview-terminal-actions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(126px, \.42fr\)/);
  assert.match(cssSource, /\.community-main-grid\.tactical-network-streams,[\s\S]*?grid-template-columns: 1fr !important/);
});

test("meta intelligence gives archetypes a primary data station instead of a decorative radar field", () => {
  assert.match(cssSource, /Meta intelligence board: data is the field/);
  assert.match(cssSource, /grid-template-columns: minmax\(0, 1\.18fr\) minmax\(340px, \.82fr\) !important/);
  assert.match(cssSource, /\.meta-archetype-station \{[\s\S]*?grid-row: 1 \/ span 3 !important/);
  assert.match(cssSource, /grid-template-rows: repeat\(12, minmax\(42px, 1fr\)\) !important/);
});

test("the generated deck opens on the full interactive map and keeps the manifest available", () => {
  assert.match(deckMapSource, /useState\("links"\)/);
  assert.match(deckMapSource, />INTERACTIVE MAP</);
  assert.match(deckMapSource, />DECK MANIFEST</);
  assert.match(deckMapSource, /if \(activeId && !isActive\) return null/);
  assert.match(deckMapSource, /matchMedia\?\.\("\(max-width: 900px\)"\)/);
  assert.match(cssSource, /Generated deck review: interactive map first/);
  assert.match(cssSource, /\.deck-map__workspace\.is-links \{[\s\S]*?min-height: 680px/);
  assert.match(cssSource, /\.deck-map__formation-groups \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test("the operational HUD stylesheet is the final cascade authority", () => {
  assert.ok(mainSource.indexOf('import "./ops-hud.css"') > mainSource.indexOf('import "./hud-system-v2.css"'));
});

test("synergy map hover acquires a node without moving or scaling the card", () => {
  assert.match(cssSource, /Synergy map acquisition: stable telemetry/);
  assert.match(cssSource, /body\[data-view="synergyMap"\][\s\S]*?\.synergy-map-node:hover,[\s\S]*?transform: translate\(-50%, -50%\) !important;/);
  assert.doesNotMatch(cssSource, /body\[data-view="synergyMap"\][\s\S]*?\.synergy-map-node:hover[\s\S]*?scale\(/);
  assert.match(cssSource, /prefers-reduced-motion: reduce[\s\S]*?\.synergy-map-node[\s\S]*?transition: none !important/);
});
