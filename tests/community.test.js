import assert from "node:assert/strict";
import test from "node:test";
import { buildCommunitySnapshot } from "../src/domain/community.js";
import { parseRoute, routeFor } from "../src/domain/routes.js";

test("community snapshot aggregates observed players without inventing geography", () => {
  const data = {
    metaEvents: [
      { eventId: "e1", eventName: "Weekly", eventDate: "2026-08-01", organizer: "Local Store", sourceName: "Source" },
      { eventId: "e2", eventName: "Online Cup", eventDate: "2026-08-05", organizer: "Remote Org", sourceName: "Source" },
    ],
    metaResults: [
      { resultId: "r1", eventId: "e1", eventDate: "2026-08-01", playerName: "Pilot A", placingRank: "1", archetype: "Blue", sourceName: "Source" },
      { resultId: "r2", eventId: "e2", eventDate: "2026-08-05", playerName: "Pilot A", placingRank: "4", archetype: "White", sourceName: "Source" },
      { resultId: "r3", eventId: "e2", eventDate: "2026-08-05", playerName: "Pilot B", placingRank: "1", archetype: "Red", sourceName: "Source" },
    ],
  };

  const snapshot = buildCommunitySnapshot(data);
  assert.equal(snapshot.coverage.events, 2);
  assert.equal(snapshot.coverage.results, 3);
  assert.equal(snapshot.coverage.players, 2);
  assert.equal(snapshot.coverage.venues, 2);
  assert.equal(snapshot.coverage.geographicEvents, 0);
  assert.equal(snapshot.players[0].displayName, "Pilot A");
  assert.equal(snapshot.players[0].eventCount, 2);
  assert.equal(snapshot.players[0].wins, 1);
  assert.equal(snapshot.players[0].topCuts, 2);
  assert.equal(snapshot.players[0].bandaiLinked, false);
});

test("community routes preserve the event archive and legacy event links", () => {
  assert.deepEqual(parseRoute({ pathname: "/community", search: "", hash: "" }), { view: "community", id: "" });
  assert.deepEqual(parseRoute({ pathname: "/community/players", search: "", hash: "" }), { view: "players", id: "" });
  assert.deepEqual(parseRoute({ pathname: "/community/stores", search: "", hash: "" }), { view: "venues", id: "" });
  assert.deepEqual(parseRoute({ pathname: "/community/events/event-42", search: "", hash: "" }), { view: "eventDetail", id: "event-42" });
  assert.deepEqual(parseRoute({ pathname: "/events/event-42", search: "", hash: "" }), { view: "eventDetail", id: "event-42" });
  assert.equal(routeFor("eventDetail", "event-42"), "/community/events/event-42");
});
