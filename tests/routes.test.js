import test from "node:test";
import assert from "node:assert/strict";
import { parseRoute, routeFor } from "../src/domain/routes.js";

test("direct detail URLs preserve identifier case and encoded characters", () => {
  for (const view of ["card", "synergy", "synergyMap", "deckView", "eventDetail"]) {
    for (const id of ["GD05-081", "Mixed Case/ID"]) {
      assert.deepEqual(parseRoute({ pathname: routeFor(view, id) }), { view, id });
    }
  }
});

test("route names remain case insensitive while identifiers keep their case", () => {
  assert.deepEqual(parseRoute({ pathname: "/CARD/GD05-081/" }), { view: "card", id: "GD05-081" });
  assert.deepEqual(parseRoute({ pathname: "/EVENTS/Event-42" }), { view: "eventDetail", id: "Event-42" });
  assert.deepEqual(parseRoute({ pathname: "/COMMUNITY/PLAYERS" }), { view: "players", id: "" });
});
