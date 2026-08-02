import assert from "node:assert/strict";
import test from "node:test";
import {
  buildZeroForgeSaveReport,
  buildZeroForgeWorkspace,
  createZeroForgeDraftFromDesignerReport,
  describeZeroForgeCardState,
  evaluateZeroForgeAddition,
  prepareZeroForgeMsaImport,
} from "../src/services/deckDesigner/zeroForgeEngine.js";
import { parseMsaDeckList } from "../src/domain/deckLibrary.js";

test("ZERO Forge blocks banned cards, copy limits, banned pairs, color overflow and deck overflow", () => {
  const data = fixture();
  const anksha = cardById(data, "GD01-020");
  const corsica = cardById(data, "ST02-016");
  const amuro = cardById(data, "GD01-088");
  const greenUnit = cardById(data, "GREEN-001");

  assert.equal(evaluateZeroForgeAddition(data, {}, anksha).type, "banned_card");
  assert.equal(
    evaluateZeroForgeAddition(data, { "ST02-016": 2 }, corsica).type,
    "copy_limit",
  );
  assert.equal(
    evaluateZeroForgeAddition(data, { "ST03-011": 1 }, amuro).type,
    "banned_pair",
  );
  assert.equal(
    evaluateZeroForgeAddition(data, { "ANCHOR-001": 1, "RED-001": 1 }, greenUnit).type,
    "color_limit",
  );

  const fullDeck = { "ANCHOR-001": 50 };
  assert.equal(evaluateZeroForgeAddition(data, fullDeck, cardById(data, "PILOT-001")).type, "main_deck_size");
});

test("ZERO Forge promotes printed links and removes illegal ghosts from suggestions", () => {
  const data = fixture();
  const workspace = buildZeroForgeWorkspace(data, { "ANCHOR-001": 1, "ST03-011": 1 }, "ANCHOR-001");

  assert.equal(workspace.suggestions[0].card.cardNumber, "PILOT-001");
  assert.match(workspace.suggestions[0].reasons.join(" "), /Printed LINK\/PAIR/);
  assert.ok(!workspace.suggestions.some((item) => item.card.cardNumber === "GD01-020"));
  assert.ok(!workspace.suggestions.some((item) => item.card.cardNumber === "GD01-088"));
  assert.ok(workspace.curve.some((bucket) => bucket.need > 0));
  assert.ok(workspace.roles.some((role) => role.id === "pressure"));
});

test("ZERO Forge distinguishes a legal card in a full deck from a real rule violation", () => {
  const data = fixture();
  data.rules.mainDeckSize = 8;
  const fullMain = {
    "ANCHOR-001": 3,
    "PILOT-001": 4,
    "DRAW-001": 1,
  };
  const workspace = buildZeroForgeWorkspace(data, fullMain, "ANCHOR-001");

  const legalInDeck = describeZeroForgeCardState(
    workspace,
    fullMain,
    cardById(data, "ANCHOR-001"),
  );
  assert.equal(legalInDeck.status, "IN DECK · LEGAL");
  assert.match(legalInDeck.detail, /Main deck full/);
  assert.equal(legalInDeck.className, "is-deck");

  const copyLimit = describeZeroForgeCardState(
    workspace,
    fullMain,
    cardById(data, "PILOT-001"),
  );
  assert.equal(copyLimit.status, "IN DECK · COPY LIMIT");
  assert.equal(copyLimit.className, "is-limit");

  const capacity = describeZeroForgeCardState(
    workspace,
    fullMain,
    cardById(data, "RED-001"),
  );
  assert.equal(capacity.status, "DECK CAPACITY REACHED");
  assert.equal(capacity.className, "is-limit");

  const illegalMain = { "GD01-020": 1 };
  const illegalWorkspace = buildZeroForgeWorkspace(data, illegalMain, "GD01-020");
  const violation = describeZeroForgeCardState(
    illegalWorkspace,
    illegalMain,
    cardById(data, "GD01-020"),
  );
  assert.equal(violation.status, "RULE VIOLATION");
  assert.equal(violation.className, "is-locked");
});

test("ZERO Forge reports live card-type quantities", () => {
  const workspace = buildZeroForgeWorkspace(fixture(), {
    "ANCHOR-001": 3,
    "PILOT-001": 2,
    "DRAW-001": 4,
    "ST02-016": 1,
  });

  assert.deepEqual(
    Object.fromEntries(workspace.composition.map((item) => [item.type, item.count])),
    {
      UNIT: 3,
      PILOT: 2,
      COMMAND: 4,
      BASE: 1,
    },
  );
});

test("ZERO Forge saves a pilot-authored draft with an automatic resource deck", () => {
  const data = fixture();
  const report = buildZeroForgeSaveReport(data, { "ANCHOR-001": 4 }, { title: "Potter Forge" });

  assert.equal(report.title, "Potter Forge");
  assert.equal(report.assemblyMode, "zero_forge");
  assert.equal(report.main["ANCHOR-001"], 4);
  assert.equal(report.resource["R-001"], 10);
  assert.equal(report.rows[0].source, "zero_forge");
  assert.equal(report.legality.legal, false);
  assert.ok(report.legality.issues.some((item) => /Current: 4/.test(item)));
  assert.ok(report.limitations.some((item) => /Current: 4/.test(item)));
});

