import {
  clamp,
  findCardsByTerms,
  normalizeColors,
  normalizeSearchText,
  placingWeight,
  recencyWeight,
  round,
  tokenOverlap,
  uniqueBy,
} from "./deckDesignerUtils.js";

export const DECK_RESEARCH_VERSION = "deck-research-2026-07-28";

export function collectDeckResearch(data = {}, criteria = {}) {
  const cards = data.cards || [];
  const cardMap = new Map(cards.map((card) => [card.cardNumber, card]));
  const rowsByDeck = groupRowsByDeck(data.metaDeckCards || []);
  const requestedColors = normalizeColors(criteria.colors);
  const requestedArchetype = String(criteria.archetype || "").trim();
  const requestedUnit = normalizeSearchText(criteria.unitQuery);
  const latestEventDate = data.latestEventDate || latestDate(data.metaResults || []);
  const required = findCardsByTerms(cards, criteria.requiredCards);
  const excluded = findCardsByTerms(cards, criteria.excludedCards);
  const excludedIds = new Set(excluded.cards.map((card) => card.cardNumber));

  const scored = (data.metaResults || [])
    .filter((result) => result.deckId && rowsByDeck.has(result.deckId))
    .map((result) => scoreResult({
      result,
      deckRows: rowsByDeck.get(result.deckId) || [],
      requestedColors,
      requestedArchetype,
      requestedUnit,
      latestEventDate,
    }))
    .filter((candidate) => candidate.deckRows.some((row) => !excludedIds.has(row.cardNumber)));

  const strict = scored.filter((candidate) =>
    candidate.colorMatch >= 0.95
    && (!requestedArchetype || candidate.archetypeMatch >= 0.62)
    && (!requestedUnit || candidate.unitMatch === 1));
  const related = scored.filter((candidate) =>
    candidate.colorMatch >= 0.45
    && (!requestedArchetype || candidate.archetypeMatch >= 0.28)
    && (!requestedUnit || candidate.unitMatch === 1 || candidate.archetypeMatch >= 0.62));
  const sameColors = scored.filter((candidate) => candidate.colorMatch >= 0.95);
  const candidatePool = strict.length >= 3
    ? strict
    : related.length >= 3
      ? related
      : sameColors.length
        ? sameColors
        : scored;
  const matchedDecks = candidatePool
    .sort((left, right) => right.relevanceScore - left.relevanceScore)
    .slice(0, 36);

  const matchedDeckIds = new Set(matchedDecks.map((candidate) => candidate.result.deckId));
  const normalizedRows = (data.metaDeckCards || [])
    .filter((row) => matchedDeckIds.has(row.deckId) && cardMap.has(row.cardNumber))
    .map((row) => ({
      ...row,
      quantity: Number(row.quantity || 0),
      card: cardMap.get(row.cardNumber),
    }));
  const exactDecks = matchedDecks.filter((candidate) =>
    candidate.colorMatch >= 0.95
    && (!requestedArchetype || candidate.archetypeMatch >= 0.62)
    && (!requestedUnit || candidate.unitMatch === 1));
  const sourceRows = buildSources(data, matchedDecks);
  const limitations = [];

  if (matchedDecks.length < 3) {
    limitations.push("Fewer than three relevant competitive decklists were found; theoretical card analysis has greater weight.");
  } else if (exactDecks.length < 3) {
    limitations.push("The exact combination has a small sample; related archetypes and same-color lists were used as secondary evidence.");
  }
  if (requestedUnit && !matchedDecks.some((candidate) => candidate.unitMatch)) {
    limitations.push("The selected unit was not observed in the matched event lists; its inclusion is treated as a theoretical constraint.");
  }
  if (required.unresolved.length) {
    limitations.push(`Required card terms not found in the official catalog snapshot: ${required.unresolved.join(", ")}.`);
  }
  if (excluded.unresolved.length) {
    limitations.push(`Excluded card terms not found in the official catalog snapshot: ${excluded.unresolved.join(", ")}.`);
  }
  const requiredOutsideColors = required.cards.filter((card) =>
    requestedColors.length && card.color !== "Neutral" && !requestedColors.includes(card.color));
  if (requiredOutsideColors.length) {
    limitations.push(`Required cards outside the selected colors were not included: ${requiredOutsideColors.map((card) => card.cardName).join(", ")}.`);
  }
  const requiredAndExcluded = required.cards.filter((card) => excludedIds.has(card.cardNumber));
  if (requiredAndExcluded.length) {
    limitations.push(`Excluded constraints override required constraints for: ${requiredAndExcluded.map((card) => card.cardName).join(", ")}.`);
  }
  if (!matchedDecks.length) {
    limitations.push("No competitive list matched the filters. The result uses official card data and theoretical synergy only.");
  }

  return {
    version: DECK_RESEARCH_VERSION,
    criteria: {
      ...criteria,
      colors: requestedColors,
      archetype: requestedArchetype,
      unitQuery: String(criteria.unitQuery || "").trim(),
    },
    matchedDecks,
    exactDeckCount: exactDecks.length,
    normalizedRows,
    requiredCards: required.cards,
    excludedCards: excluded.cards,
    unresolvedRequired: required.unresolved,
    unresolvedExcluded: excluded.unresolved,
    sources: sourceRows,
    limitations,
    facts: {
      matchedDecklists: matchedDecks.length,
      exactDecklists: exactDecks.length,
      eventCount: new Set(matchedDecks.map((item) => item.result.eventId).filter(Boolean)).size,
      wins: matchedDecks.filter((item) => Number(item.result.placingRank) === 1).length,
      topEight: matchedDecks.filter((item) => Number(item.result.placingRank) <= 8).length,
      latestEventDate: latestDate(matchedDecks.map((item) => item.result)),
      catalogCards: cards.length,
    },
  };
}

