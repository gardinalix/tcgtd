export function buildMetaSignal(cards = [], archetypes = []) {
  const ranked = cards
    .map((card) => {
      const recent = Number(card.recentTop8DecksUsing || 0);
      const all = Number(card.allTop8DecksUsing || 0);
      const recentScore = Number(card.recentMetaScore || 0);
      const overallScore = Number(card.overallMetaScore || 0);
      const delta = recentScore - overallScore / 4;
      const band = classifyCard({ recent, all, recentScore, card });
      const previousBand = classifyCard({
        recent: Math.max(0, all - recent),
        all,
        recentScore: overallScore / 4,
        card,
      });
      const movementDelta = bandWeight(band) - bandWeight(previousBand);
      return {
        cardNumber: card.cardNumber,
        cardName: card.cardName,
        color: card.color,
        cardType: card.cardType,
        recent,
        all,
        recentScore,
        overallScore,
        delta,
        band,
        previousBand,
        movementDelta,
        movementDirection: movementDelta > 0 ? "up" : movementDelta < 0 ? "down" : "flat",
        reason: buildReason(card, recent, delta),
      };
    })
    .sort((a, b) => b.recentScore - a.recentScore || b.delta - a.delta);

  const risers = ranked.filter((row) => row.delta > 3).slice(0, 12);
  const fallers = ranked.filter((row) => row.delta < -3).sort((a, b) => a.delta - b.delta).slice(0, 12);
  const watch = ranked.filter((row) => row.band === "Watch").slice(0, 12);
  const movements = ranked
    .filter((row) => row.previousBand !== row.band)
    .sort((a, b) => Math.abs(b.movementDelta) - Math.abs(a.movementDelta) || Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 12);
  const archetypeTrends = archetypes
    .slice()
    .sort((left, right) => Number(right.recentMetaScore || 0) - Number(left.recentMetaScore || 0))
    .slice(0, 12)
    .map((row) => ({
      archetype: row.archetype,
      colorCombination: row.commonColorCombination,
      recentDecklists: row.recentDecklists,
      recentTop8Decks: row.recentTop8Decks,
      recentWins: row.recentWins,
      recentMetaScore: row.recentMetaScore,
      bestFinish: row.bestFinish,
    }));

  return { ranked, risers, fallers, watch, movements, archetypeTrends };
}

export function buildMetaWindows(data = {}) {
  const resultDates = (data.metaResults || [])
    .map((row) => parseIsoDate(row.eventDate))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const latestTime = parseIsoDate(data.latestEventDate) || resultDates.at(-1) || Date.now();
  const earliestTime = resultDates[0] || latestTime;
  const boosters = (data.products || [])
    .map((product) => ({
      code: String(product.productCode || "").trim().toUpperCase(),
      name: stripProductCode(product.productName || product.productCode || ""),
      releaseTime: parseHumanDate(product.releaseDate),
    }))
    .filter((product) => /^GD\d+$/.test(product.code) && Number.isFinite(product.releaseTime))
    .sort((left, right) => left.releaseTime - right.releaseTime);
  const releasedBoosters = boosters.filter((product) => product.releaseTime <= latestTime);
  const activeBooster = releasedBoosters.at(-1);
  const windows = [];

  if (activeBooster) {
    windows.push({
      id: "current",
      label: `${activeBooster.code} · Current format`,
      shortLabel: activeBooster.code,
      formatCode: activeBooster.code,
      startDate: toIsoDate(activeBooster.releaseTime),
      endDate: toIsoDate(latestTime),
    });
  }

  const rollingStart = latestTime - (29 * DAY_MS);
  windows.push({
    id: "rolling-30",
    label: "Rolling field · 30 days",
    shortLabel: "30D",
    formatCode: activeBooster?.code || "CURRENT",
    startDate: toIsoDate(rollingStart),
    endDate: toIsoDate(latestTime),
  });

  for (let index = releasedBoosters.length - 2; index >= 0; index -= 1) {
    const booster = releasedBoosters[index];
    const nextBooster = releasedBoosters[index + 1];
    const endTime = Math.min(latestTime, nextBooster.releaseTime - DAY_MS);
    if (endTime < earliestTime || booster.releaseTime > latestTime) continue;
    windows.push({
      id: booster.code.toLowerCase(),
      label: `${booster.code} · ${booster.name || "Format"}`,
      shortLabel: booster.code,
      formatCode: booster.code,
      startDate: toIsoDate(booster.releaseTime),
      endDate: toIsoDate(endTime),
    });
  }

  windows.push({
    id: "all",
    label: "All indexed competitive data",
    shortLabel: "ALL",
    formatCode: "ALL",
    startDate: toIsoDate(earliestTime),
    endDate: toIsoDate(latestTime),
  });

  return windows.filter((window, index) => windows.findIndex((candidate) => candidate.id === window.id) === index);
}

