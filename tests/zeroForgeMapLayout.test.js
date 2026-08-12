import assert from "node:assert/strict";
import test from "node:test";
import {
  buildForgeLayout,
  forgeLinkEndpoints,
} from "../src/services/deckDesigner/zeroForgeMapLayout.js";

function row(cardNumber, cost, cardName = cardNumber) {
  return {
    card: { cardNumber, cardName, cardType: "UNIT", cost },
    quantity: 1,
  };
}

function suggestion(cardNumber, bestSourceCardNumber, rank) {
  return {
    card: { cardNumber, cardName: cardNumber },
    bestSourceCardNumber,
    rank,
  };
}

test("ZERO Forge puts every projected card in a non-overlapping terminal column", () => {
  const layout = buildForgeLayout(
    [row("anchor-a", 2), row("anchor-b", 2), row("anchor-c", 2)],
    [
      suggestion("projection-a", "anchor-a", 1),
      suggestion("projection-b", "anchor-c", 2),
      suggestion("projection-c", "anchor-c", 3),
    ],
    "anchor-a",
  );
  const projections = ["projection-a", "projection-b", "projection-c"]
    .map((cardNumber) => layout.positions.get(`ghost:${cardNumber}`));

  assert.deepEqual(projections.map(({ x }) => x), [1156, 1156, 1156]);
  for (let index = 1; index < projections.length; index += 1) {
    assert.ok(
      projections[index].y >= projections[index - 1].y + 154,
      "terminal cards must have a visual gap instead of overlapping",
    );
  }
  assert.ok(projections[0].y < projections[1].y, "projections follow the vertical order of their source cards");
});

test("ZERO Forge synergy wires stop at the visible edges of their cards", () => {
  const layout = buildForgeLayout(
    [row("anchor", 2)],
    [suggestion("projection", "anchor", 1)],
    "anchor",
  );
  const source = layout.positions.get("anchor");
  const target = layout.positions.get("ghost:projection");

  assert.deepEqual(
    forgeLinkEndpoints(source, target, "anchor", "ghost:projection"),
    { x1: 186, y1: 162, x2: 1156, y2: 162 },
  );
});
