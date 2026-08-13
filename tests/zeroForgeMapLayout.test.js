import assert from "node:assert/strict";
import test from "node:test";
import {
  buildForgeLayout,
  calculateForgeFitScroll,
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

test("ZERO Forge keeps full deck-card stacks separate inside the same cost lane", () => {
  const layout = buildForgeLayout([
    row("early-a", 2),
    row("early-b", 2),
    row("early-c", 2),
    row("early-d", 2),
    row("early-e", 2),
  ]);
  const firstRow = layout.positions.get("early-a");
  const secondRow = layout.positions.get("early-c");

  assert.ok(
    secondRow.y >= firstRow.y + 210,
    "the next pair starts after the full card stack plus a visible gutter",
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
  assert.ok(endpoints.y1 >= source.y && endpoints.y1 <= source.y + 190);
  assert.ok(endpoints.y2 >= target.y && endpoints.y2 <= target.y + 134);
});

test("ZERO Forge keeps desktop cards readable and starts from the lane headers", () => {
  const zoom = calculateForgeFitZoom({
    viewportWidth: 1208,
  });
  const narrowViewportZoom = calculateForgeFitZoom({ viewportWidth: 672 });
  const scroll = calculateForgeFitScroll({ viewportWidth: 672, zoom: narrowViewportZoom });

  assert.ok(zoom < 1, "a map wider than its panel must zoom out instead of clipping projections");
  assert.ok((1200 * zoom) <= 1176, "the full map width, including terminal cards, fits in the panel");
  assert.ok(narrowViewportZoom >= 0.6, "desktop maps preserve a readable scale even when vertical scrolling is needed");
  assert.ok(scroll.scrollLeft > 0, "the map remains horizontally centred at its readable scale");
  assert.equal(scroll.scrollTop, 0, "the map always opens on its cost-lane headers");
});
