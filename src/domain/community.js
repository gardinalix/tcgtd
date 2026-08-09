export function buildCommunitySnapshot(data = {}) {
  const events = [...(data.metaEvents || [])].sort(compareEventDates);
  const results = data.metaResults || [];
  const players = buildCommunityPlayers(results, events);
  const venues = buildCommunityVenues(events, results);
  const resultsByEvent = countResultsByEvent(results);
  const geographicEvents = events.filter(hasGeography);

  return {
    events,
    results,
    players,
    venues,
    resultsByEvent,
    geographicEvents,
    coverage: {
      events: events.length,
      results: results.length,
      players: players.length,
      venues: venues.length,
      geographicEvents: geographicEvents.length,
    },
  };
}

export function buildCommunityPlayers(results = [], events = []) {
  const eventById = new Map(events.map((event) => [event.eventId, event]));
  const players = new Map();

  for (const result of results) {
    const displayName = String(result.playerName || "").trim();
    if (!displayName) continue;
    const key = normalizeIdentity(displayName);
    const event = eventById.get(result.eventId) || result;
    const row = players.get(key) || {
      id: key,
      displayName,
      eventIds: new Set(),
      resultCount: 0,
      wins: 0,
      topCuts: 0,
      bestFinish: Number.POSITIVE_INFINITY,
      latestEventDate: "",
      archetypes: new Map(),
      countries: new Set(),
      sources: new Set(),
      bandaiLinked: false,
    };
    const rank = numericRank(result.placingRank);
    row.eventIds.add(result.eventId || result.resultId);
    row.resultCount += 1;
    if (rank === 1) row.wins += 1;
    if (rank <= 8) row.topCuts += 1;
    row.bestFinish = Math.min(row.bestFinish, rank);
    row.latestEventDate = maxDate(row.latestEventDate, result.eventDate || event.eventDate);
    increment(row.archetypes, result.archetype || "Unclassified");
    if (event.country) row.countries.add(event.country);
    if (result.sourceName || event.sourceName) row.sources.add(result.sourceName || event.sourceName);
    players.set(key, row);
  }

  return [...players.values()]
    .map((player) => ({
      ...player,
      eventCount: player.eventIds.size,
      bestFinish: Number.isFinite(player.bestFinish) ? player.bestFinish : null,
      archetypes: mapCounts(player.archetypes).slice(0, 3),
      countries: [...player.countries].sort(),
      sources: [...player.sources].sort(),
      eventIds: undefined,
    }))
    .sort((left, right) => right.eventCount - left.eventCount || right.wins - left.wins || left.displayName.localeCompare(right.displayName));
}

export function buildCommunityVenues(events = [], results = []) {
  const resultCounts = countResultsByEvent(results);
  const venues = new Map();

  for (const event of events) {
    const name = String(event.organizer || event.venueName || "").trim();
    if (!name) continue;
    const key = normalizeIdentity(name);
    const row = venues.get(key) || {
      id: key,
      name,
      eventIds: new Set(),
      resultCount: 0,
      playerCapacityObserved: 0,
      latestEventDate: "",
      cities: new Set(),
      regions: new Set(),
      countries: new Set(),
      sources: new Set(),
      online: false,
    };
    row.eventIds.add(event.eventId);
    row.resultCount += Number(resultCounts.get(event.eventId) || 0);
    row.playerCapacityObserved = Math.max(row.playerCapacityObserved, Number(event.playerCount || 0));
    row.latestEventDate = maxDate(row.latestEventDate, event.eventDate);
    if (event.city) row.cities.add(event.city);
    if (event.state || event.region) row.regions.add(event.state || event.region);
    if (event.country) row.countries.add(event.country);
    if (event.sourceName) row.sources.add(event.sourceName);
    row.online ||= /webcam|online|remote|msa/i.test(`${event.eventName || ""} ${event.eventType || ""}`);
    venues.set(key, row);
  }

  return [...venues.values()]
    .map((venue) => ({
      ...venue,
      eventCount: venue.eventIds.size,
      cities: [...venue.cities].sort(),
      regions: [...venue.regions].sort(),
      countries: [...venue.countries].sort(),
      sources: [...venue.sources].sort(),
      eventIds: undefined,
      hasGeography: Boolean(venue.cities.size || venue.regions.size || venue.countries.size),
    }))
    .sort((left, right) => right.eventCount - left.eventCount || left.name.localeCompare(right.name));
}

export function countResultsByEvent(results = []) {
  const counts = new Map();
  for (const result of results) {
    if (!result.eventId) continue;
    counts.set(result.eventId, Number(counts.get(result.eventId) || 0) + 1);
  }
  return counts;
}

function compareEventDates(left, right) {
  return String(right.eventDate || "").localeCompare(String(left.eventDate || ""))
    || String(left.eventName || "").localeCompare(String(right.eventName || ""));
}

function hasGeography(event = {}) {
  return Boolean(event.city || event.state || event.region || event.country || (Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude))));
}

function normalizeIdentity(value) {
  return String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function numericRank(value) {
  const rank = Number(value);
  return Number.isFinite(rank) && rank > 0 ? rank : Number.POSITIVE_INFINITY;
}

function maxDate(left, right) {
  return String(right || "") > String(left || "") ? String(right || "") : String(left || "");
}

function increment(map, key) {
  map.set(key, Number(map.get(key) || 0) + 1);
}

function mapCounts(map) {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}
