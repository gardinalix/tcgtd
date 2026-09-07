import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const ROOT = process.cwd();
export const COMPETITIVE_ROOT = path.join(ROOT, "data", "competitive");
export const PATHS = Object.freeze({
  sources: path.join(COMPETITIVE_ROOT, "sources"),
  raw: path.join(COMPETITIVE_ROOT, "raw"),
  normalized: path.join(COMPETITIVE_ROOT, "normalized"),
  generated: path.join(COMPETITIVE_ROOT, "generated"),
  exports: path.join(COMPETITIVE_ROOT, "exports"),
  public: path.join(ROOT, "web", "data", "competitive"),
});

export const TOURNAMENT_STATUSES = new Set([
  "announced", "scheduled", "awaiting_results", "partial_results", "complete", "verified",
]);
export const CONFIDENCE_RANK = Object.freeze({ manual: 1, community: 2, trusted: 3, official: 4 });

export async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function readText(filePath, fallback = "") {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function fileMetadata(filePath) {
  try {
    const [content, stat] = await Promise.all([fs.readFile(filePath, "utf8"), fs.stat(filePath)]);
    return {
      path: path.relative(ROOT, filePath).replaceAll("\\", "/"),
      content_hash: contentHash(content),
      bytes: stat.size,
      retrieved_at: stat.mtime.toISOString(),
    };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function writeJsonIfChanged(filePath, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const previous = await readText(filePath, "");
  if (previous === content) return false;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
  return true;
}

export function contentHash(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex");
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

export function clean(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

export function nullableInt(value) {
  const integer = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(integer) ? integer : null;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  if (!rows.length) return [];
  const [headers, ...records] = rows;
  return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] || ""])));
}

export function csvValue(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows, fields) {
  return `${[fields, ...rows.map((row) => fields.map((field) => csvValue(row[field])))].map((row) => row.join(",")).join("\n")}\n`;
}

export function sourceIdForName(name) {
  const normalized = slug(name);
  if (normalized.includes("egman")) return "egman-events";
  if (normalized.includes("limitless")) return "limitless-gundam";
  return `source-${normalized}`;
}

export function sourceConfidence(sourceId, sources = []) {
  return sources.find((source) => source.id === sourceId)?.confidence || "community";
}

export function sourceDefinition(sourceId, sources = []) {
  return sources.find((source) => source.id === sourceId) || {
    id: sourceId,
    name: sourceId,
    source_type: "public_html",
    confidence: "community",
  };
}

export function makeProvenance({ sourceId, sourceName, sourceUrl, sourceType, confidence, retrievedAt, contentHash: hash, adapterId }) {
  return {
    source_id: sourceId,
    source_name: sourceName,
    source_url: sourceUrl || null,
    source_type: sourceType || "public_html",
    confidence: confidence || "community",
    retrieved_at: retrievedAt || null,
    content_hash: hash || null,
    adapter_id: adapterId || null,
  };
}

