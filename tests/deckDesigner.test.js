import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRecommendedSubstitution,
  collectDeckResearch,
  designDeck,
  designDeckVariants,
  normalizeDeckEvidence,
} from "../src/services/deckDesigner/index.js";
import { buildExBurstDeckText } from "../src/domain/deckExport.js";

test("research selects exact archetype/color lists and normalizes observed quantities", () => {
  const data = fixtureData();
  const research = collectDeckResearch(data, baseCriteria());
  const normalized = normalizeDeckEvidence(data, research);

  assert.equal(research.matchedDecks.length, 3);
  assert.equal(research.exactDeckCount, 3);
  assert.equal(research.facts.eventCount, 3);
  assert.ok(normalized.cardEvidence.some((item) =>
    item.card.cardNumber === "GD01-086"
    && item.usageRate === 1
    && item.expectedCopies === 4));
});

test("designer assembles a legal deck and honors required/excluded constraints", () => {
  const data = fixtureData();
  const report = designDeck(data, {
    ...baseCriteria(),
    requiredCards: "TEST-014",
    excludedCards: "TEST-013",
  });

  assert.equal(report.stats.mainCount, 50);
  assert.ok(report.main["TEST-014"] >= 1);
  assert.equal(report.main["TEST-013"], undefined);
  for (const quantity of Object.values(report.main)) assert.ok(quantity <= 4);
  assert.deepEqual(Object.keys(report.stats.colors).sort(), ["Blue", "White"]);
  assert.ok(report.rows.every((row) => ["essential", "flexible", "experimental"].includes(row.category)));
});

test("designer infers a coherent color and archetype shell from a main unit alone", () => {
  const data = fixtureData();
  const report = designDeck(data, {
    ...baseCriteria(),
    colors: [],
    archetype: "",
    unitQuery: "Freedom Unit",
  });

  assert.equal(report.criteria.archetype, "Freedom Blockers");
  assert.deepEqual(report.criteria.colors, ["Blue", "White"]);
  assert.equal(report.selectionInference.active, true);
  assert.equal(report.selectionInference.supportingDecks, 3);
  assert.ok(report.main["TEST-001"] > 0);
  assert.equal(report.stats.mainCount, 50);
});

test("designer selects the best finish and preserves independent source-list variants", () => {
  const data = fixtureData();
  setDeckQuantity(data, "deck-2", "TEST-001", 3);
  setDeckQuantity(data, "deck-2", "TEST-012", 3);
  setDeckQuantity(data, "deck-3", "TEST-002", 3);
  setDeckQuantity(data, "deck-3", "TEST-012", 3);

  const reports = designDeckVariants(data, baseCriteria());

  assert.equal(reports.length, 3);
  assert.equal(reports[0].sourceDeck.deckId, "deck-1");
  assert.equal(reports[0].sourceDeck.placingRank, 1);
  assert.deepEqual(
    reports.map((report) => report.sourceDeck.deckId),
    ["deck-1", "deck-2", "deck-3"],
  );
  for (const report of reports) {
    const sourceQuantities = Object.fromEntries(data.metaDeckCards
      .filter((row) => row.deckId === report.sourceDeck.deckId)
      .map((row) => [row.cardNumber, Number(row.quantity)]));
    assert.deepEqual(report.main, sourceQuantities);
    assert.equal(report.assemblyMode, "competitive_source");
    assert.equal(report.stats.mainCount, 50);
  }
});

test("an exact archetype selection does not admit a different blockers archetype", () => {
  const data = fixtureData();
  data.metaResults.find((result) => result.deckId === "deck-3").archetype = "The-O Blockers";

  const research = collectDeckResearch(data, baseCriteria());

  assert.equal(research.matchedDecks.length, 2);
  assert.ok(research.matchedDecks.every((candidate) =>
    candidate.result.archetype === "Freedom Blockers"));
});

test("ExBurst text export uses compact quantity and card-number rows", () => {
  const report = designDeck(fixtureData(), baseCriteria());
  const text = buildExBurstDeckText(report);
  const lines = text.split("\n");

  assert.equal(lines.length, report.rows.length);
  assert.ok(lines.every((line) => /^\d+x[A-Z0-9-]+$/.test(line)));
  assert.ok(lines.includes(`${report.main["GD01-086"]}xGD01-086`));
  assert.equal(lines.reduce((sum, line) => sum + Number(line.split("x")[0]), 0), 50);
});

