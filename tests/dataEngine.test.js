import assert from "node:assert/strict";
import test from "node:test";
import { csvLegacyAdapter } from "../scripts/data-engine/adapters/csvLegacyAdapter.mjs";
import {
  buildCanonicalFromLegacy,
  buildGeneratedData,
  deduplicateTournaments,
  normalizeArchetype,
  validateCompetitiveData,
} from "../scripts/data-engine/lib.mjs";

const aliases = [{
  id: "wing-zero-gw",
  display_name: "GW Wing Zero",
  aliases: ["Wing", "Wing Zero", "GW Wing", "Green White Wing", "Wing Zero EW"],
}];

test("archetype aliases preserve source text while resolving the canonical identity", () => {
  const normalized = normalizeArchetype("Green White Wing", aliases);
  assert.deepEqual(normalized, {
    source_archetype_name: "Green White Wing",
    normalized_archetype_id: "wing-zero-gw",
    display_name: "GW Wing Zero",
  });
});

test("tournament reconciliation merges matching public records and preserves provenance", () => {
  const { tournaments, aliases: idAliases } = deduplicateTournaments([
    { id: "official-id", name: "Mexico City Regional", date: "2026-08-23", city: "Mexico City", organizer: "SangSang", source_ids: ["bandai-official"], provenance: [{ source_id: "bandai-official", confidence: "official" }] },
    { id: "community-id", name: "Mexico City Regional", date: "2026-08-23", city: "Mexico City", organizer: "SangSang", source_ids: ["limitless-gundam"], provenance: [{ source_id: "limitless-gundam", confidence: "trusted" }] },
  ]);
  assert.equal(tournaments.length, 1);
  assert.equal(idAliases.get("community-id"), "official-id");
  assert.deepEqual(tournaments[0].source_ids, ["bandai-official", "limitless-gundam"]);
});

test("legacy CSV adapter parses escaped fields and migration builds normalized references", () => {
  const parsed = csvLegacyAdapter.parse({
    events: { text: "event_id,source_name,event_name,event_date,format_name,event_type,player_count,organizer,source_url,source_page_title\ne1,Egman Events,\"Regional, Test\",2026-08-23,GD05,Regional,32,SangSang,https://example.test/event,title\n" },
    results: { text: "result_id,deck_id,event_id,source_name,event_name,event_date,format_name,event_type,player_count,player_name,placing_label,placing_rank,archetype,color_combination,leader_name,deck_url,source_url,has_decklist\nr1,d1,e1,Egman Events,Regional Test,2026-08-23,GD05,Regional,32,Pilot,1st (5-0),1,Wing Zero,Green/White,,https://example.test/deck,https://example.test/event,TRUE\n" },
    deckCards: { text: "deck_card_id,deck_id,event_id,source_name,event_name,event_date,player_name,placing_label,placing_rank,archetype,color_combination,card_number,card_name,quantity,card_type,card_color,package_code,package_label\ndc1,d1,e1,Egman Events,Regional Test,2026-08-23,Pilot,1st,1,Wing Zero,Green/White,GD05-001,Test Gundam,4,UNIT,Green,GD05,GD05\n" },
  });
  assert.equal(parsed.events[0].event_name, "Regional, Test");
  const data = buildCanonicalFromLegacy({
    ...parsed,
    aliases,
    sourceRegistry: [{ id: "egman-events", name: "Egman Events", confidence: "trusted", source_type: "public_html" }],
  });
  assert.equal(data.tournaments.length, 1);
  assert.equal(data.results[0].normalized_archetype_id, "wing-zero-gw");
  assert.equal(data.deck_cards[0].card_id, "GD05-001");
  assert.equal(validateCompetitiveData(data).valid, true);
});

test("validation blocks an empty import from replacing a valid historical result dataset", () => {
  const result = validateCompetitiveData(
    { tournaments: [], results: [], decks: [], deck_cards: [], players: [], archetypes: [], cards: [] },
    { tournaments: [{ id: "old" }], results: [{ id: "old-result" }] },
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "empty_result_overwrite"));
});

test("derived frontend data is generated from normalized records", () => {
  const data = buildCanonicalFromLegacy({
    events: [{ event_id: "e1", source_name: "Egman Events", event_name: "Regional Test", event_date: "2026-08-23", format_name: "GD05", event_type: "Regional", player_count: "32", organizer: "SangSang", source_url: "https://example.test/event" }],
    results: [{ result_id: "r1", deck_id: "d1", event_id: "e1", source_name: "Egman Events", player_name: "Pilot", placing_label: "1st", placing_rank: "1", archetype: "Wing", color_combination: "Green/White", has_decklist: "TRUE" }],
    deckCards: [{ deck_card_id: "dc1", deck_id: "d1", source_name: "Egman Events", card_number: "GD05-001", card_name: "Test Gundam", quantity: "4", card_type: "UNIT", card_color: "Green", package_code: "GD05" }],
    aliases,
    sourceRegistry: [{ id: "egman-events", name: "Egman Events", confidence: "trusted", source_type: "public_html" }],
  });
  const generated = buildGeneratedData(data);
  assert.equal(generated.frontend.metaEvents[0].eventId, "e1");
  assert.equal(generated.tournamentIndex.tournaments[0].id, "e1");
  assert.equal(generated.frontend.metaResults[0].archetype, "GW Wing Zero");
  assert.equal(generated.frontend.metaDeckCards[0].quantity, 4);
});
