// Match-level analytics. Tournament placements never enter this calculation.
export const BATTLE_METHODOLOGY_VERSION = "tcgtd-battles-v1";

export function wilsonInterval(wins, games) {
  if (!Number.isInteger(games) || games <= 0 || !Number.isInteger(wins) || wins < 0 || wins > games) return null;
  const z = 1.959963984540054;
  const p = wins / games;
  const denominator = 1 + z * z / games;
  const center = (p + z * z / (2 * games)) / denominator;
  const radius = z * Math.sqrt(p * (1 - p) / games + z * z / (4 * games * games)) / denominator;
  return { low: Math.max(0, center - radius), high: Math.min(1, center + radius) };
}

export function buildBattleAnalytics(matches = [], { sourceId, season, startDate, endDate, excludeMirrors = true, minimumGames = 30 } = {}) {
  // An explicit source is mandatory: different ladders are different populations.
  if (!sourceId) throw new Error("A match source is required.");
  if (!Number.isInteger(minimumGames) || minimumGames < 1) throw new Error("Minimum games must be a positive integer.");
  for (const date of [startDate, endDate]) {
    if (date == null) continue;
    const time = Date.parse(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) throw new Error("Invalid date range.");
  }
  const start = startDate ? Date.parse(`${startDate}T00:00:00Z`) : -Infinity;
  const end = endDate ? Date.parse(`${endDate}T23:59:59.999Z`) : Infinity;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end) throw new Error("Invalid date range.");
  const unique = new Map();
  const conflicts = new Set();
  let duplicates = 0;
  for (const match of matches) {
    if (!match || match.sourceId !== sourceId || !match.id) continue;
    const previous = unique.get(match.id);
    if (previous) {
      duplicates += 1;
      if (signature(previous) !== signature(match)) conflicts.add(match.id);
    } else unique.set(match.id, match);
  }
  const excluded = { conflicts: conflicts.size, incomplete: 0, outsideScope: 0, unclassified: 0, mirrors: 0 };
  const groups = new Map();
  const pairings = new Map();
  const daily = new Map();
  let games = 0;
  for (const match of unique.values()) {
    if (conflicts.has(match.id)) continue;
    const time = Date.parse(match.playedAt || "");
    if (match.mode !== "Ranked" || !match.ended || !Number.isFinite(time) || ![0, 1, "draw"].includes(match.winnerSeat) || match.players?.length !== 2) {
      excluded.incomplete += 1;
      continue;
    }
    if (time < start || time > end || (season && match.season !== season)) { excluded.outsideScope += 1; continue; }
    const names = match.players.map(player => knownArchetype(player?.archetype));
    if (names.some(name => !name)) { excluded.unclassified += 1; continue; }
    if (excludeMirrors && names[0] === names[1]) { excluded.mirrors += 1; continue; }
    games += 1;
    const date = new Date(time).toISOString().slice(0, 10);
    daily.set(date, (daily.get(date) || 0) + 1);
    for (let seat = 0; seat < 2; seat += 1) {
      const name = names[seat];
      const opponent = names[1 - seat];
      const group = groups.get(name) || { archetype: name, appearances: 0, wins: 0, losses: 0, draws: 0 };
      record(group, match.winnerSeat, seat);
      groups.set(name, group);
      const key = JSON.stringify([name, opponent]);
      const pair = pairings.get(key) || { archetype: name, opponent, appearances: 0, wins: 0, losses: 0, draws: 0 };
      record(pair, match.winnerSeat, seat);
      pairings.set(key, pair);
    }
  }
  const summarize = row => {
    const decisiveGames = row.wins + row.losses;
    return { ...row, decisiveGames, winRate: decisiveGames ? row.wins / decisiveGames : null, interval: wilsonInterval(row.wins, decisiveGames), eligible: decisiveGames >= minimumGames };
  };
  return {
    methodologyVersion: BATTLE_METHODOLOGY_VERSION, sourceId, games, appearances: games * 2, duplicates, excluded,
    archetypes: [...groups.values()].map(row => ({ ...summarize(row), share: games ? row.appearances / (games * 2) : 0 }))
      .sort((a, b) => Number(b.eligible) - Number(a.eligible) || (b.interval?.low ?? -1) - (a.interval?.low ?? -1) || a.archetype.localeCompare(b.archetype)),
    matchups: [...pairings.values()].map(summarize),
    daily: [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, games: count })),
  };
}

function knownArchetype(value) {
  const name = typeof value === "string" ? value.trim() : "";
  return /^(unknown|other|unclassified|não classificado)$/i.test(name) ? "" : name;
}
function signature(match) {
  return JSON.stringify([match.mode, match.ended, match.playedAt, match.season, match.winnerSeat, match.players?.map(player => [player?.archetype, player?.deckId])]);
}
function record(row, winner, seat) {
  row.appearances += 1;
  if (winner === "draw") row.draws += 1;
  else if (winner === seat) row.wins += 1;
  else row.losses += 1;
}