test("designer lowers confidence and labels limitations without competitive evidence", () => {
  const data = { ...fixtureData(), metaResults: [], metaDeckCards: [], metaEvents: [] };
  const report = designDeck(data, baseCriteria());

  assert.equal(report.stats.mainCount, 50);
  assert.equal(report.confidence, "Low");
  assert.ok(report.limitations.some((item) => /No competitive list matched/i.test(item)));
  assert.ok(report.rows.some((row) => row.source === "inferred"));
});

test("substitution comparison applies Lfrith to Flat and recalculates deck telemetry", () => {
  const data = fixtureData();
  const report = designDeck(data, baseCriteria());
  const lfrith = report.rows.find((row) => row.card.cardNumber === "GD01-086");
  const flat = report.substitutions["GD01-086"]?.find((item) => item.card.cardNumber === "GD04-077");

  assert.ok(lfrith);
  assert.ok(flat);
  assert.equal(flat.kind, "affordable");
  assert.match(flat.synergyImpact, /blocker/i);
  assert.match(flat.synergyImpact, /vanadis institute/i);

  const changed = applyRecommendedSubstitution(report, "GD01-086", "GD04-077", data);
  assert.equal(changed.stats.mainCount, 50);
  assert.equal(changed.main["GD01-086"], undefined);
  assert.equal(changed.main["GD04-077"], lfrith.quantity);
  assert.ok(changed.stats.estimatedPriceBrl < report.stats.estimatedPriceBrl);
  assert.equal(changed.substitutionHistory.length, 1);
  assert.equal(changed.sourceDeck.modified, true);
  assert.equal(changed.assemblyMode, "source_variant_modified");
});

function baseCriteria() {
  return {
    colors: ["Blue", "White"],
    unitQuery: "",
    archetype: "Freedom Blockers",
    preferences: "blocker consistency",
    requiredCards: "",
    excludedCards: "",
    budgetBrl: "",
    focus: "competitive",
  };
}

function setDeckQuantity(data, deckId, cardNumber, quantity) {
  const row = data.metaDeckCards.find((item) =>
    item.deckId === deckId && item.cardNumber === cardNumber);
  row.quantity = quantity;
}

