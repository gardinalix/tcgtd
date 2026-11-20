import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { mergePreviewSignals, buildArchivePreviewCards } from "../src/domain/archivePreviews.js";
import { filterCards, DEFAULT_FILTERS } from "../src/utils/cardFilters.js";
import { getMetaSignal, getPriceTelemetry } from "../src/domain/cards.js";

const registry = JSON.parse(fs.readFileSync(new URL("../data/competitive/sources/reported_preview_registry.json", import.meta.url)));
const data = { cards: [], previews: [] };
data.previews = mergePreviewSignals(data, registry);

test("GD07 and EB02 source-linked reveals are searchable as archive previews", () => {
  const cards = buildArchivePreviewCards(data);
  assert.equal(cards.length, 24);
  assert.equal(filterCards(cards, { ...DEFAULT_FILTERS, search: "GD 07" }).length, 23);
  assert.equal(filterCards(cards, { ...DEFAULT_FILTERS, search: "EB02" }).length, 1);
  assert.equal(filterCards(cards, { ...DEFAULT_FILTERS, search: "Destiny Gundam" })[0].packageCodes[0], "EB02");
  assert.equal(filterCards(cards, { ...DEFAULT_FILTERS, set: "GD07", color: "Green" }).length > 0, true);
  assert.equal(data.cards.length, 0);
  assert.equal(filterCards(cards, { ...DEFAULT_FILTERS, set: "EB02", cost: "<=3" }).length, 0);
});

test("previews preserve their identity and cannot receive a BULK or price signal", () => {
  const cards = buildArchivePreviewCards(data);
  assert.equal(new Set(cards.map((card) => card.displayId)).size, cards.length);
  for (const card of cards) {
    assert.equal(getMetaSignal(card).label, "PREVIEW");
    assert.equal(getPriceTelemetry(card).value, null);
    assert.match(card.previewSourceUrl, /^https:/);
  }
});

test("official catalog matches and repeated sightings do not duplicate archive cards", () => {
  const first = data.previews.find((row) => row.cardNumberHint);
  const matched = { ...data, cards: [{ cardNumber: first.cardNumberHint }], previews: [...data.previews, first] };
  assert.equal(buildArchivePreviewCards(matched).length, 23);
});

test("rebuilding signals is idempotent and rejects unregistered sources", () => {
  assert.deepEqual(mergePreviewSignals(data, registry), data.previews);
  const invalid = { ...registry, reveals: [{ ...registry.reveals[0], source_url: "https://unregistered.example/reveal" }] };
  assert.equal(mergePreviewSignals({ previews: [] }, invalid).length, 0);
});
