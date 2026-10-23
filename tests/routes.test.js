import assert from "node:assert/strict";
import test from "node:test";
import { parseRoute, routeFor } from "../src/domain/routes.js";

function parse(pathname) { return parseRoute({ pathname, search: "", hash: "" }); }

test("card and synergy links preserve case-sensitive card identifiers on reload", () => {
  for (const view of ["card", "synergy", "synergyMap"]) {
    const id = "GD05-081_p1";
    assert.deepEqual(parse(routeFor(view, id)), { view, id });
  }
});

test("deck and event links round-trip identifiers without changing their case", () => {
  for (const view of ["deckView", "eventDetail"]) {
    const id = "Event-Deck A/42";
    assert.deepEqual(parse(routeFor(view, id)), { view, id });
  }
});

test("route names remain case-insensitive while identifiers preserve their original spelling", () => {
  assert.deepEqual(parse("/CARD/GD05-081/"), { view: "card", id: "GD05-081" });
  assert.deepEqual(parse("/COMMUNITY/EVENTS/OpenCup"), { view: "eventDetail", id: "OpenCup" });
  assert.deepEqual(parse("/SETTINGS/ACCOUNT"), { view: "accountSettings", id: "" });
});