function fixtureData() {
  const cards = [
    card("GD01-086", "Gundam Lfrith", "White", "UNIT", 2, ["Vanadis Institute"], ["blocker"], 50, 5),
    card("GD04-077", "Flat (Militia)", "White", "UNIT", 2, ["Militia"], ["blocker"], 8, 1),
    card("TEST-001", "Freedom Unit", "White", "UNIT", 4, ["Earth Alliance"], ["blocker"], 40, 3),
    card("TEST-002", "Blue Vanguard", "Blue", "UNIT", 1, ["Earth Federation"], ["draw"], 35, 2),
    card("TEST-003", "Blue Defender", "Blue", "UNIT", 2, ["Earth Federation"], ["blocker"], 30, 2),
    card("TEST-004", "White Striker", "White", "UNIT", 3, ["Earth Alliance"], ["damage_push"], 28, 2),
    card("TEST-005", "Ace Pilot", "White", "PILOT", 1, ["Earth Alliance"], ["pair"], 25, 1),
    card("TEST-006", "Support Pilot", "Blue", "PILOT", 2, ["Earth Federation"], ["draw"], 22, 1),
    card("TEST-007", "Resolve Command", "Blue", "COMMAND", 2, [], ["draw"], 20, 1),
    card("TEST-008", "Defense Command", "White", "COMMAND", 1, [], ["blocker"], 18, 1),
    card("TEST-009", "Tactical Command", "Blue", "COMMAND", 3, [], ["search"], 16, 1),
    card("TEST-010", "Forward Base", "White", "BASE", 2, ["Earth Alliance"], ["base_support"], 14, 1),
    card("TEST-011", "Blue Base", "Blue", "BASE", 3, ["Earth Federation"], ["base_support"], 12, 1),
    card("TEST-012", "Late Finisher", "White", "UNIT", 6, ["Earth Alliance"], ["damage_push"], 10, 4),
    card("TEST-013", "Excluded Flex", "Blue", "UNIT", 3, [], ["draw"], 9, 1),
    card("TEST-014", "Required Tech", "Blue", "COMMAND", 1, [], ["search"], 2, 1),
  ];
  const observedCards = cards.filter((item) => !["GD04-077", "TEST-014"].includes(item.cardNumber));
  const quantities = Object.fromEntries(observedCards.slice(0, 13).map((item, index) => [item.cardNumber, index < 12 ? 4 : 2]));
  const results = [1, 2, 4].map((placingRank, index) => ({
    resultId: `result-${index + 1}`,
    deckId: `deck-${index + 1}`,
    eventId: `event-${index + 1}`,
    sourceName: "Fixture Events",
    sourceUrl: `https://example.test/event-${index + 1}`,
    eventName: `Fixture Event ${index + 1}`,
    eventDate: `2026-07-${20 + index}`,
    formatName: "TEST",
    playerName: `Pilot ${index + 1}`,
    placingLabel: `${placingRank}`,
    placingRank: String(placingRank),
    archetype: "Freedom Blockers",
    colorCombination: "Blue/White",
    hasDecklist: true,
  }));
  const metaDeckCards = results.flatMap((result) => Object.entries(quantities).map(([cardNumber, quantity]) => {
    const cardItem = cards.find((item) => item.cardNumber === cardNumber);
    return {
      deckCardId: `${result.deckId}-${cardNumber}`,
      deckId: result.deckId,
      eventId: result.eventId,
      eventName: result.eventName,
      eventDate: result.eventDate,
      playerName: result.playerName,
      placingLabel: result.placingLabel,
      placingRank: result.placingRank,
      archetype: result.archetype,
      colorCombination: result.colorCombination,
      cardNumber,
      cardName: cardItem.cardName,
      quantity,
      cardType: cardItem.cardType,
      cardColor: cardItem.color,
    };
  }));
  return {
    generatedAt: "2026-07-28T00:00:00.000Z",
    latestEventDate: "2026-07-22",
    cards,
    resourceCards: [{
      cardNumber: "R-001",
      cardName: "Resource",
      color: "Neutral",
      cardType: "RESOURCE",
      copyLimit: 99,
      traits: [],
      synergyTags: [],
    }],
    metaEvents: results.map((result) => ({
      eventId: result.eventId,
      eventName: result.eventName,
      eventDate: result.eventDate,
      sourceName: result.sourceName,
      sourceUrl: result.sourceUrl,
    })),
    metaResults: results,
    metaDeckCards,
    archetypes: [{
      archetype: "Freedom Blockers",
      commonColorCombination: "Blue/White",
      signatureTraits: ["Earth Alliance", "Earth Federation", "Vanadis Institute"],
      signatureTags: ["blocker", "draw", "base_support"],
      recentDecklists: 3,
    }],
    rules: {
      mainDeckSize: 50,
      resourceDeckSize: 10,
      maxColors: 2,
      defaultCopyLimit: 4,
      currentRestrictions: [],
      officialRules: [{
        rule_area: "Main deck",
        rule_value: "Exactly 50 cards",
        source_title: "Official fixture rules",
        source_date: "2026-07-01",
        source_url: "https://example.test/rules",
        classification: "official_rule",
      }],
    },
  };
}

function card(cardNumber, cardName, color, cardType, cost, traits, synergyTags, recentTop8DecksUsing, price) {
  return {
    cardNumber,
    cardName,
    color,
    cardType,
    cost: String(cost),
    level: String(cost + 1),
    copyLimit: 4,
    traits,
    synergyTags,
    linkTargets: [],
    topArchetypes: [{ label: "Freedom Blockers", count: recentTop8DecksUsing }],
    recentTop8DecksUsing,
    recentMetaScore: recentTop8DecksUsing,
    marketZeonLowPriceBrl: price,
    effectPreview: synergyTags.join(" "),
  };
}