export function mergeProvenance(existing = [], incoming = []) {
  const unique = new Map();
  for (const item of [...existing, ...incoming]) {
    const key = `${item.source_id}|${item.source_url || ""}|${item.content_hash || ""}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].sort((left, right) => (CONFIDENCE_RANK[right.confidence] || 0) - (CONFIDENCE_RANK[left.confidence] || 0)
    || String(left.source_id).localeCompare(String(right.source_id)));
}

export function createArchetypeResolver(aliasRows = []) {
  const aliases = new Map();
  const canonical = new Map();
  for (const row of aliasRows) {
    if (!row?.id || !row?.display_name) continue;
    const entry = {
      id: row.id,
      display_name: row.display_name,
      aliases: [...new Set([row.display_name, ...(row.aliases || [])].map((value) => clean(value)).filter(Boolean))],
    };
    canonical.set(entry.id, entry);
    for (const alias of entry.aliases) aliases.set(slug(alias), entry);
  }
  return {
    normalize(sourceName) {
      const original = clean(sourceName);
      if (!original) return { source_archetype_name: null, normalized_archetype_id: null, display_name: null };
      const configured = aliases.get(slug(original));
      if (configured) return {
        source_archetype_name: original,
        normalized_archetype_id: configured.id,
        display_name: configured.display_name,
      };
      const id = slug(original);
      if (!canonical.has(id)) canonical.set(id, { id, display_name: original, aliases: [original] });
      return { source_archetype_name: original, normalized_archetype_id: id, display_name: canonical.get(id).display_name };
    },
    values() {
      return [...canonical.values()].sort((left, right) => left.display_name.localeCompare(right.display_name));
    },
  };
}

export function normalizeArchetype(sourceName, aliasRows = []) {
  return createArchetypeResolver(aliasRows).normalize(sourceName);
}

function eventSignature(event) {
  return `${String(event.date || "").slice(0, 10)}|${slug(event.name)}|${slug(event.city || "")}|${slug(event.organizer || "")}`;
}

export function tournamentsMatch(left, right) {
  if (String(left.date || "").slice(0, 10) !== String(right.date || "").slice(0, 10)) return false;
  const sameName = slug(left.name) === slug(right.name);
  if (!sameName) return false;
  const leftCity = slug(left.city || "");
  const rightCity = slug(right.city || "");
  const leftOrganizer = slug(left.organizer || "");
  const rightOrganizer = slug(right.organizer || "");
  return (!leftCity || !rightCity || leftCity === rightCity) && (!leftOrganizer || !rightOrganizer || leftOrganizer === rightOrganizer);
}

export function deduplicateTournaments(tournaments = []) {
  const unique = [];
  const aliases = new Map();
  for (const incoming of tournaments) {
    const existing = unique.find((candidate) => tournamentsMatch(candidate, incoming));
    if (!existing) {
      unique.push({ ...incoming, source_ids: [...new Set(incoming.source_ids || [])], provenance: mergeProvenance([], incoming.provenance || []) });
      continue;
    }
    aliases.set(incoming.id, existing.id);
    existing.source_ids = [...new Set([...(existing.source_ids || []), ...(incoming.source_ids || [])])].sort();
    existing.provenance = mergeProvenance(existing.provenance, incoming.provenance);
    for (const field of ["city", "country", "region", "organizer", "format", "set", "player_count"]) {
      if (existing[field] == null && incoming[field] != null) existing[field] = incoming[field];
    }
    if (CONFIDENCE_RANK[incoming.provenance?.[0]?.confidence] > CONFIDENCE_RANK[existing.provenance?.[0]?.confidence]) {
      for (const field of ["name", "city", "country", "region", "organizer", "format", "set", "player_count"]) {
        if (incoming[field] != null) existing[field] = incoming[field];
      }
    }
  }
  return { tournaments: unique.sort((left, right) => String(left.date).localeCompare(String(right.date)) || left.id.localeCompare(right.id)), aliases };
}

function extractRecord(placingLabel) {
  const match = String(placingLabel || "").match(/\((\d+)\s*-\s*(\d+)(?:\s*-\s*(\d+))?\)/);
  if (!match) return { wins: null, losses: null, draws: null, record: clean(placingLabel) };
  return { wins: Number(match[1]), losses: Number(match[2]), draws: match[3] ? Number(match[3]) : null, record: match[0].slice(1, -1) };
}

function colors(value) {
  return [...new Set(String(value || "").split(/[+/,|-]/).map(clean).filter(Boolean))];
}

function buildLegacyProvenance(row, sourceRegistry, metadata) {
  const sourceName = clean(row.source_name) || "Legacy CSV import";
  const sourceId = sourceIdForName(sourceName);
  const definition = sourceDefinition(sourceId, sourceRegistry);
  return makeProvenance({
    sourceId,
    sourceName,
    sourceUrl: clean(row.source_url) || definition.url || null,
    sourceType: definition.source_type || "legacy_csv",
    confidence: definition.confidence || sourceConfidence(sourceId, sourceRegistry),
    retrievedAt: metadata?.retrieved_at || null,
    contentHash: metadata?.content_hash || null,
    adapterId: "csv-legacy",
  });
}

export function buildCanonicalFromLegacy({ events = [], results = [], deckCards = [], registry = [], aliases = [], sourceRegistry = [], metadata = {} }) {
  const resolver = createArchetypeResolver(aliases);
  const seedTournaments = registry.map((row) => ({
    id: row.id,
    name: clean(row.name) || row.id,
    date: clean(row.date),
    country: clean(row.country),
    city: clean(row.city),
    region: clean(row.region),
    organizer: clean(row.organizer),
    format: clean(row.format),
    set: clean(row.set),
    player_count: nullableInt(row.player_count),
    status: TOURNAMENT_STATUSES.has(row.status) ? row.status : "announced",
    source_ids: [...new Set(row.source_ids || ["manual-tournament-registry"])],
    last_updated: clean(row.last_updated) || metadata.registry?.retrieved_at || null,
    provenance: mergeProvenance([], row.provenance || [makeProvenance({
      sourceId: "manual-tournament-registry",
      sourceName: "Manual tournament registry",
      sourceUrl: null,
      sourceType: "manual",
      confidence: "manual",
      retrievedAt: metadata.registry?.retrieved_at || null,
      contentHash: metadata.registry?.content_hash || null,
      adapterId: "manual-registry",
    })]),
  }));
  const legacyTournaments = events.map((row) => {
    const provenance = buildLegacyProvenance(row, sourceRegistry, metadata.events);
    return {
      id: clean(row.event_id) || `${slug(row.event_name)}-${String(row.event_date || "").slice(0, 10)}`,
      name: clean(row.event_name) || "Untitled tournament",
      date: clean(row.event_date),
      country: clean(row.country),
      city: clean(row.city) || clean(row.location),
      region: clean(row.region),
      organizer: clean(row.organizer),
      format: clean(row.format_name),
      set: (clean(row.format_name) || "").match(/\b(?:GD|ST|EX)\d{2}\b/i)?.[0]?.toUpperCase() || null,
      player_count: nullableInt(row.player_count),
      status: "awaiting_results",
      source_ids: [provenance.source_id],
      last_updated: provenance.retrieved_at,
      provenance: [provenance],
      source_page_title: clean(row.source_page_title),
    };
  });
  const { tournaments, aliases: tournamentAliases } = deduplicateTournaments([...seedTournaments, ...legacyTournaments]);
  const tournamentById = new Map(tournaments.map((row) => [row.id, row]));
  for (const [legacyId, canonicalId] of tournamentAliases) tournamentById.set(legacyId, tournamentById.get(canonicalId));

  const deckById = new Map();
  const resultRows = [];
  const playerById = new Map();
  const resultKeys = new Set();
  for (const row of results) {
    const sourceTournamentId = clean(row.event_id);
    let tournament = tournamentById.get(sourceTournamentId);
    if (!tournament) {
      const provenance = buildLegacyProvenance(row, sourceRegistry, metadata.results);
      tournament = {
        id: sourceTournamentId || `${slug(row.event_name)}-${String(row.event_date || "").slice(0, 10)}`,
        name: clean(row.event_name) || "Untitled tournament",
        date: clean(row.event_date), country: null, city: null, region: null, organizer: null,
        format: clean(row.format_name), set: null, player_count: nullableInt(row.player_count), status: "partial_results",
        source_ids: [provenance.source_id], last_updated: provenance.retrieved_at, provenance: [provenance],
      };
      tournaments.push(tournament);
      tournamentById.set(tournament.id, tournament);
    }
    const sourceArchetype = clean(row.archetype);
    const archetype = resolver.normalize(sourceArchetype);
    const playerName = clean(row.player_name);
    const playerId = playerName ? `player-${slug(playerName)}` : null;
    const placement = nullableInt(row.placing_rank);
    const deckId = clean(row.deck_id);
    const provenance = buildLegacyProvenance(row, sourceRegistry, metadata.results);
    const duplicateKey = `${tournament.id}|${playerId || "unknown"}|${placement || "unknown"}|${deckId || "none"}`;
    if (resultKeys.has(duplicateKey)) continue;
    resultKeys.add(duplicateKey);
    const result = {
      id: clean(row.result_id) || contentHash(duplicateKey).slice(0, 16),
      tournament_id: tournament.id,
      player_id: playerId,
      placement,
      deck_id: deckId,
      ...extractRecord(row.placing_label),
      source_placing_label: clean(row.placing_label),
      source_archetype_name: archetype.source_archetype_name,
      normalized_archetype_id: archetype.normalized_archetype_id,
      colors: colors(row.color_combination),
      leader_name: clean(row.leader_name),
      deck_url: clean(row.deck_url),
      has_decklist: String(row.has_decklist || "").toUpperCase() === "TRUE",
      provenance: [provenance],
      needs_review: false,
    };
    resultRows.push(result);
    if (playerId && !playerById.has(playerId)) {
      playerById.set(playerId, { id: playerId, display_name: playerName, source_ids: [provenance.source_id], provenance: [provenance] });
    } else if (playerId) {
      const player = playerById.get(playerId);
      player.source_ids = [...new Set([...player.source_ids, provenance.source_id])].sort();
      player.provenance = mergeProvenance(player.provenance, [provenance]);
    }
    if (deckId && !deckById.has(deckId)) {
      deckById.set(deckId, {
        id: deckId, tournament_id: tournament.id, player_id: playerId,
        archetype_id: archetype.normalized_archetype_id, source_archetype_name: archetype.source_archetype_name,
        colors: colors(row.color_combination), placement, leader_name: clean(row.leader_name), deck_url: clean(row.deck_url),
        provenance: [provenance], needs_review: false,
      });
    }
  }

  const cardById = new Map();
  const deckCardRows = [];
  const deckCardKeys = new Set();
  for (const row of deckCards) {
    const deckId = clean(row.deck_id);
    if (!deckId || !deckById.has(deckId)) continue;
    const cardId = clean(row.card_number)?.toUpperCase();
    const quantity = nullableInt(row.quantity);
    // Source exports sometimes retain a card row after its count is reduced to
    // zero. It is not part of the submitted list and must not make an
    // otherwise valid event import fail validation.
    if (!cardId || quantity == null || quantity < 1) continue;
    const deckCardKey = `${deckId}|${cardId}`;
    if (deckCardKeys.has(deckCardKey)) continue;
    deckCardKeys.add(deckCardKey);
    const provenance = buildLegacyProvenance(row, sourceRegistry, metadata.deckCards);
    deckCardRows.push({
      id: clean(row.deck_card_id) || contentHash(deckCardKey).slice(0, 16), deck_id: deckId, card_id: cardId, quantity,
      provenance: [provenance], needs_review: false,
    });
    if (!cardById.has(cardId)) {
      cardById.set(cardId, {
        id: cardId, name: clean(row.card_name), set: clean(row.package_code), number: cardId,
        color: clean(row.card_color), type: clean(row.card_type), provenance: [provenance],
      });
    }
  }

  const usedTournamentIds = new Set(resultRows.map((row) => row.tournament_id));
  for (const tournament of tournaments) {
    if (usedTournamentIds.has(tournament.id) && !["verified", "complete"].includes(tournament.status)) tournament.status = "partial_results";
    tournament.source_ids = [...new Set(tournament.source_ids || [])].sort();
    tournament.provenance = mergeProvenance([], tournament.provenance);
  }
  // Sources often label an entire elimination bracket "Top 8" or "Top 16".
  // Preserve every record, but never pretend those entries are uniquely ranked.
  const conflicts = [];
  const placementGroups = new Map();
  for (const result of resultRows) {
    if (result.placement == null) continue;
    const key = `${result.tournament_id}|${result.placement}`;
    const group = placementGroups.get(key) || [];
    group.push(result);
    placementGroups.set(key, group);
  }
  for (const [key, group] of placementGroups) {
    const distinctPlayers = new Set(group.map((result) => result.player_id || result.id));
    if (distinctPlayers.size < 2) continue;
    for (const result of group) result.needs_review = true;
    conflicts.push({
      id: `duplicate-placement-${contentHash(key).slice(0, 12)}`,
      type: "duplicate_placement",
      status: "needs_review",
      tournament_id: group[0].tournament_id,
      placement: group[0].placement,
      result_ids: group.map((result) => result.id),
      message: "Source labels multiple players with the same placement; records were preserved without inventing a tiebreaker.",
    });
  }
  const observedArchetypes = new Map();
  for (const result of resultRows) {
    if (!result.normalized_archetype_id) continue;
    const observed = observedArchetypes.get(result.normalized_archetype_id) || new Set();
    if (result.source_archetype_name) observed.add(result.source_archetype_name);
    observedArchetypes.set(result.normalized_archetype_id, observed);
  }
  const archetypes = resolver.values().map((entry) => ({
    ...entry,
    observed_source_names: [...(observedArchetypes.get(entry.id) || [])].sort(),
  }));
  return {
    tournaments: tournaments.sort((left, right) => String(left.date || "").localeCompare(String(right.date || "")) || left.id.localeCompare(right.id)),
    results: resultRows.sort((left, right) => left.tournament_id.localeCompare(right.tournament_id) || (left.placement || 9999) - (right.placement || 9999)),
    decks: [...deckById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    deck_cards: deckCardRows.sort((left, right) => left.deck_id.localeCompare(right.deck_id) || left.card_id.localeCompare(right.card_id)),
    players: [...playerById.values()].sort((left, right) => left.display_name.localeCompare(right.display_name)),
    archetypes,
    cards: [...cardById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    conflicts,
  };
}

export function validateCompetitiveData(data, previous = null) {
  const issues = [];
  const add = (level, code, message, recordId = null) => issues.push({ level, code, message, record_id: recordId });
  const tournaments = new Map((data.tournaments || []).map((row) => [row.id, row]));
  const decks = new Map((data.decks || []).map((row) => [row.id, row]));
  const players = new Map((data.players || []).map((row) => [row.id, row]));
  const cards = new Map((data.cards || []).map((row) => [row.id, row]));
  const archetypes = new Map((data.archetypes || []).map((row) => [row.id, row]));
  if (previous?.tournaments?.length && !data.tournaments?.length) add("error", "empty_tournament_overwrite", "Refusing to replace a non-empty tournament dataset with an empty dataset.");
  if (previous?.results?.length && !data.results?.length) add("error", "empty_result_overwrite", "Refusing to replace a non-empty result dataset with an empty dataset.");
  for (const tournament of data.tournaments || []) {
    if (!tournament.id || !tournament.name || !tournament.date) add("error", "invalid_tournament", "Tournament requires id, name and date.", tournament.id);
    if (!TOURNAMENT_STATUSES.has(tournament.status)) add("error", "invalid_status", `Unknown tournament status: ${tournament.status}`, tournament.id);
  }
  const placements = new Map();
  for (const result of data.results || []) {
    if (!tournaments.has(result.tournament_id)) add("error", "missing_tournament", "Result references an unknown tournament.", result.id);
    if (result.player_id && !players.has(result.player_id)) add("error", "missing_player", "Result references an unknown player.", result.id);
    if (result.deck_id && !decks.has(result.deck_id)) add("error", "missing_deck", "Result references an unknown deck.", result.id);
    if (result.normalized_archetype_id && !archetypes.has(result.normalized_archetype_id)) add("error", "missing_archetype", "Result references an unknown archetype.", result.id);
    if (result.placement != null && result.placement <= 0) add("error", "invalid_placement", "Placement must be greater than zero.", result.id);
    if (result.placement != null) {
      const key = `${result.tournament_id}|${result.placement}`;
      const previousResult = placements.get(key);
      if (previousResult && previousResult.player_id !== result.player_id) {
        add(result.needs_review || previousResult.needs_review ? "warning" : "error", "duplicate_placement", `Incompatible duplicate placement ${result.placement} in tournament ${result.tournament_id}.`, result.id);
      }
      placements.set(key, result);
    }
  }
  for (const deck of data.decks || []) {
    if (!tournaments.has(deck.tournament_id)) add("error", "missing_deck_tournament", "Deck references an unknown tournament.", deck.id);
    if (deck.player_id && !players.has(deck.player_id)) add("error", "missing_deck_player", "Deck references an unknown player.", deck.id);
    if (deck.archetype_id && !archetypes.has(deck.archetype_id)) add("error", "missing_deck_archetype", "Deck references an unknown archetype.", deck.id);
  }
  for (const row of data.deck_cards || []) {
    if (!decks.has(row.deck_id)) add("error", "missing_deck_card_deck", "Deck card references an unknown deck.", row.id);
    if (!cards.has(row.card_id)) add("error", "missing_card", "Deck card references an unknown card.", row.id);
    if (!Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 4) add("error", "invalid_card_quantity", "Card quantity must be an integer from 1 to 4.", row.id);
  }
  return { valid: !issues.some((issue) => issue.level === "error"), issues };
}

export function unwrap(payload) {
  return Array.isArray(payload) ? payload : (payload?.items || []);
}

export function buildGeneratedData(data) {
  const tournamentById = new Map(data.tournaments.map((row) => [row.id, row]));
  const deckById = new Map(data.decks.map((row) => [row.id, row]));
  const playerById = new Map(data.players.map((row) => [row.id, row]));
  const cardById = new Map(data.cards.map((row) => [row.id, row]));
  const archetypeById = new Map(data.archetypes.map((row) => [row.id, row]));
  const sourceOf = (row) => row.provenance?.[0] || {};
  const metaEvents = data.tournaments.map((row) => {
    const source = sourceOf(row);
    return {
      eventId: row.id, sourceName: source.source_name || "Unknown source", eventName: row.name, eventDate: row.date,
      formatName: row.format || row.set || "", eventType: row.status, playerCount: row.player_count ?? "", organizer: row.organizer || "",
      city: row.city || "", country: row.country || "", region: row.region || "", sourceUrl: source.source_url || "",
      sourcePageTitle: row.source_page_title || "", officialStatus: row.status, sourceIds: row.source_ids || [],
    };
  }).sort((left, right) => String(right.eventDate).localeCompare(String(left.eventDate)) || left.eventId.localeCompare(right.eventId));
  const metaResults = data.results.map((row) => {
    const tournament = tournamentById.get(row.tournament_id) || {};
    const player = playerById.get(row.player_id) || {};
    const deck = deckById.get(row.deck_id) || {};
    const archetype = archetypeById.get(row.normalized_archetype_id) || {};
    const source = sourceOf(row);
    return {
      resultId: row.id, deckId: row.deck_id || "", eventId: row.tournament_id, sourceName: source.source_name || sourceOf(tournament).source_name || "Unknown source",
      eventName: tournament.name || "", eventDate: tournament.date || "", formatName: tournament.format || tournament.set || "", eventType: tournament.status || "",
      playerCount: tournament.player_count ?? "", playerName: player.display_name || "", placingLabel: row.source_placing_label || row.placement || "",
      placingRank: row.placement ?? "", archetype: archetype.display_name || row.source_archetype_name || "", colorCombination: (deck.colors || row.colors || []).join("/"),
      leaderName: deck.leader_name || row.leader_name || "", deckUrl: deck.deck_url || row.deck_url || "", sourceUrl: source.source_url || sourceOf(tournament).source_url || "",
      hasDecklist: Boolean(row.has_decklist), sourceArchetypeName: row.source_archetype_name || "", normalizedArchetypeId: row.normalized_archetype_id || "",
    };
  }).sort((left, right) => String(right.eventDate).localeCompare(String(left.eventDate)) || Number(left.placingRank || 9999) - Number(right.placingRank || 9999));
  const metaDeckCards = data.deck_cards.map((row) => {
    const deck = deckById.get(row.deck_id) || {};
    const tournament = tournamentById.get(deck.tournament_id) || {};
    const player = playerById.get(deck.player_id) || {};
    const archetype = archetypeById.get(deck.archetype_id) || {};
    const card = cardById.get(row.card_id) || {};
    return {
      deckCardId: row.id, deckId: row.deck_id, eventId: deck.tournament_id || "", eventName: tournament.name || "", eventDate: tournament.date || "",
      playerName: player.display_name || "", placingLabel: deck.placement || "", placingRank: deck.placement || "", archetype: archetype.display_name || deck.source_archetype_name || "",
      colorCombination: (deck.colors || []).join("/"), cardNumber: row.card_id, cardName: card.name || "", quantity: row.quantity,
      cardType: card.type || "", cardColor: card.color || "", packageCode: card.set || "",
    };
  }).sort((left, right) => left.deckId.localeCompare(right.deckId) || left.cardNumber.localeCompare(right.cardNumber));
  const archetypeStats = data.archetypes.map((archetype) => {
    const rows = data.results.filter((result) => result.normalized_archetype_id === archetype.id);
    const bestFinish = Math.min(...rows.map((row) => row.placement || Infinity));
    return { archetype_id: archetype.id, display_name: archetype.display_name, decklists: rows.length, wins: rows.filter((row) => row.placement === 1).length, best_finish: Number.isFinite(bestFinish) ? bestFinish : null };
  }).filter((row) => row.decklists).sort((left, right) => right.decklists - left.decklists || left.display_name.localeCompare(right.display_name));
  const cardUsage = new Map();
  for (const row of data.deck_cards) {
    const entry = cardUsage.get(row.card_id) || { card_id: row.card_id, deck_count: new Set(), total_quantity: 0 };
    entry.deck_count.add(row.deck_id);
    entry.total_quantity += row.quantity;
    cardUsage.set(row.card_id, entry);
  }
  const cardStats = [...cardUsage.values()].map((row) => ({ card_id: row.card_id, card_name: cardById.get(row.card_id)?.name || "", deck_count: row.deck_count.size, total_quantity: row.total_quantity }))
    .sort((left, right) => right.deck_count - left.deck_count || left.card_id.localeCompare(right.card_id));
  const tournamentPayloads = Object.fromEntries(metaEvents.map((event) => [event.eventId, {
    schema_version: "tcgtd-tournament-detail-v1",
    tournament: event,
    results: metaResults.filter((result) => result.eventId === event.eventId),
    deck_cards: metaDeckCards.filter((row) => row.eventId === event.eventId),
  }]));
  const tournamentIndexEntries = data.tournaments.map((row) => ({
    id: row.id,
    name: row.name,
    date: row.date,
    country: row.country,
    city: row.city,
    region: row.region,
    organizer: row.organizer,
    format: row.format,
    set: row.set,
    player_count: row.player_count,
    status: row.status,
    source_ids: row.source_ids,
    last_updated: row.last_updated,
    provenance: row.provenance,
  })).sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")) || left.id.localeCompare(right.id));
  const payloadHash = contentHash({ tournaments: data.tournaments, results: data.results, decks: data.decks, deck_cards: data.deck_cards, players: data.players, archetypes: data.archetypes, cards: data.cards });
  return {
    meta: { schema_version: "tcgtd-competitive-v1", data_hash: payloadHash, counts: { tournaments: data.tournaments.length, results: data.results.length, decks: data.decks.length, deck_cards: data.deck_cards.length, players: data.players.length, archetypes: data.archetypes.length, cards: data.cards.length } },
    tournamentIndex: { schema_version: "tcgtd-tournament-index-v1", tournaments: tournamentIndexEntries },
    archetypeStats: { schema_version: "tcgtd-archetype-stats-v1", archetypes: archetypeStats },
    cardStats: { schema_version: "tcgtd-card-stats-v1", cards: cardStats },
    frontend: { schemaVersion: "tcgtd-competitive-frontend-v1", metaEvents, metaResults, metaDeckCards },
    tournamentPayloads,
  };
}