export function buildScopedMetaSignal(data = {}, metaWindow) {
  const selectedWindow = metaWindow || buildMetaWindows(data)[0];
  const startTime = parseIsoDate(selectedWindow?.startDate);
  const endTime = parseIsoDate(selectedWindow?.endDate) + DAY_MS - 1;
  const selectedResults = (data.metaResults || []).filter((row) => withinRange(row.eventDate, startTime, endTime));
  const selectedDeckIds = new Set(selectedResults.filter((row) => row.deckId).map((row) => row.deckId));
  const selectedDeckRows = (data.metaDeckCards || []).filter((row) => selectedDeckIds.has(row.deckId));
  const duration = Number.isFinite(startTime) && Number.isFinite(endTime) ? Math.max(DAY_MS, endTime - startTime + 1) : 0;
  const previousStart = duration ? startTime - duration : Number.NaN;
  const previousEnd = duration ? startTime - 1 : Number.NaN;
  const previousResults = duration
    ? (data.metaResults || []).filter((row) => withinRange(row.eventDate, previousStart, previousEnd))
    : [];
  const previousDeckIds = new Set(previousResults.filter((row) => row.deckId).map((row) => row.deckId));
  const previousDeckRows = (data.metaDeckCards || []).filter((row) => previousDeckIds.has(row.deckId));
  const currentUsage = buildCardUsage(selectedDeckRows);
  const previousUsage = buildCardUsage(previousDeckRows);
  const cardMap = new Map((data.cards || []).map((card) => [card.cardNumber, card]));
  const rowMap = new Map([...selectedDeckRows, ...previousDeckRows].map((row) => [row.cardNumber, row]));
  const currentDeckCount = selectedDeckIds.size;
  const previousDeckCount = previousDeckIds.size;
  const allCardNumbers = new Set([...currentUsage.keys(), ...previousUsage.keys()]);

  const allSignals = [...allCardNumbers].map((cardNumber) => {
    const card = cardMap.get(cardNumber) || rowMap.get(cardNumber) || {};
    const recent = currentUsage.get(cardNumber)?.size || 0;
    const previous = previousUsage.get(cardNumber)?.size || 0;
    const recentScore = currentDeckCount ? (recent / currentDeckCount) * 100 : 0;
    const previousScore = previousDeckCount ? (previous / previousDeckCount) * 100 : 0;
    const delta = recentScore - previousScore;
    const band = classifyScopedCard(recentScore, recent);
    const previousBand = classifyScopedCard(previousScore, previous);
    return {
      cardNumber,
      cardName: card.cardName || cardNumber,
      color: card.color || card.cardColor || "-",
      cardType: card.cardType || "-",
      recent,
      all: previous,
      recentScore,
      overallScore: previousScore,
      delta,
      band,
      previousBand,
      movementDelta: bandWeight(band) - bandWeight(previousBand),
      movementDirection: delta > 0.25 ? "up" : delta < -0.25 ? "down" : "flat",
      reason: `${recent}/${currentDeckCount || 0} indexed list(s) · ${recentScore.toFixed(1)}% in ${selectedWindow?.shortLabel || "scope"}.`,
    };
  });
  const ranked = allSignals
    .filter((row) => row.recent > 0)
    .sort((left, right) => right.recentScore - left.recentScore || right.recent - left.recent || right.delta - left.delta);
  const risers = ranked.filter((row) => row.delta > 2).slice(0, 12);
  const fallers = allSignals.filter((row) => row.delta < -2).sort((left, right) => left.delta - right.delta).slice(0, 12);
  const watch = ranked.filter((row) => ["Watch", "Fringe"].includes(row.band)).slice(0, 12);
  const movements = allSignals
    .filter((row) => Math.abs(row.delta) >= 1)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 12);
  const archetypeTrends = buildScopedArchetypes(selectedResults, currentDeckCount, selectedDeckRows);

  return {
    ranked,
    risers,
    fallers,
    watch,
    movements,
    archetypeTrends,
    context: {
      window: selectedWindow,
      deckCount: currentDeckCount,
      previousDeckCount,
      resultCount: selectedResults.length,
      eventCount: new Set(selectedResults.map((row) => row.eventId).filter(Boolean)).size,
    },
  };
}

export function eventBreakdown(events = [], results = []) {
  const recentEvents = events.slice().sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate))).slice(0, 50);
  const colorBreakdown = countBy(results, "colorCombination");
  const archetypeBreakdown = countBy(results, "archetype");
  return { recentEvents, colorBreakdown, archetypeBreakdown };
}

function classifyCard({ recent, all, recentScore, card }) {
  if (recent >= 30 || recentScore >= 25) return "Staple";
  if (recent >= 12 || recentScore >= 10) return "Meta relevante";
  if (recent >= 5) return "Sideboard/meta call";
  const brlReference = Number(card.marketPriceBrlFx || card.marketPriceBrlX5 || 0);
  if (brlReference <= 10 && recent >= 2) return "Low cost util";
  if (recent >= 1 || all >= 8) return "Watch";
  return "Bulk";
}

