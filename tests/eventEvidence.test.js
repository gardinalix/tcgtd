import assert from "node:assert/strict";
import test from "node:test";
import { resolveEventWinner } from "../src/domain/eventEvidence.js";
import { buildMetaCoverage } from "../src/domain/metaCoverage.js";

test("partial standings and conflicting first places cannot manufacture a single champion", () => {
  const runnerUp = { placingRank: 2, playerName: "B" };
  assert.deepEqual(resolveEventWinner([runnerUp]), { winner: null, status: "missing" });
  const champion = { placingRank: 1, playerName: "A" };
  assert.equal(resolveEventWinner([runnerUp, champion]).winner, champion);
  assert.deepEqual(resolveEventWinner([champion, { placingRank: 1, playerName: "C" }]), { winner: null, status: "conflicting" });
});

test("coverage surfaces ambiguous events while keeping source records inspectable", () => {
  const data = { metaResults: ["a", "b"].map(resultId => ({ resultId, eventId: "event", eventDate: "2026-09-01", placingRank: 1 })) };
  const coverage = buildMetaCoverage(data);
  assert.equal(coverage.ambiguousEventCount, 1);
  assert.equal(coverage.results.length, 2);
});