test("Designer recommendations enter ZERO Forge as complete editable drafts", () => {
  const report = {
    generatedAt: "2026-08-01T12:00:00.000Z",
    title: "Barbatos Rush",
    main: { "ANCHOR-001": 4, "PILOT-001": 4 },
    resource: { "R-001": 10 },
    selectedMetaId: "current",
    criteria: { archetype: "Barbatos Rush", colors: ["Blue", "Purple"] },
    legality: { legal: true },
    sourceDeck: {
      deckId: "deck-source",
      resultId: "result-source",
      playerName: "Pilot Test",
      eventName: "Test Event",
    },
  };
  const draft = createZeroForgeDraftFromDesignerReport(report);

  assert.deepEqual(draft.main, report.main);
  assert.notEqual(draft.main, report.main);
  assert.deepEqual(draft.resource, report.resource);
  assert.equal(draft.name, "Barbatos Rush");
  assert.equal(draft.selectedMetaId, "current");
  assert.equal(draft.sourceMetadata.sourceType, "deck_designer");
  assert.equal(draft.sourceMetadata.sourceTournamentDeckId, "deck-source");
  assert.deepEqual(draft.originalMain, report.main);
});

test("ZERO Forge imports an MSA list for editing and preserves recognized resources", () => {
  const data = fixture();
  const parsed = parseMsaDeckList(`Imported Forge Deck

Main Deck (9)
4 Wing Test [ANCHOR-001]
4 Heero Test [PILOT-001]
1 Unknown Test [ZZ99-999]

Resource Deck (10)
10 Resource [R-001]`);
  const imported = prepareZeroForgeMsaImport(data, parsed);

  assert.equal(imported.title, "Imported Forge Deck");
  assert.deepEqual(imported.main, { "ANCHOR-001": 4, "PILOT-001": 4 });
  assert.deepEqual(imported.resource, { "R-001": 10 });
  assert.equal(imported.recognizedMainCount, 8);
  assert.deepEqual(imported.unknownMainCards, ["ZZ99-999"]);
  assert.equal(imported.canImport, true);

  const report = buildZeroForgeSaveReport(data, imported.main, {
    title: imported.title,
    resource: imported.resource,
    importedFromMsa: true,
  });
  assert.deepEqual(report.resource, { "R-001": 10 });
  assert.equal(report.forgeOrigin, "msa_import");
  assert.match(report.strategy, /Imported from MSA and edited in ZERO Forge/);

  const incompleteResources = prepareZeroForgeMsaImport(data, {
    ...parsed,
    resource: { "R-001": 9 },
    resourceCount: 9,
  });
  assert.deepEqual(incompleteResources.resource, {});
  assert.match(incompleteResources.resourceWarning, /standard resource deck/);
});

function fixture() {
  const cards = [
    makeCard("ANCHOR-001", "Wing Test", "White", "UNIT", 4, ["G Team"], ["damage_push"], ["Heero Test"], 20),
    makeCard("PILOT-001", "Heero Test", "White", "PILOT", 1, ["G Team"], ["draw"], [], 18),
    makeCard("ST03-011", "Mika Test", "White", "PILOT", 2, [], ["ap_mod"], [], 12),
    makeCard("GD01-088", "Amuro Test", "White", "PILOT", 2, [], ["draw"], [], 20),
    makeCard("GD01-020", "Anksha", "Blue", "UNIT", 2, [], ["damage_push"], [], 60),
    makeCard("ST02-016", "Corsica Base", "White", "BASE", 3, [], ["base_support"], [], 40),
    makeCard("RED-001", "Red Unit", "Red", "UNIT", 2, [], ["blocker"], [], 8),
    makeCard("GREEN-001", "Green Unit", "Green", "UNIT", 2, [], ["removal"], [], 8),
    makeCard("DRAW-001", "Resolve Test", "White", "COMMAND", 1, [], ["draw"], [], 30),
  ];
  return {
    cards,
    resourceCards: [{ cardNumber: "R-001", cardName: "Resource", cardType: "RESOURCE", copyLimit: 99 }],
    metaDeckCards: [
      { deckId: "deck-a", cardNumber: "ANCHOR-001" },
      { deckId: "deck-a", cardNumber: "PILOT-001" },
      { deckId: "deck-b", cardNumber: "ANCHOR-001" },
      { deckId: "deck-b", cardNumber: "PILOT-001" },
      { deckId: "deck-a", cardNumber: "DRAW-001" },
    ],
    rules: {
      mainDeckSize: 50,
      resourceDeckSize: 10,
      maxColors: 2,
      defaultCopyLimit: 4,
      currentRestrictions: [
        { cardNumber: "GD01-020", restrictionType: "banned", maxCopies: 0 },
        { cardNumber: "ST02-016", restrictionType: "limited", maxCopies: 2 },
      ],
      bannedPairs: [{
        cardNumbers: ["GD01-088", "ST03-011"],
      }],
    },
  };
}

function makeCard(cardNumber, cardName, color, cardType, cost, traits, synergyTags, linkTargets, recentTop8DecksUsing) {
  return {
    cardNumber,
    cardName,
    color,
    cardType,
    cost,
    level: cost,
    traits,
    synergyTags,
    linkTargets,
    recentTop8DecksUsing,
    copyLimit: 4,
    effectPreview: "",
    topArchetypes: [],
  };
}

function cardById(data, cardNumber) {
  return data.cards.find((card) => card.cardNumber === cardNumber);
}
