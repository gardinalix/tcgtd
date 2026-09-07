import assert from "node:assert/strict";
import test from "node:test";
import { parseMsaPublicHome, fetchMsaPublicHome } from "../scripts/data-engine/adapters/msaPublicAdapter.mjs";
// Synthetic, small fixture of the observed SSR table; no player/session data copied.
function fixture(ended = true) {
  const table = [{ _1: 2 }, "loaderData", { _3: 4 }, "routes/_index", { _5: 6, _22: 23 }, "ended", [7], { _8: 9, _10: 11, _12: 13, _5: 14 }, "gameUuid", "11111111-1111-1111-1111-111111111111", "players", [15, 16], "matchMode", "Ranked", ended, { _17: 18 }, { _17: 19 }, "winner", true, null, "unused", null, "authUser", { secret: "not-exported" }];
  return `<script>window.__reactRouterContext.streamController.enqueue(${JSON.stringify(JSON.stringify(table) + "\n")});</script>`;
}
test("public summary preserves unknown date/deck fields and discards account data", () => {
  const result = parseMsaPublicHome(fixture(), "2026-09-07T12:00:00Z");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].winnerSeat, 0);
  assert.equal(result.items[0].playedAt, null);
  assert.equal(result.items[0].season, null);
  assert.equal(result.items[0].players[0].archetype, null);
  assert.equal(result.capabilities.completeHistory, false);
  assert.ok(!JSON.stringify(result).includes("not-exported"));
  assert.equal(result.contentHash, parseMsaPublicHome(fixture(), "2026-09-08T12:00:00Z").contentHash);
});
test("schema changes and failed responses reject instead of producing empty valid data", async () => {
  assert.throws(() => parseMsaPublicHome("login", "2026-09-07T12:00:00Z"), /schema/);
  assert.throws(() => parseMsaPublicHome(fixture(false), "2026-09-07T12:00:00Z"), /Invalid/);
  await assert.rejects(fetchMsaPublicHome({ fetchImpl: async () => new Response("", { status: 403 }) }), /403/);
});
