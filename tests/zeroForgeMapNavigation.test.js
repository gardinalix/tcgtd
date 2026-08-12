import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateMapRevealScroll } from "../src/services/deckDesigner/zeroForgeMapNavigation.js";

test("ZERO Forge map is isolated from page-level main element rules", () => {
  const source = readFileSync(new URL("../src/components/decks/ZeroForge.jsx", import.meta.url), "utf8");

  assert.match(source, /<section\s+className=\{`zero-forge-map/);
  assert.doesNotMatch(source, /<main\s+className=\{`zero-forge-map/);
  assert.match(source, /createPortal\(/);
});

test("ZERO Forge keeps an already visible added card in place", () => {
  assert.deepEqual(calculateMapRevealScroll({
    position: { x: 240, y: 180 },
    nodeSize: { width: 108, height: 152 },
    viewportWidth: 900,
    viewportHeight: 600,
    scrollLeft: 100,
    scrollTop: 80,
    padding: 56,
  }), {
    scrollLeft: 100,
    scrollTop: 80,
  });
});

test("ZERO Forge reveals a card added outside the current pan position", () => {
  assert.deepEqual(calculateMapRevealScroll({
    position: { x: 78, y: 86 },
    nodeSize: { width: 108, height: 152 },
    viewportWidth: 720,
    viewportHeight: 480,
    scrollLeft: 760,
    scrollTop: 420,
    padding: 56,
  }), {
    scrollLeft: 22,
    scrollTop: 30,
  });
});

test("ZERO Forge reveal calculations account for map zoom", () => {
  assert.deepEqual(calculateMapRevealScroll({
    position: { x: 864, y: 500 },
    nodeSize: { width: 108, height: 152 },
    zoom: 1.5,
    viewportWidth: 800,
    viewportHeight: 500,
    scrollLeft: 0,
    scrollTop: 0,
    padding: 40,
  }), {
    scrollLeft: 698,
    scrollTop: 518,
  });
});
