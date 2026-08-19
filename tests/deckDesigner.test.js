import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeImportedDeck,
  applyRecommendedSubstitution,
  collectDeckResearch,
  designDeck,
  designDeckVariants,
  getObservedArchetypesForFilters,
  getObservedArchetypesForUnit,
  normalizeDeckEvidence,
} from "../src/services/deckDesigner/index.js";
import { buildExBurstDeckText } from "../src/domain/deckExport.js";
import { parseMsaDeckList } from "../src/domain/deckLibrary.js";
import { evaluateMainDeckLegality } from "../src/domain/deckLegality.js";

test("current official legality rules reject Anksha, excess Corsica Base, and banned pairs", () => {
  const anksha = card("GD01-020", "Anksha", "Blue", "UNIT", 2, [], ["damage_push"], 60, 1);
  const corsica = card("ST02-016", "Corsica Base", "Blue", "BASE", 3, [], ["base_support"], 60, 5);
  const guntank = card("GD01-008", "Guntank", "Blue", "UNIT", 1, [], [], 60, 1);
  const shrike = card("GD05-015", "M1 Astray Shrike", "Blue", "UNIT", 1, [], [], 60, 1);
  const cardMap = new Map([anksha, corsica, guntank, shrike].map((item) => [item.cardNumber, item]));
  const legality = evaluateMainDeckLegality({
    "GD01-020": 1,
    "ST02-016": 3,
    "GD01-008": 4,
    "GD05-015": 4,
  }, cardMap, officialLegalityRules());

  assert.equal(legality.legal, false);
  assert.deepEqual(
    legality.violations.map((item) => item.type).sort(),
    ["banned_card", "banned_pair", "copy_limit"],
  );
});

test("research discards an otherwise winning source deck when it contains banned Anksha", () => {
  const data = fixtureData();
  const anksha = card("GD01-020", "Anksha", "Blue", "UNIT", 2, [], ["damage_push"], 60, 1);
  data.cards.push(anksha);
  Object.assign(data.rules, officialLegalityRules());
  replaceDeckCard(data, "deck-1", "TEST-001", anksha);

  const research = collectDeckResearch(data, baseCriteria());
  const reports = designDeckVariants(data, baseCriteria());

  assert.equal(research.facts.illegalDecklistsExcluded, 1);
  assert.ok(research.matchedDecks.every((candidate) => candidate.result.deckId !== "deck-1"));
  assert.ok(reports.every((report) => !report.main["GD01-020"]));
  assert.ok(reports.every((report) => report.legality.legal));
});

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

test("main unit exposes only archetypes observed with that unit", () => {
  const data = fixtureData();
  data.metaResults.find((result) => result.deckId === "deck-3").archetype = "The-O Blockers";

  const options = getObservedArchetypesForUnit(data, "Freedom Unit");

  assert.deepEqual(
    options.map((option) => [option.archetype, option.unitDecklists]),
    [["Freedom Blockers", 2], ["The-O Blockers", 1]],
  );
  assert.deepEqual(getObservedArchetypesForUnit(data, "Blue Vanguard"), [
    {
      archetype: "Freedom Blockers",
      unitDecklists: 2,
      unitRecentDecklists: 2,
      commonColorCombination: "Blue/White",
    },
    {
      archetype: "The-O Blockers",
      unitDecklists: 1,
      unitRecentDecklists: 1,
      commonColorCombination: "Blue/White",
    },
  ]);
  assert.deepEqual(getObservedArchetypesForUnit(data, "Unknown Unit"), []);
});

