import { resolveEventWinner } from "./eventEvidence.js";

export function buildMetaCoverage(data = {}, window = {}, source = "all") {
  const sourceName = row => row.sourceName || "Unknown source";
  const inWindow = row => /^\d{4}-\d{2}-\d{2}$/.test(row.eventDate || "") && (!window.startDate || row.eventDate >= window.startDate) && (!window.endDate || row.eventDate <= window.endDate);
  const scoped = (data.metaResults || []).filter(inWindow);
  const sources = [...new Set(scoped.map(sourceName))].sort();
  const seen = new Set();
  const results = scoped.filter(row => {
    if (source !== "all" && sourceName(row) !== source) return false;
    const key = row.resultId || JSON.stringify([row.eventId, row.playerName, row.deckId, row.placingRank]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const eventIds = new Set(results.map(row => row.eventId));
  const availableDecks = new Set((data.metaDeckCards || []).filter(row => Number(row.quantity) > 0).map(row => row.deckId));
  const groups = new Map();
  const eventResults = new Map();
  for (const row of results) {
    const rows = eventResults.get(row.eventId) || [];
    rows.push(row);
    eventResults.set(row.eventId, rows);
    const name = /^(other|unknown|unclassified)$/i.test(row.archetype?.trim() || "") || !row.archetype?.trim() ? "Unclassified" : row.archetype;
    const group = groups.get(name) || { archetype: name, results: 0, titles: 0, lists: 0 };
    group.results += 1;
    if (Number(row.placingRank) === 1) group.titles += 1;
    if (availableDecks.has(row.deckId)) group.lists += 1;
    groups.set(name, group);
  }
  return {
    results, sources, eventCount: eventIds.size,
    events: (data.metaEvents || []).filter(event => eventIds.has(event.eventId)),
    listCount: results.filter(row => availableDecks.has(row.deckId)).length,
    unclassified: groups.get("Unclassified")?.results || 0,
    ambiguousEventCount: [...eventResults.values()].filter(rows => resolveEventWinner(rows).status === "conflicting").length,
    archetypes: [...groups.values()].map(row => ({ ...row, share: results.length ? row.results / results.length : 0 }))
      .sort((a, b) => b.results - a.results || a.archetype.localeCompare(b.archetype)),
  };
}
