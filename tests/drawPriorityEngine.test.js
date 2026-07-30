import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDrawPriorityPlan,
  drawModeForCard,
} from "../src/services/deckDesigner/drawPriorityEngine.js";

const showOfResolve = card({
  cardNumber: "GD01-100",
  cardName: "A Show of Resolve",
  cardType: "COMMAND",
  cost: 3,
  synergyTags: ["draw"],
  effectPreview: "【Main】Draw 2.",
});

const rows = [
  row(showOfResolve, 4, "flexible"),
  row(card({
    cardNumber: "DEF-001",
    cardName: "Early Blocker",
    cardType: "UNIT",
    cost: 2,
    synergyTags: ["blocker"],
  }), 4, "essential"),
  row(card({
    cardNumber: "FIN-001",
    cardName: "Late Finisher",
    cardType: "UNIT",
    cost: 5,
    synergyTags: ["breach", "damage_push"],
  }), 2, "essential"),
  row(card({
    cardNumber: "VAL-001",
    cardName: "Recursion Value",
    cardType: "COMMAND",
    cost: 3,
    synergyTags: ["draw", "recovery"],
  }), 3, "flexible"),
];

test("A Show of Resolve is explained as random draw and prioritizes early defense into pressure", () => {
  const earlyPlan = buildDrawPriorityPlan(
    showOfResolve,
    rows,
    { turn: 2, matchup: "Fast pressure shells" },
    graphFor(rows),
  );
  const latePlan = buildDrawPriorityPlan(
    showOfResolve,
    rows,
    { turn: 5, matchup: "Slow control / late-game shells" },
    graphFor(rows),
  );

  assert.equal(earlyPlan.mode, "draw");
  assert.equal(earlyPlan.title, "DRAW 2 · PRIORITY HITS");
  assert.match(earlyPlan.disclaimer, /does not search the deck/);
  assert.equal(earlyPlan.recommendations[0].card.cardNumber, "DEF-001");
  assert.equal(latePlan.recommendations[0].card.cardNumber, "FIN-001");
});

test("printed search constraints limit recommendations to eligible targets", () => {
  const searchCard = card({
    cardNumber: "SEARCH-001",
    cardName: "Operation Search",
    cardType: "COMMAND",
    cost: 2,
    synergyTags: ["search"],
    effectPreview: "Search your deck for up to 1 (Operation Meteor) Unit card that is Lv.4 or lower and add it to your hand.",
  });
  const wing = card({
    cardNumber: "WING-001",
    cardName: "Wing Gundam",
    cardType: "UNIT",
    cost: 3,
    level: 4,
    traits: ["Operation Meteor"],
  });
  const heero = card({
    cardNumber: "HEERO-001",
    cardName: "Heero Yuy",
    cardType: "PILOT",
    cost: 1,
    level: 4,
    traits: ["Operation Meteor"],
  });
  const unrelated = card({
    cardNumber: "UNIT-001",
    cardName: "Unrelated Unit",
    cardType: "UNIT",
    cost: 2,
    level: 3,
    traits: ["Earth Federation"],
  });
  const searchRows = [row(searchCard), row(wing), row(heero), row(unrelated)];

  const plan = buildDrawPriorityPlan(searchCard, searchRows, { turn: 3 }, graphFor(searchRows));

  assert.equal(plan.mode, "search");
  assert.equal(plan.recommendations.length, 1);
  assert.equal(plan.recommendations[0].card.cardNumber, "WING-001");
  assert.match(plan.disclaimer, /printed search constraints/);
});

test("cards without draw or search signals do not create tactical routes", () => {
  assert.equal(drawModeForCard(card({
    cardNumber: "PLAIN-001",
    cardName: "Plain Unit",
    cardType: "UNIT",
  })), "");
});

function row(cardItem, quantity = 4, category = "flexible") {
  return { card: cardItem, quantity, category };
}

function graphFor(deckRows) {
  return {
    nodes: deckRows.map((item, index) => ({
      id: item.card.cardNumber,
      degree: index === 0 ? 3 : 1,
      row: item,
    })),
    edges: [],
  };
}

function card(overrides = {}) {
  return {
    cardNumber: "",
    cardName: "",
    cardType: "",
    color: "Blue",
    cost: 0,
    level: 0,
    traits: [],
    synergyTags: [],
    effectPreview: "",
    recentTop8DecksUsing: 0,
    ...overrides,
  };
}
