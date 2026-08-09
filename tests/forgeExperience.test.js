import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCompetitiveScore,
  calculateRecencyScore,
  createCompetitiveMetaConfig,
  createForgeImportFromResult,
  getCompetitiveRecommendations,
  isResultEligibleForMeta,
} from "../src/services/deckDesigner/competitiveMeta.js";
import {
  applyDeckChangeSuggestion,
  createDeckDiff,
} from "../src/services/deckDesigner/deckChangeHistory.js";
import {
  buildDeckAssistantContext,
  normalizeDeckAssistantResponse,
} from "../src/services/deckDesigner/deckAssistant.js";

test("meta atual is the default and historical winners do not dominate current recommendations", () => {
  const data = fixture();
  const metas = createCompetitiveMetaConfig(data);
  const recommendations = getCompetitiveRecommendations(data);

  assert.equal(metas[0].id, "current");
  assert.equal(metas[0].label, "Meta atual");
  assert.deepEqual(recommendations.map((item) => item.result.deckId), ["deck-current"]);
  assert.equal(recommendations[0].result.placingRank, "2");
  assert.ok(!recommendations.some((item) => item.result.deckId === "deck-old-top-1"));
});

test("recency decay is scoped to the selected meta window", () => {
  const currentMeta = { mode: "current", startDate: "2026-04-01", endDate: "2026-07-30" };
  const gd01Meta = { mode: "format", startDate: "2025-07-01", endDate: "2025-08-01" };

  assert.ok(calculateRecencyScore("2026-07-28", currentMeta) > calculateRecencyScore("2026-04-02", currentMeta));
  assert.ok(calculateRecencyScore("2025-07-20", gd01Meta) > 70);

  const recent = calculateCompetitiveScore({ placingRank: 1, playerCount: 64, eventDate: "2026-07-28", eventType: "Official Challenge", hasDecklist: true }, { meta: currentMeta, complete: true });
  const old = calculateCompetitiveScore({ placingRank: 1, playerCount: 64, eventDate: "2026-04-02", eventType: "Official Challenge", hasDecklist: true }, { meta: currentMeta, complete: true });
  assert.ok(recent.finalScore > old.finalScore);
});

test("meta eligibility excludes incomplete and incompatible decklists", () => {
  const data = fixture();
  const incomplete = { ...data.metaResults[0], deckId: "deck-incomplete", resultId: "incomplete" };
  data.metaDeckCards.push(...deckRows("deck-incomplete", 49));

  assert.equal(isResultEligibleForMeta(data, incomplete, "current").reason, "incomplete_decklist");
  assert.equal(isResultEligibleForMeta(data, data.metaResults[0], "gd01").reason, "incompatible_format");
});

test("send to Forge creates an editable copy and preserves tournament source metadata", () => {
  const data = fixture();
  const result = data.metaResults.find((item) => item.deckId === "deck-current");
  const originalRows = structuredClone(data.metaDeckCards);
  const draft = createForgeImportFromResult(data, result, "current");

  draft.main["CARD-001"] = 3;
  assert.deepEqual(data.metaDeckCards, originalRows);
  assert.equal(draft.originalMain["CARD-001"], 4);
  assert.equal(draft.sourceMetadata.playerName, "Current Pilot");
  assert.equal(draft.sourceMetadata.eventName, "Current Challenge");
  assert.equal(draft.selectedMetaId, "current");
});

test("deck diff, confirmed suggestions and partial application remain auditable", () => {
  const main = { A: 4, B: 4 };
  const suggestion = {
    remove: [{ id: "remove-a", cardId: "A", quantity: 1, reason: "cut" }],
    add: [{ id: "add-c", cardId: "C", quantity: 1, reason: "add" }],
  };

  assert.equal(applyDeckChangeSuggestion(main, suggestion).reason, "confirmation_required");
  const partial = applyDeckChangeSuggestion(main, suggestion, { confirmed: true, operationIds: ["remove-a"] });
  assert.deepEqual(partial.main, { A: 3, B: 4 });
  const applied = applyDeckChangeSuggestion(main, suggestion, { confirmed: true });
  assert.deepEqual(applied.main, { A: 3, B: 4, C: 1 });
  assert.deepEqual(createDeckDiff(main, applied.main).changes.map((item) => [item.cardNumber, item.delta]), [["A", -1], ["C", 1]]);
});