export function normalizeDeckEvidence(data = {}, research = {}) {
  const deckWeights = new Map(research.matchedDecks.map((candidate) => [
    candidate.result.deckId,
    Math.max(0.15, candidate.relevanceScore) * placingWeight(candidate.result.placingRank),
  ]));
  const totalDeckWeight = [...deckWeights.values()].reduce((sum, value) => sum + value, 0);
  const observations = new Map();

  for (const row of research.normalizedRows || []) {
    const weight = deckWeights.get(row.deckId) || 0.25;
    const current = observations.get(row.cardNumber) || {
      card: row.card,
      deckIds: new Set(),
      totalQuantity: 0,
      weightedQuantity: 0,
      weightUsing: 0,
      winsUsing: 0,
      bestFinish: 99,
    };
    if (!current.deckIds.has(row.deckId)) {
      current.deckIds.add(row.deckId);
      current.weightUsing += weight;
      if (Number(row.placingRank) === 1) current.winsUsing += 1;
      current.bestFinish = Math.min(current.bestFinish, Number(row.placingRank || 99));
    }
    current.totalQuantity += Number(row.quantity || 0);
    current.weightedQuantity += Number(row.quantity || 0) * weight;
    observations.set(row.cardNumber, current);
  }

  const cards = [...observations.values()].map((observation) => {
    const usageRate = research.matchedDecks.length
      ? observation.deckIds.size / research.matchedDecks.length
      : 0;
    const weightedUsageRate = totalDeckWeight
      ? observation.weightUsing / totalDeckWeight
      : 0;
    const expectedCopies = totalDeckWeight
      ? observation.weightedQuantity / totalDeckWeight
      : 0;
    return {
      card: observation.card,
      source: "observed",
      decksUsing: observation.deckIds.size,
      winsUsing: observation.winsUsing,
      bestFinish: observation.bestFinish,
      usageRate: round(usageRate, 3),
      weightedUsageRate: round(weightedUsageRate, 3),
      expectedCopies: round(expectedCopies, 3),
      averageCopiesWhenUsed: round(
        observation.weightUsing ? observation.weightedQuantity / observation.weightUsing : 0,
        2,
      ),
    };
  });

  return {
    ...research,
    normalizedAt: new Date().toISOString(),
    totalDeckWeight: round(totalDeckWeight, 3),
    cardEvidence: cards,
  };
}

function scoreResult({
  result,
  deckRows,
  requestedColors,
  requestedArchetype,
  requestedUnit,
  latestEventDate,
}) {
  const resultColors = normalizeColors(result.colorCombination);
  const colorMatch = scoreColors(requestedColors, resultColors);
  const archetypeMatch = requestedArchetype
    ? Math.max(
      tokenOverlap(requestedArchetype, result.archetype),
      normalizeSearchText(result.archetype).includes(normalizeSearchText(requestedArchetype)) ? 1 : 0,
    )
    : 0.7;
  const unitMatch = requestedUnit
    ? Number(deckRows.some((row) => normalizeSearchText(row.cardName).includes(requestedUnit)))
    : 0.7;
  const finish = placingWeight(result.placingRank);
  const recent = recencyWeight(result.eventDate, latestEventDate);
  const relevanceScore = clamp(
    (colorMatch * 0.3)
    + (archetypeMatch * 0.34)
    + (unitMatch * 0.16)
    + (finish * 0.12)
    + (recent * 0.08),
  );
  return {
    result,
    deckRows,
    resultColors,
    colorMatch,
    archetypeMatch,
    unitMatch,
    relevanceScore,
  };
}

function scoreColors(requested, actual) {
  if (!requested.length) return 0.7;
  if (!actual.length) return 0;
  const matches = requested.filter((color) => actual.includes(color)).length;
  if (matches === requested.length && actual.length === requested.length) return 1;
  if (matches === requested.length) return 0.88;
  return matches ? 0.45 * (matches / requested.length) : 0;
}

function groupRowsByDeck(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!row.deckId) continue;
    if (!grouped.has(row.deckId)) grouped.set(row.deckId, []);
    grouped.get(row.deckId).push(row);
  }
  return grouped;
}

function buildSources(data, matchedDecks) {
  const competitive = uniqueBy(matchedDecks
    .filter((candidate) => candidate.result.sourceName || candidate.result.sourceUrl)
    .map((candidate) => ({
      name: candidate.result.sourceName || candidate.result.eventName || "Competitive result",
      url: candidate.result.sourceUrl || candidate.result.deckUrl || "",
      sourceDate: candidate.result.eventDate || "",
      classification: "competitive_result",
      detail: `${candidate.result.eventName || "Event"} · ${candidate.result.placingLabel || "placing unavailable"}`,
    })), (source) => `${source.name}|${source.url}`);
  const official = (data.rules?.officialRules || []).slice(0, 4).map((rule) => ({
    name: rule.source_title || rule.rule_area,
    url: rule.source_url || "",
    sourceDate: rule.source_date || "",
    classification: rule.classification || "official_rule",
    detail: `${rule.rule_area}: ${rule.rule_value}`,
  }));
  const consultationDate = new Date().toISOString();
  return [...official, ...competitive].map((source) => ({ ...source, consultationDate }));
}

function latestDate(rows) {
  return rows
    .map((row) => row.eventDate)
    .filter(Boolean)
    .sort()
    .at(-1) || "";
}
