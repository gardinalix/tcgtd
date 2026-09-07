import assert from "node:assert/strict";
import test from "node:test";

import { buildMetaWindows, buildScopedMetaSignal } from "../src/domain/meta.js";

const DATA = {
  latestEventDate: "2026-08-06",
  products: [
    { productCode: "GD04", productName: "Phantom Front [GD04]", releaseDate: "April 24, 2026" },
    { productCode: "GD05", productName: "Freedom Ascension [GD05]", releaseDate: "July 24, 2026" },
    { productCode: "GD06", productName: "Stardust Trails [GD06]", releaseDate: "October 30, 2026" },
  ],
  cards: [
    { cardNumber: "GD05-001", cardName: "Current signal", color: "Blue", cardType: "UNIT" },
    { cardNumber: "GD01-100", cardName: "Historical signal", color: "Blue", cardType: "COMMAND" },
  ],
  metaResults: [
    { deckId: "old-1", eventId: "old-event", eventDate: "2026-07-15", archetype: "Old shell", colorCombination: "Blue/White", placingRank: 1 },
    { deckId: "new-1", eventId: "new-event", eventDate: "2026-07-25", archetype: "New shell", colorCombination: "Blue/Green", placingRank: 1 },
    { deckId: "new-2", eventId: "new-event", eventDate: "2026-08-06", archetype: "New shell", colorCombination: "Blue/Green", placingRank: 4 },
  ],
  metaDeckCards: [
    { deckId: "old-1", cardNumber: "GD01-100", cardName: "Historical signal", cardColor: "Blue", cardType: "COMMAND" },
    { deckId: "new-1", cardNumber: "GD05-001", cardName: "Current signal", cardColor: "Blue", cardType: "UNIT" },
    { deckId: "new-2", cardNumber: "GD05-001", cardName: "Current signal", cardColor: "Blue", cardType: "UNIT" },
  ],
};

test("current meta window follows the latest released GD booster", () => {
  const windows = buildMetaWindows(DATA);
  const current = windows.find((window) => window.id === "current");

  assert.equal(current.formatCode, "GD05");
  assert.equal(current.startDate, "2026-07-24");
  assert.equal(current.endDate, "2026-08-06");
  assert.ok(windows.some((window) => window.id === "gd04"));
  assert.ok(!windows.some((window) => window.formatCode === "GD06"));
});

test("current meta window retains newer indexed results when metadata is stale", () => {
  const windows = buildMetaWindows({
    ...DATA,
    metaResults: [...DATA.metaResults, { deckId: "fresh-1", eventId: "fresh-event", eventDate: "2026-09-03" }],
  });

  assert.equal(windows.find((window) => window.id === "current").endDate, "2026-09-03");
});

test("scoped meta excludes cards and archetypes absent from the selected window", () => {
  const current = buildMetaWindows(DATA).find((window) => window.id === "current");
  const signal = buildScopedMetaSignal(DATA, current);

  assert.deepEqual(signal.ranked.map((row) => row.cardNumber), ["GD05-001"]);
  assert.deepEqual(signal.archetypeTrends.map((row) => row.archetype), ["New shell"]);
  assert.equal(signal.context.deckCount, 2);
  assert.equal(signal.context.eventCount, 1);
});
