import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const cardSource = fs.readFileSync(new URL("../src/pages/CardsPage.jsx", import.meta.url), "utf8");
const railSource = fs.readFileSync(new URL("../src/components/layout/TacticalSideRail.jsx", import.meta.url), "utf8");
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
  assert.match(cssSource, /min-height: 28px !important/);
  assert.match(cssSource, /repeat\(auto-fill, minmax\(126px, 1fr\)\)/);
  assert.match(cssSource, /\.has-tactical-rail \.builder-terminal-grid/);
});

test("the operational HUD stylesheet is the final cascade authority", () => {
  assert.ok(mainSource.indexOf('import "./ops-hud.css"') > mainSource.indexOf('import "./hud-system-v2.css"'));
});