test("archetype options narrow by selected colors and main unit", () => {
  const data = fixtureData();
  data.metaResults[0].colorCombination = "Blue/White";
  data.metaResults[1].colorCombination = "Green/White";
  data.metaResults[2].colorCombination = "Green/White";
  data.metaResults[2].archetype = "The-O Blockers";

  assert.deepEqual(
    getObservedArchetypesForFilters(data, { colors: ["White", "Green"] })
      .map((option) => [option.archetype, option.matchingDecklists]),
    [["Freedom Blockers", 1], ["The-O Blockers", 1]],
  );
  assert.deepEqual(
    getObservedArchetypesForFilters(data, {
      unitQuery: "Freedom Unit",
      colors: ["Blue", "White"],
    }).map((option) => option.archetype),
    ["Freedom Blockers"],
  );
  assert.deepEqual(
    getObservedArchetypesForFilters(data, {
      unitQuery: "Freedom Unit",
      colors: ["Blue", "Green"],
    }),
    [],
  );
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

test("MSA paste import preserves the full list and analyzes curve, strengths and weaknesses", () => {
  const data = fixtureData();
  const sourceMain = Object.fromEntries(data.metaDeckCards
    .filter((row) => row.deckId === "deck-1")
    .map((row) => [row.cardNumber, Number(row.quantity)]));
  const msaText = [
    "Potter Test Deck",
    "",
    "Main Deck (50)",
    ...Object.entries(sourceMain).map(([cardNumber, quantity]) => {
      const cardItem = data.cards.find((item) => item.cardNumber === cardNumber);
      return `${quantity} ${cardItem.cardName} [${cardNumber}]`;
    }),
    "",
    "Resource Deck (10)",
    "10 Resource [R-001]",
  ].join("\n");

  const parsed = parseMsaDeckList(msaText);
  const report = analyzeImportedDeck(data, parsed);

  assert.equal(parsed.title, "Potter Test Deck");
  assert.equal(parsed.mainCount, 50);
  assert.equal(parsed.resourceCount, 10);
  assert.deepEqual(report.main, sourceMain);
  assert.equal(report.resource["R-001"], 10);
  assert.equal(report.assemblyMode, "msa_import");
  assert.equal(report.importedDeck.name, "Potter Test Deck");
  assert.equal(report.stats.mainCount, 50);
  assert.ok(report.stats.averageCost > 0);
  assert.ok(report.strengths.length);
  assert.ok(report.weaknesses.length);
  assert.equal(report.legality.legal, true);
});

test("MSA import supplies the standard resource deck when a valid main-only list is pasted", () => {
  const data = fixtureData();
  const sourceMain = Object.fromEntries(data.metaDeckCards
    .filter((row) => row.deckId === "deck-1")
    .map((row) => [row.cardNumber, Number(row.quantity)]));
  const parsed = parseMsaDeckList([
    "Main-only Potter Deck",
    "Main Deck (50)",
    ...Object.entries(sourceMain).map(([cardNumber, quantity]) => `${quantity}x${cardNumber}`),
  ].join("\n"));

  const report = analyzeImportedDeck(data, parsed);

  assert.equal(parsed.resourceCount, 0);
  assert.equal(report.importedDeck.pastedResourceCount, 0);
  assert.equal(report.importedDeck.resourceDefaulted, true);
  assert.deepEqual(report.resource, { "R-001": 10 });
  assert.equal(report.legality.legal, true);
  assert.ok(!report.legality.violations.some((item) => item.type === "resource_deck_size"));
});

test("MSA import still rejects a partially supplied resource deck", () => {
  const data = fixtureData();
  const sourceMain = Object.fromEntries(data.metaDeckCards
    .filter((row) => row.deckId === "deck-1")
    .map((row) => [row.cardNumber, Number(row.quantity)]));
  const parsed = parseMsaDeckList([
    "Incomplete resources",
    "Main Deck (50)",
    ...Object.entries(sourceMain).map(([cardNumber, quantity]) => `${quantity}x${cardNumber}`),
    "Resource Deck (10)",
    "9xR-001",
  ].join("\n"));

  const report = analyzeImportedDeck(data, parsed);

  assert.equal(report.importedDeck.resourceDefaulted, false);
  assert.equal(report.legality.legal, false);
  assert.ok(report.legality.violations.some((item) => item.type === "resource_deck_size"));
});

test("MSA parser accepts compact lines, preserves unknown entries and reports catalog misses", () => {
  const data = fixtureData();
  const parsed = parseMsaDeckList([
    "Compact list",
    "4xGD01-086",
    "2 TEST-001",
    "1 Unknown [ZZ99-999]",
    "Resource Deck (10)",
    "10xR-001",
  ].join("\n"));
  const report = analyzeImportedDeck(data, parsed);

  assert.equal(parsed.main["GD01-086"], 4);
  assert.equal(parsed.main["TEST-001"], 2);
  assert.equal(parsed.main["ZZ99-999"], 1);
  assert.equal(report.main["GD01-086"], 4);
  assert.equal(report.main["ZZ99-999"], 1);
  assert.match(buildExBurstDeckText(report), /1xZZ99-999/);
  assert.deepEqual(report.importedDeck.unknownMainCards, ["ZZ99-999"]);
  assert.equal(report.legality.legal, false);
  assert.ok(report.legality.violations.some((item) => item.type === "unknown_cards"));
});

test("deck analysis preserves printed LINK evidence for the visual map", () => {
  const data = fixtureData();
  data.generatedAt = "2026-07-30T12:00:00.000Z";
  const wing = data.cards.find((item) => item.cardNumber === "TEST-001");
  const heero = data.cards.find((item) => item.cardNumber === "TEST-005");
  wing.cardName = "Wing Gundam";
  wing.linkTargets = ["Heero Yuy"];
  wing.traits = ["Operation Meteor"];
  heero.cardName = "Heero Yuy";
  heero.traits = ["Operation Meteor"];
  const report = analyzeImportedDeck(data, parseMsaDeckList([
    "4xTEST-001",
    "4xTEST-005",
  ].join("\n")));
  const pair = report.synergies.find((item) => item.id === "TEST-001__TEST-005");

  assert.ok(pair);
  assert.equal(pair.rank, "high");
  assert.equal(pair.confidence, "High");
  assert.ok(pair.algorithmRules.includes("direct_link_pair"));
});

test("deck analysis retains every printed LINK instead of truncating to a global top eight", () => {
  const data = fixtureData();
  data.generatedAt = "2026-07-30T15:00:00.000Z";
  const heero = data.cards.find((item) => item.cardNumber === "TEST-014");
  heero.cardName = "Heero Yuy";
  heero.cardType = "PILOT";
  heero.traits = ["G Team", "Operation Meteor"];
  const targets = data.cards
    .filter((item) => /^TEST-00[1-9]$/.test(item.cardNumber))
    .slice(0, 9);
  targets.forEach((target, index) => {
    target.cardName = `Wing Test ${index + 1}`;
    target.cardType = "UNIT";
    target.traits = [index % 2 ? "Operation Meteor" : "G Team"];
    target.linkTargets = ["Heero Yuy"];
  });
  const report = analyzeImportedDeck(data, parseMsaDeckList([
    "1xTEST-014",
    ...targets.map((target) => `1x${target.cardNumber}`),
  ].join("\n")));
  const directHeeroLinks = report.synergies.filter((pair) =>
    pair.id.includes("TEST-014")
    && pair.algorithmRules.includes("direct_link_pair"));

  assert.equal(directHeeroLinks.length, targets.length);
  assert.ok(directHeeroLinks.every((pair) => pair.rank === "high"));
});

test("deck synergy consolidates same-name card variants and exposes suggested copies", () => {
  const data = fixtureData();
  const freedom = data.cards.find((item) => item.cardNumber === "TEST-001");
  freedom.linkTargets = ["Ace Pilot"];
  const freedomVariant = {
    ...freedom,
    cardNumber: "TEST-015",
    recentTop8DecksUsing: 18,
    recentMetaScore: 18,
  };
  data.cards.push(freedomVariant);
  const report = analyzeImportedDeck(data, parseMsaDeckList([
    "3xTEST-001",
    "1xTEST-015",
    "2xTEST-005",
  ].join("\n")));

  const pairs = report.synergies.filter((pair) =>
    new Set([pair.sourceCard.cardName, pair.targetCard.cardName]).has("Freedom Unit")
    && new Set([pair.sourceCard.cardName, pair.targetCard.cardName]).has("Ace Pilot"));

  assert.equal(pairs.length, 1);
  assert.equal(new Set(report.synergies.map((pair) => pair.displayPairKey)).size, report.synergies.length);
  assert.deepEqual(
    new Set([pairs[0].sourceCopies, pairs[0].targetCopies]),
    new Set([4, 2]),
  );
  assert.deepEqual(
    [...new Set([...pairs[0].sourceCardNumbers, ...pairs[0].targetCardNumbers])].sort(),
    ["TEST-001", "TEST-005", "TEST-015"],
  );
});

test("deck map keeps every same-name printed LINK variant as a separate edge", () => {
  const data = fixtureData();
  data.generatedAt = "2026-07-28T00:00:01.000Z";
  const unit = data.cards.find((item) => item.cardNumber === "TEST-001");
  const unitVariant = {
    ...unit,
    cardNumber: "TEST-015",
    recentTop8DecksUsing: 18,
    recentMetaScore: 18,
  };
  unit.cardName = "GQuuuuuuX (Omega Psycommu)";
  unit.cardType = "UNIT";
  unit.linkTargets = ["Amate Yuzuriha (Machu)"];
  unitVariant.cardName = unit.cardName;
  unitVariant.cardType = unit.cardType;
  unitVariant.linkTargets = ["Amate Yuzuriha (Machu)"];
  const pilot = data.cards.find((item) => item.cardNumber === "TEST-005");
  pilot.cardName = "Amate Yuzuriha (Machu)";
  pilot.cardType = "PILOT";
  pilot.traits = ["Clan"];
  data.cards.push(unitVariant);

  const report = analyzeImportedDeck(data, parseMsaDeckList([
    "1xTEST-001",
    "1xTEST-015",
    "1xTEST-005",
  ].join("\n")));
  const displayPairs = report.synergies.filter((pair) =>
    pair.displayPairKey.includes("amate yuzuriha machu"));
  const mapLinks = report.mapSynergies.filter((pair) =>
    pair.algorithmRules.includes("direct_link_pair")
    && pair.sourceCard.cardNumber === "TEST-005");

  assert.equal(displayPairs.length, 1);
  assert.deepEqual(
    mapLinks.map((pair) => pair.targetCard.cardNumber).sort(),
    ["TEST-001", "TEST-015"],
  );
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

function replaceDeckCard(data, deckId, sourceCardNumber, targetCard) {
  const row = data.metaDeckCards.find((item) =>
    item.deckId === deckId && item.cardNumber === sourceCardNumber);
  row.cardNumber = targetCard.cardNumber;
  row.cardName = targetCard.cardName;
  row.cardType = targetCard.cardType;
  row.cardColor = targetCard.color;
}

function officialLegalityRules() {
  return {
    mainDeckSize: 50,
    resourceDeckSize: 10,
    maxColors: 2,
    defaultCopyLimit: 4,
    legalityEffectiveDate: "2026-07-24",
    legalitySourceUrl: "https://www.gundam-gcg.com/en/news/01_279.html",
    currentRestrictions: [
      {
        cardNumber: "GD01-020",
        cardName: "Anksha",
        restrictionType: "Banned",
        maxCopies: 0,
      },
      {
        cardNumber: "ST02-016",
        cardName: "Corsica Base",
        restrictionType: "Restricted",
        maxCopies: 2,
      },
    ],
    bannedPairs: [{
      id: "guntank-m1-astray-shrike",
      cardNumbers: ["GD01-008", "GD05-015"],
    }],
    exclusiveCardGroups: [],
  };
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