function classifyScopedCard(share, deckCount) {
  if (share >= 35 || deckCount >= 18) return "Staple";
  if (share >= 16 || deckCount >= 8) return "Meta relevante";
  if (share >= 7 || deckCount >= 4) return "Sideboard/meta call";
  if (deckCount >= 2) return "Watch";
  return deckCount ? "Fringe" : "Absent";
}

function buildCardUsage(rows = []) {
  const usage = new Map();
  for (const row of rows) {
    if (!row.cardNumber || !row.deckId) continue;
    const decks = usage.get(row.cardNumber) || new Set();
    decks.add(row.deckId);
    usage.set(row.cardNumber, decks);
  }
  return usage;
}

function buildScopedArchetypes(results = [], deckCount = 0, deckRows = []) {
  const colorsByDeck = new Map();
  for (const row of deckRows) {
    if (!row.deckId || !row.cardColor || row.cardColor === "Neutral") continue;
    const colors = colorsByDeck.get(row.deckId) || new Set();
    colors.add(row.cardColor);
    colorsByDeck.set(row.deckId, colors);
  }
  const groups = new Map();
  for (const result of results) {
    const archetype = result.archetype || "Unclassified";
    if (["other", "unknown", "unclassified"].includes(String(archetype).trim().toLowerCase())) continue;
    const group = groups.get(archetype) || {
      archetype,
      recentDecklists: 0,
      recentTop8Decks: 0,
      recentWins: 0,
      bestFinish: Number.POSITIVE_INFINITY,
      colors: new Map(),
    };
    group.recentDecklists += 1;
    const rank = Number(result.placingRank || 0);
    if (rank > 0 && rank <= 8) group.recentTop8Decks += 1;
    if (rank === 1) group.recentWins += 1;
    if (rank > 0) group.bestFinish = Math.min(group.bestFinish, rank);
    const inferredColors = [...(colorsByDeck.get(result.deckId) || [])].slice(0, 2).join("/");
    const colorCombination = result.colorCombination || inferredColors;
    if (colorCombination) group.colors.set(colorCombination, (group.colors.get(colorCombination) || 0) + 1);
    groups.set(archetype, group);
  }
  return [...groups.values()]
    .map((group) => ({
      archetype: group.archetype,
      commonColorCombination: [...group.colors].sort((left, right) => right[1] - left[1])[0]?.[0] || "",
      recentDecklists: group.recentDecklists,
      recentTop8Decks: group.recentTop8Decks,
      recentWins: group.recentWins,
      recentMetaScore: deckCount ? (group.recentDecklists / deckCount) * 100 : 0,
      bestFinish: Number.isFinite(group.bestFinish) ? group.bestFinish : "-",
    }))
    .sort((left, right) => right.recentMetaScore - left.recentMetaScore || right.recentWins - left.recentWins)
    .slice(0, 12);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function withinRange(value, startTime, endTime) {
  const time = parseIsoDate(value);
  return Number.isFinite(time) && (!Number.isFinite(startTime) || time >= startTime) && (!Number.isFinite(endTime) || time <= endTime);
}

function parseIsoDate(value) {
  if (!value) return Number.NaN;
  const time = new Date(String(value).slice(0, 10) + "T12:00:00Z").getTime();
  return Number.isNaN(time) ? Number.NaN : time;
}

function parseHumanDate(value) {
  const text = String(value || "").replace(/,/g, ", ").replace(/\s+/g, " ").trim();
  const match = text.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (!match) return Number.NaN;
  const time = new Date(`${match[1]} ${match[2]}, ${match[3]} 12:00:00 UTC`).getTime();
  return Number.isNaN(time) ? Number.NaN : time;
}

function toIsoDate(time) {
  return new Date(time).toISOString().slice(0, 10);
}

function stripProductCode(value) {
  return String(value || "").replace(/\s*\[[^\]]+\]\s*$/, "").trim();
}

function buildReason(card, recent, delta) {
  if (recent > 0) {
    return `${recent} recent Top 16 appearance(s); movement score ${delta.toFixed(1)}.`;
  }
  if (card.hasAltArt) return "No recent Top 16 signal, but tracked as collectible/alt-art.";
  return "No recent competitive signal.";
}

function countBy(rows, key) {
  return Object.entries(rows.reduce((acc, row) => {
    const value = row[key] || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {}))
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function bandWeight(band) {
  return {
    Bulk: 0,
    Watch: 1,
    "Low cost util": 2,
    "Sideboard/meta call": 3,
    "Meta relevante": 4,
    Staple: 5,
  }[band] ?? 0;
}
