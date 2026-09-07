import assert from "node:assert/strict";
import test from "node:test";
import { CONTRIBUTION_SCHEMA, validateContribution, contributionError } from "../src/domain/communityContribution.js";
import { contributionToLegacy, contributionId } from "../scripts/data-engine/adapters/communityAdapter.mjs";
import { buildCanonicalFromLegacy, buildGeneratedData, validateCompetitiveData } from "../scripts/data-engine/lib.mjs";
const input = () => ({ schemaVersion: CONTRIBUTION_SCHEMA, publicDataConfirmed: true, event: { name: "Fixture locals", organizer: "Fixture store", date: "2026-09-01", country: "BR", city: "São Paulo", sourceUrl: "https://example.test/event", playerCount: 16 }, results: [{ placement: 2, playerName: "Fixture pilot", archetype: "Wing", deckUrl: "https://example.test/deck" }] });
test("reviewed organizer result reaches event and community projections without inventing an indexed deck", () => {
  const legacy = contributionToLegacy(input(), "2026-09-02T00:00:00Z");
  const normalized = buildCanonicalFromLegacy({ ...legacy, sourceRegistry: [{ id: "source-community-stores", confidence: "community", source_type: "organizer_submission" }] });
  assert.equal(validateCompetitiveData(normalized).valid, true);
  const front = buildGeneratedData(normalized).frontend;
  assert.equal(front.metaEvents[0].city, "São Paulo");
  assert.equal(front.metaResults[0].placingRank, 2);
  assert.equal(front.metaResults[0].hasDecklist, false);
  assert.equal(front.metaDeckCards.length, 0);
  assert.equal(normalized.results[0].provenance[0].adapter_id, "community-reviewed");
  assert.equal(normalized.results[0].provenance[0].retrieved_at, "2026-09-02T00:00:00Z");
});
test("unsafe links, missing consent, invalid dates and impossible counts are rejected", () => {
  for (const edit of [x => x.event.sourceUrl = "javascript:alert(1)", x => x.event.sourceUrl = "https://user:secret@example.test", x => x.publicDataConfirmed = false, x => x.event.date = "2026-02-30", x => x.event.date = "2999-01-01", x => x.results[0].placement = 17, x => x.event.playerCount = -1, x => x.results.push({ ...x.results[0] })]) {
    const value = input(); edit(value); assert.equal(validateContribution(value).valid, false);
  }
});
test("submission cannot grant itself official confidence or approval; identifiers are stable", () => {
  const value = { ...input(), confidence: "official", status: "approved", reviewedAt: "2020-01-01", secret: "discard me" };
  const result = validateContribution(value);
  assert.equal(result.value.status, "pending_review");
  assert.equal(result.value.confidence, undefined);
  assert.equal(result.value.secret, undefined);
  assert.equal(contributionId(result.value), contributionId(validateContribution(input()).value));
});
test("invalid dates remain invalid instead of being truncated, and duplicate errors are localized", () => {
  const value = input();
  value.event.date = "2026-09-01junk";
  assert.equal(validateContribution(value).valid, false);
  assert.equal(contributionError("Result 2: use a distinct public player name.", "pt-BR"), "Resultado 2: informe um apelido público sem repetir outro jogador.");
});
