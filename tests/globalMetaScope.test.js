import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const readProjectFile = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

test("the lightweight home payload exposes every selectable meta window with scoped data", () => {
  const payload = JSON.parse(readProjectFile("web/home-data.json"));
  const ids = payload.metaWindows.map((window) => window.id);

  assert.ok(ids.includes("current"));
  assert.ok(ids.includes("rolling-30"));
  assert.ok(ids.includes("all"));
  for (const id of ids) {
    assert.ok(payload.metaSnapshots[id], `Missing home snapshot for ${id}`);
    assert.ok(Number.isFinite(payload.metaSnapshots[id].counts.decklists));
    assert.ok(Array.isArray(payload.metaSnapshots[id].metaLeaders));
  }
});

test("the header selector drives one persisted meta scope across Home, Field Intel and Forge", () => {
  const app = readProjectFile("src/App.jsx");
  const header = readProjectFile("src/components/layout/SiteHeader.jsx");
  const metaPage = readProjectFile("src/pages/MetaPage.jsx");
  const deckDesigner = readProjectFile("src/components/decks/DeckDesigner.jsx");

  assert.match(header, /META \/ FORMATO/);
  assert.match(header, /onMetaChange\?\.\(event\.target\.value\)/);
  assert.match(app, /tcgtd-meta-scope-id/);
  assert.match(app, /<HomePage[\s\S]*?selectedMetaId=/);
  assert.match(app, /<MetaPage[\s\S]*?onMetaChange=/);
  assert.match(deckDesigner, /onSelectedMetaChange\?\.\(selectedMetaId\)/);
  assert.doesNotMatch(metaPage, /useState\("current"\)/);
});