test("assistant context is structured and invalid provider responses are normalized safely", () => {
  const data = fixture();
  const workspace = {
    colors: ["Blue"],
    mainCount: 4,
    maxMain: 50,
    stats: { averageCost: 2 },
    curve: [{ id: "early", count: 4, target: 18, need: 14 }],
    composition: [{ id: "unit", count: 4 }],
    roles: [{ id: "consistency", count: 0, target: 6, need: 6 }],
    legal: false,
    structurallyLegal: true,
    issues: ["Main deck must have 50 cards."],
    violations: [],
  };
  const context = buildDeckAssistantContext({ data, deckName: "Context Deck", main: { "CARD-001": 4 }, workspace });

  assert.equal(context.deckName, "Context Deck");
  assert.equal(context.cards[0].cardId, "CARD-001");
  assert.equal(context.cards[0].quantity, 4);
  assert.equal(JSON.parse(JSON.stringify(context)).validation.legal, false);

  const normalized = normalizeDeckAssistantResponse({ message: "x", evidenceType: "invented", suggestion: { add: [{ cardId: "", quantity: 9 }] } });
  assert.equal(normalized.evidenceType, "insufficient_data");
  assert.equal(normalized.suggestion, null);
});

function fixture() {
  const cards = Array.from({ length: 13 }, (_, index) => ({
    cardNumber: `CARD-${String(index + 1).padStart(3, "0")}`,
    cardName: `Card ${index + 1}`,
    cardType: index % 3 ? "UNIT" : "COMMAND",
    color: "Blue",
    cost: index % 6,
    copyLimit: 4,
    traits: [],
    synergyTags: [],
  }));
  const results = [
    {
      resultId: "current-result",
      deckId: "deck-current",
      eventId: "current-event",
      eventName: "Current Challenge",
      eventDate: "2026-07-28",
      formatName: "GD05",
      eventType: "Official Challenge",
      playerCount: "64",
      playerName: "Current Pilot",
      placingLabel: "2nd",
      placingRank: "2",
      archetype: "Current Blue",
      colorCombination: "Blue",
      sourceUrl: "https://example.test/current",
      hasDecklist: true,
    },
    {
      resultId: "old-result",
      deckId: "deck-old-top-1",
      eventId: "old-event",
      eventName: "Old Locals",
      eventDate: "2025-07-20",
      formatName: "GD01",
      eventType: "Unofficial Event",
      playerCount: "24",
      playerName: "Old Pilot",
      placingLabel: "1st",
      placingRank: "1",
      archetype: "Old Blue",
      colorCombination: "Blue",
      sourceUrl: "https://example.test/old",
      hasDecklist: true,
    },
  ];
  return {
    latestEventDate: "2026-07-30",
    recentCutoffDate: "2026-04-01",
    cards,
    metaResults: results,
    metaDeckCards: [
      ...deckRows("deck-current", 50),
      ...deckRows("deck-old-top-1", 50),
    ],
    rules: {
      mainDeckSize: 50,
      maxColors: 2,
      defaultCopyLimit: 4,
      legalityEffectiveDate: "2026-07-24",
      currentRestrictions: [],
      bannedPairs: [],
      exclusiveCardGroups: [],
    },
  };
}

function deckRows(deckId, total) {
  const rows = [];
  let remaining = total;
  for (let index = 1; index <= 13 && remaining > 0; index += 1) {
    const quantity = Math.min(4, remaining);
    rows.push({ deckId, cardNumber: `CARD-${String(index).padStart(3, "0")}`, quantity });
    remaining -= quantity;
  }
  return rows;
}
