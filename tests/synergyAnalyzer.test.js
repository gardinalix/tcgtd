import assert from "node:assert/strict";
import test from "node:test";
import { calculateSynergies } from "../src/services/synergyAnalyzer.js";
import { mentionsAny } from "../src/services/synergyTextParser.js";

const lfrith = card({
  cardNumber: "GD01-086",
  cardName: "Gundam Lfrith",
  color: "White",
  cardType: "UNIT",
  cost: 2,
  traits: ["Vanadis Institute"],
  synergyTags: ["blocker"],
  effectPreview: "【Blocker】 (Rest this Unit to change the attack target to it.)",
  topArchetypes: [{ label: "Wing Zero" }, { label: "Justice Blockers" }],
});

const kira = card({
  cardNumber: "ST04-010",
  cardName: "Kira Yamato",
  color: "White",
  cardType: "PILOT",
  cost: 1,
  traits: ["Coordinator", "Earth Alliance"],
  synergyTags: ["ap_mod", "pair"],
  effectPreview: "【Attack】This Unit gets AP+1 during this turn.",
  topArchetypes: [{ label: "Wing Zero" }, { label: "Justice Blockers" }],
});

const wing = card({
  cardNumber: "GD01-040",
  cardName: "Wing Gundam",
  color: "Green",
  cardType: "UNIT",
  cost: 2,
  traits: ["Operation Meteor"],
  synergyTags: ["link"],
  linkTargets: ["Heero Yuy"],
  effectPreview: "【During Link】This Unit gets AP+1.",
});

const heero = card({
  cardNumber: "ST02-010",
  cardName: "Heero Yuy",
  color: "Green",
  cardType: "PILOT",
  cost: 1,
  traits: ["Operation Meteor"],
  synergyTags: ["ap_mod", "link", "pair"],
  effectPreview: "【Attack】This Unit gets AP+1 during this turn.",
});

const peacemillion = card({
  cardNumber: "GD03-125",
  cardName: "Peacemillion",
  color: "Green",
  cardType: "BASE",
  level: 6,
  cost: 1,
  traits: ["G Team", "Warship"],
  synergyTags: ["base_support", "damage_push", "recovery"],
  effectPreview: "During your turn, when a friendly (Operation Meteor)/(G Team) Unit that is Lv.6 or higher destroys an enemy Unit with battle damage, that friendly Unit may recover.",
});

const wingZero = card({
  cardNumber: "GD01-024",
  cardName: "Wing Gundam Zero",
  color: "Green",
  cardType: "UNIT",
  level: 8,
  cost: 8,
  traits: ["G Team"],
  synergyTags: ["damage_push", "link"],
  linkTargets: ["Heero Yuy"],
});

const wingLevelSix = card({
  cardNumber: "ST02-001",
  cardName: "Wing Gundam",
  color: "Green",
  cardType: "UNIT",
  level: 6,
  cost: 4,
  traits: ["Operation Meteor"],
  synergyTags: ["breach", "link"],
  linkTargets: ["Heero Yuy"],
});

const wingBirdMode = card({
  cardNumber: "ST02-002",
  cardName: "Wing Gundam (Bird Mode)",
  color: "Green",
  cardType: "UNIT",
  level: 3,
  cost: 3,
  traits: ["Operation Meteor"],
  synergyTags: ["link"],
  linkTargets: ["Heero Yuy"],
});

const whiteHeero = card({
  cardNumber: "GD05-098",
  cardName: "Heero Yuy",
  color: "White",
  cardType: "PILOT",
  level: 4,
  cost: 1,
  traits: ["G Team", "Operation Meteor"],
  synergyTags: ["ap_mod", "pair", "shield"],
  effectPreview: "When this Unit destroys an enemy shield area card with damage, choose 1 enemy Unit. It gets AP-2 during this turn.",
});

test("contextual co-play cannot turn Lfrith and Kira into high mechanical synergy", () => {
  const data = {
    cards: [lfrith, kira],
    metaDeckCards: commonDeckRows(lfrith.cardNumber, kira.cardNumber, 20),
  };

  const result = calculateSynergies(lfrith, data).find((item) => item.targetCardId === kira.cardNumber);

  assert.ok(result);
  assert.equal(result.rank, "low");
  assert.ok(result.score <= 39);
  assert.ok(result.coDeckCount >= 5);
  assert.equal(result.algorithmRules.includes("direct_link_pair"), false);
  assert.equal(result.algorithmRules.includes("text_bridge"), false);
  assert.equal(result.algorithmRules.includes("shared_keyword"), false);
  assert.match(result.explanation, /deck context only/);
  assert.match(result.explanation, /No direct mechanical bridge/);
});

test("a printed Wing Gundam to Heero link is always classified as high synergy", () => {
  const data = { cards: [wing, heero], metaDeckCards: [] };

  const result = calculateSynergies(wing, data).find((item) => item.targetCardId === heero.cardNumber);

  assert.ok(result);
  assert.equal(result.rank, "high");
  assert.ok(result.score >= 90);
  assert.ok(result.algorithmRules.includes("direct_link_pair"));
  assert.match(result.explanation, /Direct LINK\/PAIR bridge/);
});

