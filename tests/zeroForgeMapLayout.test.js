import assert from "node:assert/strict";
import test from "node:test";
import {
  buildForgeLayout,
  calculateForgeFitZoom,
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

test("ZERO Forge puts every projected card in a compact, non-overlapping terminal grid", () => {
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

  assert.deepEqual(projections.map(({ x }) => x), [864, 1032, 864]);
  assert.equal(projections[0].y, projections[1].y, "the first terminal row keeps two readable additions together");
  assert.ok(
    projections[2].y >= projections[0].y + 154,
    "the next terminal row leaves a visible gap instead of overlapping",
  );
});

test("ZERO Forge synergy wires stop at the visible edges of their cards", () => {
  const layout = buildForgeLayout(
    [row("anchor", 2)],
    [suggestion("projection", "anchor", 1)],
    "anchor",
  );
  const source = layout.positions.get("anchor");
  const target = layout.positions.get("ghost:projection");

  const endpoints = forgeLinkEndpoints(source, target, "anchor", "ghost:projection");
  assert.equal(endpoints.x1, source.x + 108, "the wire exits through the source card's right edge");
  assert.equal(endpoints.x2, target.x, "the wire terminates at the suggestion card's left edge");
  assert.ok(endpoints.y1 >= source.y && endpoints.y1 <= source.y + 152);
  assert.ok(endpoints.y2 >= target.y && endpoints.y2 <= target.y + 134);
});

test("ZERO Forge initially frames the complete projection column inside the viewport", () => {
  const zoom = calculateForgeFitZoom({
    viewportWidth: 1208,
    viewportHeight: 720,
    stageHeight: 820,
  });

  assert.ok(zoom < 1, "a map wider than its panel must zoom out instead of clipping projections");
  assert.ok((1200 * zoom) <= 1176, "the full map width, including terminal cards, fits in the panel");
  assert.ok((820 * zoom) <= 688, "the framed projection grid fits vertically when space allows");
});
