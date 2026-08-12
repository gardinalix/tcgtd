import assert from "node:assert/strict";
import test from "node:test";
import { buildCalendarDays, buildObservedWeeklies } from "../src/domain/calendar.js";
import { buildCommunitySnapshot } from "../src/domain/community.js";
import { calendarRange, confirmedWeeklies, materializeStoreSchedules } from "../src/domain/communitySchedules.js";
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
  assert.deepEqual(parseRoute({ pathname: "/community/schedules", search: "", hash: "" }), { view: "scheduleManager", id: "" });
  assert.deepEqual(parseRoute({ pathname: "/community/events/event-42", search: "", hash: "" }), { view: "eventDetail", id: "event-42" });
  assert.deepEqual(parseRoute({ pathname: "/events/event-42", search: "", hash: "" }), { view: "eventDetail", id: "event-42" });
  assert.equal(routeFor("eventDetail", "event-42"), "/community/events/event-42");
});

test("store calendar renders a complete six-week month grid", () => {
  const events = [
    { eventId: "e1", eventDate: "2026-08-03", organizer: "Moki Toys" },
    { eventId: "e2", eventDate: "2026-08-10", organizer: "Moki Toys" },
  ];
  const days = buildCalendarDays(2026, 7, events);

  assert.equal(days.length, 42);
  assert.equal(days[0].dateKey, "2026-07-26");
  assert.equal(days.at(-1).dateKey, "2026-09-05");
  assert.equal(days.find((day) => day.dateKey === "2026-08-03").events[0].eventId, "e1");
});

test("weekly store patterns require three consecutive indexed weeks", () => {
  const events = [
    { eventId: "e1", eventDate: "2026-07-20", organizer: "Moki Toys" },
    { eventId: "e2", eventDate: "2026-07-27", organizer: "Moki Toys" },
    { eventId: "e3", eventDate: "2026-08-03", organizer: "Moki Toys" },
    { eventId: "e4", eventDate: "2026-08-10", organizer: "Moki Toys" },
    { eventId: "x1", eventDate: "2026-08-02", organizer: "One-off Store" },
    { eventId: "x2", eventDate: "2026-08-23", organizer: "One-off Store" },
    { eventId: "x3", eventDate: "2026-09-13", organizer: "One-off Store" },
  ];
  const weeklies = buildObservedWeeklies(events);

  assert.equal(weeklies.length, 1);
  assert.equal(weeklies[0].organizer, "Moki Toys");
  assert.equal(weeklies[0].weekday, 1);
  assert.equal(weeklies[0].longestWeeklyRun, 4);
});

test("organizer-confirmed schedules populate every matching week and honor exceptions", () => {
  const schedules = [{
    id: "schedule-moki-monday",
    active: true,
    venueName: "Moki Toys",
    city: "Sao Paulo",
    country: "Brazil",
    name: "Gundam Card Game Weekly",
    weekday: 1,
    startTime: "19:30",
    formatName: "Standard",
    startDate: "2026-08-01",
  }];
  const events = materializeStoreSchedules({
    schedules,
    exceptions: [
      { scheduleId: "schedule-moki-monday", occurrenceDate: "2026-08-10", kind: "cancelled" },
      { scheduleId: "schedule-moki-monday", occurrenceDate: "2026-08-17", kind: "override", name: "Store Championship", startTime: "14:00" },
    ],
    from: "2026-08-01",
    to: "2026-08-31",
  });

  assert.deepEqual(events.map((event) => event.eventDate), ["2026-08-03", "2026-08-17", "2026-08-24", "2026-08-31"]);
  assert.equal(events[1].eventName, "Store Championship");
  assert.equal(events[1].startTime, "14:00");
  assert.equal(events[1].calendarKind, "schedule-override");
  assert.deepEqual(confirmedWeeklies(schedules)[0], {
    id: "schedule-moki-monday",
    organizer: "Moki Toys",
    name: "Gundam Card Game Weekly",
    weekday: 1,
    startTime: "19:30",
    formatName: "Standard",
    status: "confirmed",
  });
  assert.deepEqual(calendarRange(2026, 7), { from: "2026-07-26", to: "2026-09-05" });
});