test("Peacemillion targets only eligible Operation Meteor or G Team Units at Lv.6+", () => {
  const data = {
    cards: [peacemillion, wingZero, wingLevelSix, wingBirdMode, whiteHeero],
    metaDeckCards: [],
  };
  const results = calculateSynergies(peacemillion, data);
  const byId = new Map(results.map((item) => [item.targetCardId, item]));

  for (const eligibleId of [wingZero.cardNumber, wingLevelSix.cardNumber]) {
    const result = byId.get(eligibleId);
    assert.ok(result);
    assert.equal(result.rank, "high");
    assert.ok(result.algorithmRules.includes("text_bridge"));
    assert.ok(result.textBridgeSpecificity >= 4);
    assert.match(result.textBridgeLabel, /UNIT/);
    assert.match(result.textBridgeLabel, /Lv\.6\+/);
  }

  assert.equal(byId.get(wingBirdMode.cardNumber)?.algorithmRules.includes("text_bridge"), false);
  assert.equal(byId.get(whiteHeero.cardNumber)?.algorithmRules.includes("text_bridge"), false);
});

test("Tallgeese III keeps G Team atomic and does not treat Attack as a LINK trait", () => {
  const tallgeese = card({
    cardNumber: "GD05-070",
    cardName: "Tallgeese Ⅲ",
    color: "White",
    cardType: "UNIT",
    level: 5,
    cost: 3,
    traits: ["Preventer"],
    synergyTags: ["damage_push", "link"],
    linkTargets: ["Zechs Merquise"],
    effectPreview: "During your turn, when this Unit destroys an enemy Unit with battle damage, choose 1 of your rested (Preventer)/(G Team) Link Units. Set it as active. It can't attack during this turn.",
  });
  const gTeamUnit = card({
    cardNumber: "GTEAM-001",
    cardName: "G Team Unit",
    color: "White",
    cardType: "UNIT",
    traits: ["G Team"],
  });
  const gGenerationUnit = card({
    cardNumber: "GGEN-001",
    cardName: "G Generation Unit",
    color: "White",
    cardType: "UNIT",
    traits: ["G Generation"],
    linkTargets: ["(Attack) Trait"],
  });
  const results = calculateSynergies(tallgeese, {
    cards: [tallgeese, gTeamUnit, gGenerationUnit],
    metaDeckCards: [],
  });
  const byId = new Map(results.map((item) => [item.targetCardId, item]));

  assert.ok(byId.get(gTeamUnit.cardNumber)?.algorithmRules.includes("text_bridge"));
  assert.match(byId.get(gTeamUnit.cardNumber)?.textBridgeLabel || "", /G Team · UNIT/);
  assert.equal(Boolean(byId.get(gGenerationUnit.cardNumber)?.algorithmRules.includes("text_bridge")), false);
  assert.equal(Boolean(byId.get(gGenerationUnit.cardNumber)?.algorithmRules.includes("direct_link_pair")), false);
});

test("white Heero uses Wing's reverse printed LINK without inventing broad Unit text support", () => {
  const result = calculateSynergies(whiteHeero, {
    cards: [whiteHeero, wingZero],
    metaDeckCards: [],
  }).find((item) => item.targetCardId === wingZero.cardNumber);

  assert.ok(result);
  assert.equal(result.rank, "high");
  assert.ok(result.algorithmRules.includes("direct_link_pair"));
  assert.equal(result.algorithmRules.includes("text_bridge"), false);
  assert.match(result.explanation, /^High synergy: Direct LINK\/PAIR bridge/);
});

test("an exact robot name in printed text creates a highly specific bridge", () => {
  const namedSupport = card({
    cardNumber: "CMD-001",
    cardName: "Zero System Call",
    color: "Green",
    cardType: "COMMAND",
    cost: 2,
    synergyTags: ["ap_mod"],
    effectPreview: "Choose 1 Wing Gundam Zero. It gets AP+2 during this turn.",
  });
  const otherWing = card({
    cardNumber: "UNIT-OTHER",
    cardName: "Wing Gundam",
    color: "Green",
    cardType: "UNIT",
    cost: 4,
  });
  const results = calculateSynergies(namedSupport, {
    cards: [namedSupport, wingZero, otherWing],
    metaDeckCards: [],
  });
  const exact = results.find((item) => item.targetCardId === wingZero.cardNumber);
  const partial = results.find((item) => item.targetCardId === otherWing.cardNumber);

  assert.ok(exact);
  assert.equal(exact.rank, "high");
  assert.equal(exact.textBridgeSpecificity, 5);
  assert.match(exact.textBridgeLabel, /named Wing Gundam Zero/);
  assert.equal(partial?.algorithmRules.includes("text_bridge"), false);
});

test("text matching uses complete terms instead of substrings", () => {
  assert.deepEqual(mentionsAny("When this Unit is destroyed.", ["Red"]), []);
  assert.deepEqual(mentionsAny("Choose 1 red Unit.", ["Red"]), ["Red"]);
});

function commonDeckRows(leftCardNumber, rightCardNumber, count) {
  return Array.from({ length: count }, (_, index) => ([
    { deckId: `deck-${index + 1}`, cardNumber: leftCardNumber },
    { deckId: `deck-${index + 1}`, cardNumber: rightCardNumber },
  ])).flat();
}

function card(overrides) {
  return {
    cardNumber: "",
    cardName: "",
    color: "",
    cardType: "",
    cost: 0,
    level: 0,
    traits: [],
    synergyTags: [],
    linkTargets: [],
    effectPreview: "",
    topArchetypes: [],
    ...overrides,
  };
}
