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
  const requiredIds = new Set(required.cards.map((card) => card.cardNumber));
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
      cardMap,
    }))
    .filter((candidate) =>
      [...requiredIds].every((cardNumber) =>
        candidate.deckRows.some((row) => row.cardNumber === cardNumber))
      && !candidate.deckRows.some((row) => excludedIds.has(row.cardNumber)));

  const strict = scored.filter((candidate) =>
    (!requestedColors.length || candidate.colorMatch >= 0.95)
    && (!requestedArchetype || candidate.archetypeExactMatch)
    && (!requestedUnit || candidate.unitMatch === 1));
  const related = scored.filter((candidate) =>
    (!requestedColors.length || candidate.colorMatch >= 0.45)
    && (!requestedArchetype || candidate.archetypeMatch >= 0.28)
    && (!requestedUnit || candidate.unitMatch === 1 || candidate.archetypeMatch >= 0.62));
  const sameColors = scored.filter((candidate) =>
    !requestedColors.length || candidate.colorMatch >= 0.95);
  const unitAnchored = requestedUnit
    ? scored.filter((candidate) =>
      candidate.unitMatch === 1
      && (!requestedColors.length || candidate.colorMatch >= 0.45)
      && (!requestedArchetype || candidate.archetypeMatch >= 0.28))
    : [];
  const candidatePool = requestedUnit && !requestedArchetype && unitAnchored.length
    ? unitAnchored
    : strict.length
      ? strict
      : related.length
        ? related
      : sameColors.length
        ? sameColors
        : scored;
  const mainDeckSize = Number(data.rules?.mainDeckSize || 50);
  const matchedDecks = candidatePool
    .filter((candidate) =>
      candidate.mainCount === mainDeckSize
      && candidate.knownMainCount === mainDeckSize)
    .sort(competitiveDeckSort)
    .slice(0, 36);
  const deckVariants = uniqueBy(matchedDecks, (candidate) => candidate.fingerprint)
    .slice(0, 4);
  const inferredShell = inferCompetitiveShell(matchedDecks, {
    requestedColors,
    requestedArchetype,
    requestedUnit,
  });
  const catalogShell = inferCatalogUnitShell(cards, requestedUnit);
  const resolvedColors = requestedColors.length
    ? requestedColors
    : inferredShell.colors.length
      ? inferredShell.colors
      : catalogShell.colors;
  const resolvedArchetype = requestedArchetype
    || inferredShell.archetype
    || catalogShell.archetype;
  const hasAutoSelection = Boolean(
    (!requestedArchetype || !requestedColors.length)
    && (inferredShell.deckCount || catalogShell.matchedCards),
  );

  const matchedDeckIds = new Set(matchedDecks.map((candidate) => candidate.result.deckId));
  const normalizedRows = (data.metaDeckCards || [])
    .filter((row) => matchedDeckIds.has(row.deckId) && cardMap.has(row.cardNumber))
    .map((row) => ({
      ...row,
      quantity: Number(row.quantity || 0),
      card: cardMap.get(row.cardNumber),
    }));
  const exactDecks = matchedDecks.filter((candidate) =>
    (!requestedColors.length || candidate.colorMatch >= 0.95)
    && (!requestedArchetype || candidate.archetypeExactMatch)
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
    resolvedColors.length && card.color !== "Neutral" && !resolvedColors.includes(card.color));
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
  if ((!requestedArchetype || !requestedColors.length) && inferredShell.deckCount) {
    limitations.push(
      `Auto-selected ${resolvedArchetype || "an open strategy"} in ${resolvedColors.join("/") || "unrestricted colors"} from ${inferredShell.deckCount} competitive list(s); this shell is an evidence-weighted inference, not an official classification.`,
    );
  } else if (hasAutoSelection) {
    limitations.push(
      `No competitive shell was observed for the selected unit. ${resolvedArchetype || "The strategy"} in ${resolvedColors.join("/") || "open colors"} is a theoretical fallback inferred from the card catalog, so confidence is reduced.`,
    );
  }

  return {
    version: DECK_RESEARCH_VERSION,
    criteria: {
      ...criteria,
      colors: resolvedColors,
      archetype: resolvedArchetype,
      unitQuery: String(criteria.unitQuery || "").trim(),
    },
    selectionInference: {
      active: hasAutoSelection,
      basis: inferredShell.deckCount ? "competitive_lists" : catalogShell.matchedCards ? "card_catalog" : "none",
      requestedColors,
      requestedArchetype,
      resolvedColors,
      resolvedArchetype,
      supportingDecks: inferredShell.deckCount,
      matchedCards: catalogShell.matchedCards,
      weightedScore: round(inferredShell.score, 3),
    },
    deckVariants,
    primaryDeckId: deckVariants[0]?.result.deckId || "",
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

export function buildDeckVariantResearch(data = {}, research = {}) {
  return (research.deckVariants || []).map((candidate, index) => {
    const deckId = candidate.result.deckId;
    const normalizedRows = (research.normalizedRows || [])
      .filter((row) => row.deckId === deckId);
    const sourceDeck = {
      deckId,
      resultId: candidate.result.resultId || "",
      eventId: candidate.result.eventId || "",
      eventName: candidate.result.eventName || "Competitive event",
      eventDate: candidate.result.eventDate || "",
      eventType: candidate.result.eventType || "",
      playerCount: Number(candidate.result.playerCount || 0),
      playerName: candidate.result.playerName || "Unknown pilot",
      placingLabel: candidate.result.placingLabel || "",
      placingRank: Number(candidate.result.placingRank || 999),
      archetype: candidate.result.archetype || research.criteria?.archetype || "",
      colorCombination: candidate.result.colorCombination || candidate.resultColors.join("/"),
      sourceName: candidate.result.sourceName || "",
      sourceUrl: candidate.result.sourceUrl || "",
      deckUrl: candidate.result.deckUrl || "",
      mainCount: candidate.mainCount,
      variantIndex: index,
    };
    const requestedColors = research.selectionInference?.requestedColors || [];
    const requestedArchetype = research.selectionInference?.requestedArchetype || "";
    const isExact = (!requestedColors.length || candidate.colorMatch >= 0.95)
      && (!requestedArchetype || candidate.archetypeExactMatch)
      && (!research.criteria?.unitQuery || candidate.unitMatch === 1);
    const limitations = (research.limitations || [])
      .filter((item) =>
        !String(item).startsWith("Fewer than three relevant")
        && !String(item).startsWith("The exact combination has a small sample")
        && !String(item).startsWith("Auto-selected")
        && !String(item).startsWith("No competitive shell was observed"));
    limitations.unshift(
      "This map reproduces one competitive decklist independently; card quantities were not averaged across different lists.",
    );

    return {
      ...research,
      criteria: {
        ...research.criteria,
        colors: candidate.resultColors,
        archetype: candidate.result.archetype || research.criteria?.archetype || "",
      },
      matchedDecks: [candidate],
      exactDeckCount: isExact ? 1 : 0,
      normalizedRows,
      sources: buildSources(data, [candidate]),
      limitations,
      sourceDeck,
      facts: {
        ...research.facts,
        matchedDecklists: 1,
        exactDecklists: isExact ? 1 : 0,
        eventCount: candidate.result.eventId ? 1 : 0,
        wins: Number(candidate.result.placingRank) === 1 ? 1 : 0,
        topEight: Number(candidate.result.placingRank) <= 8 ? 1 : 0,
        latestEventDate: candidate.result.eventDate || "",
      },
    };
  });
}

function inferCatalogUnitShell(cards, requestedUnit) {
  if (!requestedUnit) return { archetype: "", colors: [], matchedCards: 0 };
  const matches = cards
    .filter((card) =>
      card.cardType === "UNIT"
      && normalizeSearchText(card.cardName).includes(requestedUnit))
    .sort((left, right) =>
      Number(right.recentTop8DecksUsing || 0) - Number(left.recentTop8DecksUsing || 0)
      || Number(right.recentMetaScore || 0) - Number(left.recentMetaScore || 0));
  const archetypeScores = new Map();
  for (const card of matches) {
    for (const row of card.topArchetypes || []) {
      const label = String(row.label || "").trim();
      if (!label) continue;
      archetypeScores.set(label, Number(archetypeScores.get(label) || 0) + Number(row.count || 0));
    }
  }
  const archetype = [...archetypeScores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] || "";
  const colors = [...new Set(matches
    .map((card) => card.color)
    .filter((color) => color && color !== "Neutral"))].slice(0, 2);
  return { archetype, colors, matchedCards: matches.length };
}

function inferCompetitiveShell(matchedDecks, {
  requestedColors,
  requestedArchetype,
  requestedUnit,
}) {
  const eligible = requestedUnit
    ? matchedDecks.filter((candidate) => candidate.unitMatch === 1)
    : matchedDecks;
  const shells = new Map();

  for (const candidate of eligible) {
    const archetype = String(candidate.result.archetype || "").trim();
    const colors = candidate.resultColors || normalizeColors(candidate.result.colorCombination);
    if (!archetype && !colors.length) continue;
    const key = `${normalizeSearchText(archetype)}|${colors.join("/")}`;
    const current = shells.get(key) || {
      archetype,
      colors,
      deckCount: 0,
      score: 0,
      wins: 0,
    };
    current.deckCount += 1;
    current.score += Math.max(0.15, candidate.relevanceScore)
      * placingWeight(candidate.result.placingRank);
    if (Number(candidate.result.placingRank) === 1) current.wins += 1;
    shells.set(key, current);
  }

  const ranked = [...shells.values()]
    .filter((shell) =>
      (!requestedArchetype || tokenOverlap(requestedArchetype, shell.archetype) >= 0.28)
      && (!requestedColors.length || requestedColors.some((color) => shell.colors.includes(color))))
    .sort((left, right) =>
      right.score - left.score
      || right.wins - left.wins
      || right.deckCount - left.deckCount
      || String(left.archetype).localeCompare(String(right.archetype)));

  return ranked[0] || {
    archetype: requestedArchetype,
    colors: requestedColors,
    deckCount: 0,
    score: 0,
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
  cardMap,
}) {
  const declaredColors = normalizeColors(result.colorCombination);
  const resultColors = declaredColors.length
    ? declaredColors
    : [...new Set(deckRows
      .map((row) => row.cardColor)
      .filter((color) => color && color !== "Neutral"))].slice(0, 2);
  const colorMatch = scoreColors(requestedColors, resultColors);
  const archetypeMatch = requestedArchetype
    ? Math.max(
      tokenOverlap(requestedArchetype, result.archetype),
      normalizeSearchText(result.archetype).includes(normalizeSearchText(requestedArchetype)) ? 1 : 0,
    )
    : 0.7;
  const normalizedRequestedArchetype = normalizeSearchText(requestedArchetype);
  const normalizedResultArchetype = normalizeSearchText(result.archetype);
  const archetypeExactMatch = !requestedArchetype
    || normalizedResultArchetype === normalizedRequestedArchetype
    || normalizedResultArchetype.startsWith(`${normalizedRequestedArchetype} `);
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
  const mainCount = deckRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const knownMainCount = deckRows
    .filter((row) => cardMap.has(row.cardNumber))
    .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const fingerprint = [...deckRows]
    .sort((left, right) => String(left.cardNumber).localeCompare(String(right.cardNumber)))
    .map((row) => `${row.cardNumber}:${Number(row.quantity || 0)}`)
    .join(",");
  return {
    result,
    deckRows,
    resultColors,
    colorMatch,
    archetypeMatch,
    archetypeExactMatch,
    unitMatch,
    relevanceScore,
    mainCount,
    knownMainCount,
    fingerprint,
  };
}

function competitiveDeckSort(left, right) {
  const leftRank = Number(left.result.placingRank || 999);
  const rightRank = Number(right.result.placingRank || 999);
  return leftRank - rightRank
    || Number(right.result.playerCount || 0) - Number(left.result.playerCount || 0)
    || eventStrength(right.result.eventType) - eventStrength(left.result.eventType)
    || String(right.result.eventDate || "").localeCompare(String(left.result.eventDate || ""))
    || right.relevanceScore - left.relevanceScore
    || String(left.result.deckId).localeCompare(String(right.result.deckId));
}

function eventStrength(eventType = "") {
  const normalized = normalizeSearchText(eventType);
  if (normalized.includes("world")) return 5;
  if (normalized.includes("championship") || normalized.includes("regional")) return 4;
  if (normalized.includes("major") || normalized.includes("large")) return 3;
  if (normalized.includes("official")) return 2;
  return 1;
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
