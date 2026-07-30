import assert from "node:assert/strict";
import test from "node:test";
import { buildDeckGraph, relatedNodeIds } from "../src/services/deckDesigner/deckMapLayout.js";

const rows = [
  row("A", "essential", ["Gundam"], ["blocker"], 3),
  row("B", "flexible", ["Gundam"], ["blocker"], 4),
  row("C", "flexible", ["Earth Alliance"], ["draw"], 2),
  row("D", "experimental", ["Zeon"], ["pressure"], 5),
];

test("deck graph includes every unique recommended card and keeps nodes in bounds", () => {
  const graph = buildDeckGraph(rows, []);
  assert.equal(graph.nodes.length, 4);
  assert.deepEqual(new Set(graph.nodes.map((node) => node.id)), new Set(["A", "B", "C", "D"]));
  assert.ok(graph.nodes.every((node) => node.x >= 7 && node.x <= 93 && node.y >= 7 && node.y <= 93));
  assert.ok(graph.edges.length >= 3);
});

test("competitive synergy edges remain observed and drive related-node focus", () => {
  const graph = buildDeckGraph(rows, [{
    sourceCard: rows[0].card,
    targetCard: rows[2].card,
    score: 88,
    rank: "high",
    coDeckCount: 7,
    algorithmRules: ["direct_link_pair"],
    explanation: "High synergy: direct LINK/PAIR bridge.",
  }]);
  const observed = graph.edges.find((edge) => edge.id === "A__C");
  assert.equal(observed.kind, "observed");
  assert.equal(observed.strength, "high");
  assert.equal(observed.basis, "PRINTED LINK / PAIR");
  assert.match(observed.label, /direct LINK\/PAIR/);
  assert.deepEqual(relatedNodeIds(graph, "A").has("C"), true);
});

test("context-only co-play remains visibly low and does not masquerade as a mechanic", () => {
  const graph = buildDeckGraph(rows, [{
    sourceCard: rows[0].card,
    targetCard: rows[2].card,
    score: 39,
    rank: "low",
    coDeckCount: 12,
    algorithmRules: ["competitive_cooccurrence", "same_color", "curve_support"],
    explanation: "Low synergy: appears together in 12 decklists.",
  }]);
  const contextual = graph.edges.find((edge) => edge.id === "A__C");
  assert.equal(contextual.kind, "observed");
  assert.equal(contextual.strength, "low");
  assert.equal(contextual.basis, "CO-PLAY · 12 LISTS");
});

test("the highest-degree card occupies the central command position", () => {
  const graph = buildDeckGraph(rows, [
    { sourceCard: rows[0].card, targetCard: rows[1].card, score: 90, coDeckCount: 5 },
    { sourceCard: rows[0].card, targetCard: rows[2].card, score: 80, coDeckCount: 3 },
  ]);
  const center = graph.nodes.find((node) => node.x === 50 && node.y === 50);
  assert.equal(center.id, "A");
});

function row(cardNumber, category, traits, synergyTags, cost) {
  return {
    quantity: 4,
    category,
    confidenceValue: category === "essential" ? 0.95 : 0.65,
    card: {
      cardNumber,
      cardName: `Card ${cardNumber}`,
      cardType: "UNIT",
      color: "Blue",
      cost,
      traits,
      synergyTags,
    },
  };
}
