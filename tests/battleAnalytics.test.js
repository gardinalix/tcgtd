import assert from "node:assert/strict";
import test from "node:test";
import { buildBattleAnalytics, wilsonInterval } from "../src/domain/battleAnalytics.js";

const game = (id, overrides = {}) => ({ id, sourceId: "msa-public", playedAt: "2026-09-01T12:00:00Z", season: "s1", mode: "Ranked", ended: true, winnerSeat: 0, players: [{ archetype: "A" }, { archetype: "B" }], ...overrides });
test("Wilson uses the actual binomial interval, with null for absent evidence", () => {
  const ci = wilsonInterval(50, 100);
  assert.ok(Math.abs(ci.low - .4038315) < .000001);
  assert.ok(Math.abs(ci.high - .5961685) < .000001);
  assert.equal(wilsonInterval(0, 0), null);
  assert.equal(wilsonInterval(2, 1), null);
  assert.equal(wilsonInterval(1.5, 2), null);
});
test("share counts both seats; draws stay visible and leave the decisive win-rate denominator", () => {
  const report = buildBattleAnalytics([game("a"), game("b", { winnerSeat: 1 }), game("c", { winnerSeat: "draw" })], { sourceId: "msa-public", minimumGames: 2 });
  assert.equal(report.games, 3);
  assert.equal(report.appearances, 6);
  assert.ok(report.archetypes.every(row => row.share === .5 && row.winRate === .5 && row.draws === 1 && row.eligible));
  assert.equal(report.matchups.length, 2);
  assert.deepEqual(report.daily, [{ date: "2026-09-01", games: 3 }]);
});
test("exclude mirrors, missing dates and unclassified opponents; never merge other sources or modes", () => {
  const matches = [game("ok"), game("mirror", { players: [{ archetype: "A" }, { archetype: "A" }] }), game("no-date", { playedAt: null, firstObservedAt: "2026-09-01" }), game("unknown", { players: [{ archetype: "A" }, { archetype: "Other" }] }), game("other", { sourceId: "paper" }), game("casual", { mode: "Casual" }), game("future", { playedAt: "2026-10-01T00:00:00Z" })];
  const result = buildBattleAnalytics(matches, { sourceId: "msa-public", endDate: "2026-09-30" });
  assert.equal(result.games, 1);
  assert.deepEqual(result.excluded, { conflicts: 0, incomplete: 2, outsideScope: 1, unclassified: 1, mirrors: 1 });
  assert.ok(result.archetypes.every(row => !row.eligible));
  assert.equal(buildBattleAnalytics([matches[1]], { sourceId: "msa-public", excludeMirrors: false }).archetypes[0].winRate, .5);
});
test("duplicate IDs are counted once; conflicting duplicates are quarantined", () => {
  const result = buildBattleAnalytics([game("a"), game("a"), game("b"), game("b", { winnerSeat: 1 })], { sourceId: "msa-public" });
  assert.equal(result.games, 1);
  assert.equal(result.duplicates, 2);
  assert.equal(result.excluded.conflicts, 1);
  assert.throws(() => buildBattleAnalytics([]), /source/);
  assert.throws(() => buildBattleAnalytics([], { sourceId: "msa", startDate: "2026-09-10", endDate: "2026-09-01" }), /date/);
});
test("invalid scope parameters cannot silently change the reporting population", () => {
  for (const startDate of ["2026-02-30", "2026-09-01junk", ""]) assert.throws(() => buildBattleAnalytics([], { sourceId: "msa", startDate }), /date/);
  for (const minimumGames of [0, -1, 1.5, NaN]) assert.throws(() => buildBattleAnalytics([], { sourceId: "msa", minimumGames }), /positive integer/);
  assert.equal(buildBattleAnalytics([null, game("null-player", { players: [null, { archetype: "A" }] })], { sourceId: "msa-public" }).excluded.unclassified, 1);
});
