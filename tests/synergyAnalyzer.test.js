import assert from "node:assert/strict";
import test from "node:test";
import { calculateSynergies } from "../src/services/synergyAnalyzer.js";

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
    traits: [],
    synergyTags: [],
    linkTargets: [],
    effectPreview: "",
    topArchetypes: [],
    ...overrides,
  };
}
