import { getSynergiesForCard } from "../synergyAnalyzer.js";
import {
  cardPriceBrl,
  clamp,
  confidenceLabel,
  maxCopiesForCard,
  normalizeSearchText,
  round,
  titleCase,
  uniqueBy,
} from "./deckDesignerUtils.js";
import { buildRecommendationRow } from "./deckRecommendationEngine.js";
import {
  evaluateMainDeckLegality,
  getCardCopyLimit,
  quantitiesFromRows,
} from "../../domain/deckLegality.js";

export const DECK_ANALYSIS_VERSION = "deck-analysis-2026-08-14-deduped-synergy-copies";

export function analyzeRecommendedDeck(data = {}, assembled = {}, criteria = {}) {
  const stats = calculateDeckStats(assembled.rows || []);
  const cardMap = new Map((data.cards || []).map((card) => [card.cardNumber, card]));
  const legality = validateImportedDeck(
    evaluateMainDeckLegality(assembled.main || {}, cardMap, data.rules),
    assembled.importedDeck,
    data.rules,
  );
  const synergyAnalysis = buildSynergyAnalysis(data, assembled.rows || []);
  const substitutions = buildSubstitutions(data, assembled.rows || [], criteria);
  const confidenceValue = overallConfidence(assembled, stats);
  const observedFacts = [
    `Legality check: ${legality.legal ? "passed" : "failed"} under the official rules effective ${legality.rulesEffectiveDate || "for the current snapshot"}.`,
    ...buildObservedFacts(assembled, stats, assembled.criteria?.competitiveIntelligence !== false),
  ];
  const inferences = buildTheoreticalInferences(assembled.rows || [], stats, assembled, assembled.counterPlan);
  const weaknesses = buildWeaknesses(assembled.rows || [], stats, assembled, assembled.counterPlan);
  const matchups = buildMatchupProjections(assembled.rows || [], stats, assembled.counterPlan);
  const strategy = buildStrategy(criteria, assembled, stats);
  const budgetLimit = Number(criteria.budgetBrl || 0);
  const budgetAssessment = {
    limitBrl: budgetLimit,
    estimatedBrl: stats.estimatedPriceBrl,
    withinBudget: !budgetLimit || stats.estimatedPriceBrl <= budgetLimit,
  };
  const limitations = [...(assembled.limitations || [])]
    .filter((item) => !String(item).startsWith("The tracked-price estimate exceeds"));
  if (budgetLimit && !budgetAssessment.withinBudget) {
    limitations.push(`The tracked-price estimate exceeds the R$ ${budgetLimit.toFixed(2)} budget by R$ ${(stats.estimatedPriceBrl - budgetLimit).toFixed(2)}. Use the affordable substitutions to reduce cost.`);
  }

  return {
    ...assembled,
    analysisVersion: DECK_ANALYSIS_VERSION,
    title: buildTitle(criteria, assembled),
    strategy,
    confidence: confidenceLabel(confidenceValue),
    confidenceValue: round(confidenceValue, 2),
    observedFacts,
    inferences,
    strengths: inferences.slice(0, 3),
    weaknesses,
    matchups,
    counterPlan: assembled.counterPlan,
    synergies: synergyAnalysis.displaySynergies,
    mapSynergies: synergyAnalysis.mapSynergies,
    substitutions,
    stats,
    budgetAssessment,
    legality,
    limitations: uniqueBy(limitations, (item) => item),
    evidenceSummary: buildEvidenceSummary(assembled),
    sideboard: {
      supported: false,
      message: "The current Gundam Card Game rules use a 50-card main deck plus a 10-card resource deck; no sideboard is modeled.",
    },
  };
}

export function applyRecommendedSubstitution(report, sourceCardNumber, targetCardNumber, data = {}) {
  const sourceQuantity = Number(report.main?.[sourceCardNumber] || 0);
  if (!sourceQuantity) return report;
  const sourceSubstitution = (report.substitutions?.[sourceCardNumber] || [])
    .find((item) => item.card.cardNumber === targetCardNumber);
  if (!sourceSubstitution) return report;
  const cardMap = new Map((data.cards || []).map((card) => [card.cardNumber, card]));
  const targetCard = cardMap.get(targetCardNumber);
  if (!targetCard) return report;

  const nextMain = { ...report.main };
  const existingTarget = Number(nextMain[targetCardNumber] || 0);
  const max = maxCopiesForCard(targetCard, data.rules);
  const moved = Math.min(sourceQuantity, Math.max(0, max - existingTarget));
  if (!moved) return report;
  nextMain[targetCardNumber] = existingTarget + moved;
  if (sourceQuantity === moved) delete nextMain[sourceCardNumber];
  else nextMain[sourceCardNumber] = sourceQuantity - moved;
  if (!evaluateMainDeckLegality(nextMain, cardMap, data.rules).legal) return report;

  const originalById = new Map((report.rows || []).map((row) => [row.card.cardNumber, row]));
  const nextRows = Object.entries(nextMain).map(([cardNumber, quantity]) => {
    if (originalById.has(cardNumber)) return { ...originalById.get(cardNumber), quantity };
    const syntheticCandidate = {
      card: cardMap.get(cardNumber),
      source: "inferred",
      observed: null,
      required: false,
      metaSignal: clamp(Math.log1p(Number(cardMap.get(cardNumber)?.recentTop8DecksUsing || 0)) / Math.log(180)),
      expectedCopies: quantity,
    };
    return {
      ...buildRecommendationRow(syntheticCandidate, quantity, report.matchedDecks?.length || 0),
      category: sourceSubstitution.kind === "affordable" ? "accessible" : "flexible",
      recommendationReason: `Applied as a substitution for ${cardMap.get(sourceCardNumber)?.cardName || sourceCardNumber}.`,
    };
  }).sort((left, right) =>
    String(left.card.cardType).localeCompare(String(right.card.cardType))
    || Number(left.card.cost || 99) - Number(right.card.cost || 99));

  return analyzeRecommendedDeck(data, {
    ...report,
    main: nextMain,
    rows: nextRows,
    assemblyMode: report.sourceDeck ? "source_variant_modified" : report.assemblyMode,
    sourceDeck: report.sourceDeck ? { ...report.sourceDeck, modified: true } : report.sourceDeck,
    substitutionHistory: [
      ...(report.substitutionHistory || []),
      {
        sourceCardNumber,
        targetCardNumber,
        quantity: moved,
        appliedAt: new Date().toISOString(),
      },
    ],
  }, report.criteria || {});
}

export function calculateDeckStats(rows = []) {
  const stats = {
    mainCount: 0,
    averageCost: 0,
    estimatedPriceBrl: 0,
    curve: {},
    types: {},
    colors: {},
    categories: {},
    mechanics: {},
  };
  let totalCost = 0;
  for (const row of rows) {
    const quantity = Number(row.quantity || 0);
    const cost = Number(row.card.cost || 0);
    stats.mainCount += quantity;
    totalCost += cost * quantity;
    stats.estimatedPriceBrl += cardPriceBrl(row.card) * quantity;
    increment(stats.curve, Number.isFinite(cost) ? String(cost) : "-", quantity);
    increment(stats.types, row.card.cardType || "Unknown", quantity);
    increment(stats.colors, row.card.color || "Unknown", quantity);
    increment(stats.categories, row.category || "flexible", quantity);
    for (const mechanic of row.card.synergyTags || []) increment(stats.mechanics, mechanic, quantity);
  }
  stats.averageCost = stats.mainCount ? round(totalCost / stats.mainCount, 2) : 0;
  stats.estimatedPriceBrl = round(stats.estimatedPriceBrl, 2);
  return stats;
}

function buildSynergyAnalysis(data, rows) {
  const deckIds = new Set(rows.map((row) => row.card.cardNumber));
  const rowById = new Map(rows.map((row) => [row.card.cardNumber, row]));
  const quantityByDisplayKey = buildSynergyQuantityIndex(rows);
  const pairByDisplayKey = new Map();
  const allPairs = [];
  for (const row of rows) {
    const synergies = getSynergiesForCard(row.card, data, { minScore: 20 })
      .filter((item) => deckIds.has(item.targetCardId));
    for (const synergy of synergies) {
      const targetCard = rowById.get(synergy.targetCardId)?.card || synergy.targetCard;
      const displayPairKey = buildSynergyDisplayPairKey(row.card, targetCard);
      if (!displayPairKey) continue;
      const pairId = [row.card.cardNumber, synergy.targetCardId].sort().join("__");
      const isPrintedMechanic = (synergy.algorithmRules || []).some((rule) =>
        ["direct_link_pair", "mechanic_setup", "text_bridge"].includes(rule));
      const sourceGroup = quantityByDisplayKey.get(synergyCardDisplayKey(row.card));
      const targetGroup = quantityByDisplayKey.get(synergyCardDisplayKey(targetCard));
      const pair = {
        id: pairId,
        displayPairKey,
        sourceCard: row.card,
        targetCard,
        sourceCopies: sourceGroup?.quantity || Number(row.quantity || 0),
        targetCopies: targetGroup?.quantity || Number(rowById.get(synergy.targetCardId)?.quantity || 0),
        sourceCardNumbers: sourceGroup?.cardNumbers || [row.card.cardNumber],
        targetCardNumbers: targetGroup?.cardNumbers || [synergy.targetCardId],
        score: synergy.score,
        rank: synergy.rank,
        confidence: synergy.rank === "high" ? "High" : synergy.rank === "good" ? "Medium" : "Low",
        explanation: synergy.explanation,
        evidence: synergy.evidence,
        coDeckCount: synergy.coDeckCount,
        algorithmRules: synergy.algorithmRules,
        sharedTraits: synergy.sharedTraits,
        mechanicSetup: synergy.mechanicSetup,
        linkPayoffKeywords: synergy.linkPayoffKeywords,
        textBridgeDetails: synergy.textBridgeDetails,
        textBridgeSpecificity: synergy.textBridgeSpecificity,
        textBridgeLabel: synergy.textBridgeLabel,
        facts: synergy.coDeckCount
          ? [`Observed together in ${synergy.coDeckCount} normalized competitive decklists.`]
          : [],
        inference: synergy.coDeckCount
          ? ""
          : isPrintedMechanic
            ? ""
            : "The interaction is inferred from curve, color, traits, or shared mechanic signals.",
      };
      allPairs.push(pair);
      const existing = pairByDisplayKey.get(displayPairKey);
      if (!existing || synergyPairPriority(pair) > synergyPairPriority(existing)) {
        pairByDisplayKey.set(displayPairKey, pair);
      }
    }
  }
  const displaySynergies = selectDeckSynergyPairs(
    [...pairByDisplayKey.values()].sort((left, right) =>
      synergyPairPriority(right) - synergyPairPriority(left)
      || right.score - left.score
      || left.displayPairKey.localeCompare(right.displayPairKey)),
    rows.length,
  ).map((pair) => {
    const variantPayoffs = [...new Set(allPairs
      .filter((variant) => variant.displayPairKey === pair.displayPairKey)
      .flatMap((variant) => variant.linkPayoffKeywords || []))];
    const missingPayoffs = variantPayoffs.filter((payoff) =>
      !(pair.linkPayoffKeywords || []).includes(payoff));
    if (!missingPayoffs.length) return pair;
    return {
      ...pair,
      linkPayoffKeywords: [...new Set([...(pair.linkPayoffKeywords || []), ...missingPayoffs])],
      facts: [
        ...pair.facts,
        `Linked variants also provide: ${missingPayoffs.map(titleCase).join(", ")}.`,
      ],
    };
  });
  const mapSynergies = selectDeckSynergyPairs(
    allPairs.sort((left, right) =>
      synergyPairPriority(right) - synergyPairPriority(left)
      || right.score - left.score
      || left.id.localeCompare(right.id)),
    rows.length,
    { preserveMechanicalVariants: true },
  );
  return { displaySynergies, mapSynergies };
}

function buildSynergyQuantityIndex(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = synergyCardDisplayKey(row.card);
    const current = groups.get(key) || {
      quantity: 0,
      cardNumbers: [],
    };
    current.quantity += Number(row.quantity || 0);
    if (!current.cardNumbers.includes(row.card.cardNumber)) current.cardNumbers.push(row.card.cardNumber);
    groups.set(key, current);
  }
  return groups;
}

function buildSynergyDisplayPairKey(sourceCard, targetCard) {
  const sourceKey = synergyCardDisplayKey(sourceCard);
  const targetKey = synergyCardDisplayKey(targetCard);
  if (!sourceKey || !targetKey || sourceKey === targetKey) return "";
  return [sourceKey, targetKey].sort().join("__");
}

function synergyCardDisplayKey(card) {
  const name = normalizeSearchText(card?.cardName);
  if (!name) return String(card?.cardNumber || "");
  return `${name}::${normalizeSearchText(card?.cardType)}`;
}

function selectDeckSynergyPairs(pairs, nodeCount, options = {}) {
  const selected = [];
  const selectedIds = new Set();
  const mechanicalDegree = new Map();
  const preserveMechanicalVariants = Boolean(options.preserveMechanicalVariants);
  const totalLimit = preserveMechanicalVariants
    ? Math.min(72, Math.max(24, nodeCount * 2))
    : Math.max(24, nodeCount * 3);

  function add(pair, degreeLimit = Number.POSITIVE_INFINITY) {
    if (!pair || selectedIds.has(pair.id) || selected.length >= totalLimit) return false;
    const sourceDegree = mechanicalDegree.get(pair.sourceCard.cardNumber) || 0;
    const targetDegree = mechanicalDegree.get(pair.targetCard.cardNumber) || 0;
    if (sourceDegree >= degreeLimit && targetDegree >= degreeLimit) return false;
    selected.push(pair);
    selectedIds.add(pair.id);
    mechanicalDegree.set(pair.sourceCard.cardNumber, sourceDegree + 1);
    mechanicalDegree.set(pair.targetCard.cardNumber, targetDegree + 1);
    return true;
  }

  const hasRule = (pair, rule) => (pair.algorithmRules || []).includes(rule);
  const direct = pairs.filter((pair) => hasRule(pair, "direct_link_pair"));
  const mechanicSetup = pairs.filter((pair) => hasRule(pair, "mechanic_setup"));
  const specificText = pairs.filter((pair) =>
    hasRule(pair, "text_bridge") && Number(pair.textBridgeSpecificity || 0) >= 3);
  const broadText = pairs.filter((pair) =>
    hasRule(pair, "text_bridge") && Number(pair.textBridgeSpecificity || 0) < 3);
  const sharedMechanics = pairs.filter((pair) =>
    !hasRule(pair, "direct_link_pair")
    && !hasRule(pair, "mechanic_setup")
    && !hasRule(pair, "text_bridge")
    && (hasRule(pair, "shared_trait") || hasRule(pair, "shared_keyword"))
    && ["high", "good"].includes(pair.rank));
  const contextOnly = pairs.filter((pair) =>
    !(pair.algorithmRules || []).some((rule) =>
      ["direct_link_pair", "mechanic_setup", "text_bridge", "shared_trait", "shared_keyword"].includes(rule)));

  direct.forEach((pair) => add(pair, preserveMechanicalVariants ? 3 : Number.POSITIVE_INFINITY));
  mechanicSetup.forEach((pair) => add(pair, preserveMechanicalVariants ? 3 : 6));
  specificText.forEach((pair) => add(pair, preserveMechanicalVariants ? 3 : 6));
  broadText.forEach((pair) => add(pair, preserveMechanicalVariants ? 8 : 4));
  sharedMechanics.forEach((pair) => add(pair, 3));
  contextOnly.forEach((pair) => add(pair, 2));

  return selected.sort((left, right) =>
    synergyPairPriority(right) - synergyPairPriority(left)
    || right.score - left.score
    || left.id.localeCompare(right.id));
}

function synergyPairPriority(pair) {
  const rules = new Set(pair.algorithmRules || []);
  let priority = Number(pair.score || 0);
  if (rules.has("direct_link_pair")) priority += 10_000;
  if (rules.has("mechanic_setup")) priority += 8_000;
  if (rules.has("text_bridge")) priority += 5_000 + (Number(pair.textBridgeSpecificity || 0) * 400);
  if (rules.has("shared_trait")) priority += 800;
  if (rules.has("shared_keyword")) priority += 500;
  if (rules.has("competitive_cooccurrence")) priority += Math.min(300, Number(pair.coDeckCount || 0));
  return priority;
}

function buildSubstitutions(data, rows, criteria) {
  const deckIds = new Set(rows.map((row) => row.card.cardNumber));
  const selectedColors = new Set(criteria.colors || []);
  const cardMap = new Map((data.cards || []).map((card) => [card.cardNumber, card]));
  const main = quantitiesFromRows(rows);
  const substitutions = {};
  for (const row of rows.filter((item) => ["essential", "flexible"].includes(item.category))) {
    const candidates = (data.cards || [])
      .filter((card) => !deckIds.has(card.cardNumber))
      .filter((card) => getCardCopyLimit(card, data.rules) > 0)
      .filter((card) => card.cardType === row.card.cardType)
      .filter((card) => !selectedColors.size || selectedColors.has(card.color) || card.color === "Neutral")
      .filter((card) => substitutionPreservesLegality(main, row, card, cardMap, data.rules))
      .map((card) => compareCards(row.card, card))
      .filter((comparison) => comparison.fitScore >= 0.45)
      .sort((left, right) =>
        right.fitScore - left.fitScore
        || Number(right.kind === "affordable") - Number(left.kind === "affordable")
        || Number(right.card.recentTop8DecksUsing || 0) - Number(left.card.recentTop8DecksUsing || 0));
    const picked = uniqueBy([
      candidates.find((candidate) => candidate.kind === "affordable"),
      ...candidates,
    ].filter(Boolean), (candidate) => candidate.card.cardNumber).slice(0, 2);
    if (picked.length) substitutions[row.card.cardNumber] = picked;
  }
  return substitutions;
}

function substitutionPreservesLegality(main, sourceRow, targetCard, cardMap, rules) {
  const sourceCardNumber = sourceRow.card.cardNumber;
  const sourceQuantity = Number(main[sourceCardNumber] || 0);
  const existingTarget = Number(main[targetCard.cardNumber] || 0);
  const moved = Math.min(
    sourceQuantity,
    Math.max(0, getCardCopyLimit(targetCard, rules) - existingTarget),
  );
  if (!moved) return false;
  const next = {
    ...main,
    [targetCard.cardNumber]: existingTarget + moved,
  };
  if (moved === sourceQuantity) delete next[sourceCardNumber];
  else next[sourceCardNumber] = sourceQuantity - moved;
  return evaluateMainDeckLegality(next, cardMap, rules).legal;
}

function compareCards(source, target) {
  const sourceTraits = new Set((source.traits || []).map(normalizeSearchText));
  const targetTraits = new Set((target.traits || []).map(normalizeSearchText));
  const sourceTags = new Set((source.synergyTags || []).map(normalizeSearchText));
  const targetTags = new Set((target.synergyTags || []).map(normalizeSearchText));
  const sharedTraits = [...sourceTraits].filter((value) => targetTraits.has(value));
  const lostTraits = [...sourceTraits].filter((value) => !targetTraits.has(value));
  const gainedTraits = [...targetTraits].filter((value) => !sourceTraits.has(value));
  const sharedTags = [...sourceTags].filter((value) => targetTags.has(value));
  const lostTags = [...sourceTags].filter((value) => !targetTags.has(value));
  const gainedTags = [...targetTags].filter((value) => !sourceTags.has(value));
  const costDelta = Number(target.cost || 0) - Number(source.cost || 0);
  const sourcePrice = cardPriceBrl(source);
  const targetPrice = cardPriceBrl(target);
  const priceDelta = round(targetPrice - sourcePrice, 2);
  const metaDelta = Number(target.recentMetaScore || 0) - Number(source.recentMetaScore || 0);
  const fitScore = clamp(
    (Math.max(0, 1 - Math.abs(costDelta) / 3) * 0.34)
    + (jaccard(sourceTags, targetTags) * 0.31)
    + (jaccard(sourceTraits, targetTraits) * 0.2)
    + (target.color === source.color ? 0.15 : 0),
  );
  const kind = targetPrice > 0 && sourcePrice > 0 && targetPrice <= sourcePrice * 0.7
    ? "affordable"
    : Number(target.recentTop8DecksUsing || 0) <= 2
      ? "experimental"
      : "flexible";

  return {
    card: target,
    kind,
    fitScore: round(fitScore, 2),
    impact: {
      costDelta,
      priceDelta,
      metaDelta: round(metaDelta, 1),
      sharedTraits,
      lostTraits,
      gainedTraits,
      sharedTags,
      lostTags,
      gainedTags,
    },
    gains: buildGains(target, priceDelta, costDelta, gainedTags, gainedTraits),
    losses: buildLosses(source, metaDelta, lostTags, lostTraits),
    synergyImpact: buildSynergyImpact(sharedTags, lostTags, sharedTraits, lostTraits),
    recommendation: buildSubstitutionRecommendation(kind, costDelta, priceDelta),
  };
}

function buildObservedFacts(report, stats, competitiveIntelligence) {
  const sample = report.facts?.matchedDecklists || 0;
  if (report.importedDeck) {
    const coverage = report.importedDeck.originalMainCount
      ? Math.round((report.importedDeck.recognizedMainCount / report.importedDeck.originalMainCount) * 100)
      : 0;
    return [
      `The pasted MSA list contains ${report.importedDeck.originalMainCount} main-deck cards across ${report.importedDeck.uniqueMainCards} unique card numbers.`,
      report.importedDeck.resourceDefaulted
        ? `Catalog recognition covered ${report.importedDeck.recognizedMainCount} main-deck cards (${coverage}%); the standard resource deck was applied automatically.`
        : `Catalog recognition covered ${report.importedDeck.recognizedMainCount} main-deck cards (${coverage}%) and ${report.importedDeck.recognizedResourceCount} resource cards.`,
      `The analyzed main deck has an average cost of ${stats.averageCost}; every recognized imported quantity was preserved.`,
      `${sample} normalized competitive decklist(s) were available as contextual evidence for the inferred colors and strategy.`,
    ];
  }
  if (!competitiveIntelligence) {
    return [
      "Basic synergy mode: competitive adoption, placements, and matchup counter weighting were not used.",
      `The proposed main deck has ${stats.mainCount} cards with an average cost of ${stats.averageCost}.`,
    ];
  }
  const facts = [
    `${sample} normalized competitive decklist(s) entered the final evidence sample.`,
    `${report.facts?.wins || 0} first-place finish(es) and ${report.facts?.topEight || 0} Top 8 result(s) are present in that sample.`,
    `The proposed main deck has ${stats.mainCount} cards with an average cost of ${stats.averageCost}.`,
  ];
  if (report.sourceDeck) {
    facts.unshift(report.sourceDeck.modified
      ? `This variant started from ${report.sourceDeck.playerName}'s ${report.sourceDeck.placingLabel || report.sourceDeck.placingRank} list at ${report.sourceDeck.eventName}; ${report.substitutionHistory?.length || 0} substitution(s) are currently applied.`
      : `${report.sourceDeck.playerName} placed ${report.sourceDeck.placingLabel || report.sourceDeck.placingRank} at ${report.sourceDeck.eventName}; all ${report.sourceDeck.mainCount} registered card quantities were preserved.`);
  }
  if (report.facts?.latestEventDate) facts.push(`Latest matched event date: ${report.facts.latestEventDate}.`);
  return facts;
}

function buildTheoreticalInferences(rows, stats, report, counterPlan = {}) {
  const mechanics = Object.entries(stats.mechanics).sort((left, right) => right[1] - left[1]);
  const blockers = mechanics.find(([name]) => normalizeSearchText(name) === "blocker")?.[1] || 0;
  const consistency = mechanics
    .filter(([name]) => ["draw", "search"].includes(normalizeSearchText(name)))
    .reduce((sum, [, count]) => sum + count, 0);
  const pressure = mechanics
    .filter(([name]) => ["damage push", "breach", "ap mod"].includes(normalizeSearchText(name)))
    .reduce((sum, [, count]) => sum + count, 0);
  const inferences = [];
  if (report.selectionInference?.active) {
    const shell = `${report.selectionInference.resolvedArchetype || "the strategy"} in ${(report.selectionInference.resolvedColors || []).join("/") || "open colors"}`;
    inferences.push(report.selectionInference.basis === "competitive_lists" && report.criteria?.competitiveIntelligence !== false
      ? `Theoretical: ${shell} was selected as the strongest observed shell across ${report.selectionInference.supportingDecks} relevant list(s).`
      : `Theoretical: ${shell} was inferred from the selected unit's catalog color and archetype signals because no matching competitive shell was observed.`);
  }
  if (stats.averageCost <= 3.1) inferences.push("Theoretical: the low curve should improve early deployment consistency and pressure.");
  if (blockers >= 6) inferences.push(`Theoretical: ${blockers} cards with Blocker signals provide a meaningful defensive layer.`);
  if (consistency >= 6) inferences.push(`Theoretical: ${consistency} draw/search-tagged slots should reduce dead hands.`);
  if (pressure >= 6) inferences.push(`Theoretical: ${pressure} pressure-tagged slots support proactive damage conversion.`);
  if (counterPlan.active) {
    const counterSlots = rows
      .filter((row) => Number(row.counterScore || 0) > 0)
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    inferences.push(`Theoretical counter plan: ${counterSlots} slot(s) carry mechanics mapped against ${counterPlan.targetArchetype}.`);
  }
  if (!inferences.length) inferences.push("Theoretical: the list prioritizes observed card adoption over a single dominant mechanic.");
  return inferences;
}

function buildWeaknesses(rows, stats, report, counterPlan = {}) {
  const weaknesses = [];
  const consistency = (stats.mechanics.draw || 0) + (stats.mechanics.search || 0);
  if (stats.averageCost >= 3.5) weaknesses.push("Theoretical: the higher average cost can produce slower opening sequences.");
  if (consistency < 5) weaknesses.push("Theoretical: limited draw/search signals may increase hand variance.");
  if (report.criteria?.competitiveIntelligence !== false && (report.facts?.matchedDecklists || 0) < 5) weaknesses.push("Evidence risk: the relevant competitive sample is small, so flex slots are less stable.");
  const inferred = rows.filter((row) => row.source === "inferred").reduce((sum, row) => sum + row.quantity, 0);
  if (inferred) weaknesses.push(`Evidence risk: ${inferred} slot(s) are theoretically inferred rather than observed in the matched sample.`);
  if (counterPlan.active) weaknesses.push(`Counter risk: ${counterPlan.targetArchetype} is targeted through catalog mechanic tags, not measured head-to-head results.`);
  if (report.criteria?.competitiveIntelligence === false) weaknesses.push("Basic synergy mode does not measure competitive performance or individual matchups.");
  return weaknesses.length ? weaknesses : ["No opponent-level game data is available; hidden matchup weaknesses cannot be measured directly."];
}

function buildMatchupProjections(rows, stats, counterPlan = {}) {
  const blockers = stats.mechanics.blocker || 0;
  const pressure = (stats.mechanics.damage_push || 0) + (stats.mechanics.breach || 0);
  const consistency = (stats.mechanics.draw || 0) + (stats.mechanics.search || 0);
  const generic = [
    {
      opponent: "Fast pressure shells",
      outlook: blockers >= 6 || stats.averageCost <= 3 ? "Likely stable" : "Potentially difficult",
      confidence: "Low",
      basis: blockers >= 6
        ? `Theory: ${blockers} Blocker-tagged slots can absorb early attacks.`
        : "Theory: the list has limited Blocker density; no head-to-head records are available.",
    },
    {
      opponent: "Slow control / late-game shells",
      outlook: pressure >= 7 ? "Likely favorable pressure" : "Close / unverified",
      confidence: "Low",
      basis: pressure >= 7
        ? `Theory: ${pressure} pressure-tagged slots can punish slower setup.`
        : "Theory: closing speed is not strongly signaled; no head-to-head records are available.",
    },
    {
      opponent: "Resource attrition",
      outlook: consistency >= 6 ? "Resilient on paper" : "Potentially fragile",
      confidence: "Low",
      basis: `Theory based on ${consistency} draw/search-tagged slots; opponent-level event data is unavailable.`,
    },
  ];
  if (!counterPlan.active) return generic;
  const counterSlots = rows
    .filter((row) => Number(row.counterScore || 0) > 0)
    .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  return [{
    opponent: counterPlan.targetArchetype,
    outlook: counterSlots ? "Targeted / theoretical" : "Target selected / limited answers",
    confidence: "Low",
    basis: counterSlots
      ? `Theory: ${counterSlots} slot(s) use mechanics mapped to this profile (${counterPlan.answerTags.join(", ")}). No head-to-head result is claimed.`
      : "The target profile has no mapped answer tags represented in this list; no head-to-head result is available.",
  }, ...generic];
}

function buildStrategy(criteria, report, stats) {
  const archetype = criteria.archetype || "selected archetype";
  const focus = criteria.focus === "casual" ? "casual flexibility" : "competitive consistency";
  const exact = report.exactDeckCount || 0;
  const counterSuffix = report.counterPlan?.active
    ? ` Counter plan: ${report.counterPlan.targetArchetype}; flex priorities use catalog mechanic tags and are not a measured matchup prediction.`
    : "";
  if (report.importedDeck) {
    return `${report.importedDeck.name} was imported from MSA and preserved card for card. The analysis infers ${archetype} from the catalog, then evaluates curve, roles, synergies and risks without rebuilding the list. Average cost: ${stats.averageCost}.`;
  }
  if (report.sourceDeck) {
    return report.sourceDeck.modified
      ? `${archetype} derived from ${report.sourceDeck.playerName}'s ${report.sourceDeck.placingLabel || `place ${report.sourceDeck.placingRank}`} list at ${report.sourceDeck.eventName}, with ${report.substitutionHistory?.length || 0} applied substitution(s). Statistics and synergies reflect the modified variant. Average cost: ${stats.averageCost}.`
      : `${archetype} as registered by ${report.sourceDeck.playerName} for ${report.sourceDeck.placingLabel || `place ${report.sourceDeck.placingRank}`} at ${report.sourceDeck.eventName}. This map preserves the source list intact; AI analysis is limited to roles, synergies, risks and optional substitutions. Average cost: ${stats.averageCost}.`;
  }
  if (criteria.competitiveIntelligence === false) {
    return `${archetype} built from basic synergy. Card text, traits, printed links, tactical tags and curve shape determine the list; competitive adoption, placements and counter targets are excluded. Average cost: ${stats.averageCost}.`;
  }
  return `${archetype} tuned for ${focus}. The shell follows weighted adoption from ${report.facts?.matchedDecklists || 0} relevant lists (${exact} exact matches), then uses official card text, curve and synergy signals to resolve flex slots. Average cost: ${stats.averageCost}.${counterSuffix}`;
}

function buildEvidenceSummary(report) {
  if (report.importedDeck) {
    return `Primary evidence: the pilot's pasted MSA list (${report.importedDeck.originalMainCount} main-deck cards). Catalog and competitive records add context; they do not change imported quantities.`;
  }
  if (report.sourceDeck) {
    return report.sourceDeck.modified
      ? `Source deck: ${report.sourceDeck.playerName}, ${report.sourceDeck.placingLabel || `place ${report.sourceDeck.placingRank}`}, ${report.sourceDeck.eventName} (${report.sourceDeck.eventDate || "date unavailable"}). This local variant has substitutions and no longer exactly matches the registered list.`
      : `Source deck: ${report.sourceDeck.playerName}, ${report.sourceDeck.placingLabel || `place ${report.sourceDeck.placingRank}`}, ${report.sourceDeck.eventName} (${report.sourceDeck.eventDate || "date unavailable"}). Quantities are reproduced without cross-list averaging.`;
  }
  if (report.criteria?.competitiveIntelligence === false) {
    return "Basic synergy mode: the recommendation uses official card data, traits, printed links, mechanic tags and curve coverage without competitive weighting.";
  }
  const sample = report.facts?.matchedDecklists || 0;
  return sample
    ? `Observed evidence: ${sample} list(s), ${report.facts?.eventCount || 0} event(s). Inferences are explicitly labeled.`
    : "No matching competitive decklists were found. Every recommendation is theoretical and confidence is reduced.";
}

function overallConfidence(report, stats) {
  if (report.importedDeck) {
    const originalCount = Math.max(1, Number(report.importedDeck.originalMainCount || 0));
    const coverage = Number(report.importedDeck.recognizedMainCount || 0) / originalCount;
    const sample = Number(report.facts?.matchedDecklists || 0);
    return clamp((coverage * 0.72) + (Math.min(1, sample / 12) * 0.18) + (stats.mainCount === originalCount ? 0.1 : 0));
  }
  if (report.sourceDeck) {
    const placingSignal = Number(report.sourceDeck.placingRank) === 1 ? 0.12 : 0.06;
    const fieldSignal = report.sourceDeck.playerCount >= 128
      ? 0.1
      : report.sourceDeck.playerCount >= 32
        ? 0.05
        : 0;
    return clamp(0.58 + placingSignal + fieldSignal);
  }
  if (report.criteria?.competitiveIntelligence === false) {
    const inferredSlots = (report.rows || [])
      .filter((row) => row.source === "inferred")
      .reduce((sum, row) => sum + row.quantity, 0);
    return clamp(0.36 + ((1 - inferredSlots / Math.max(1, stats.mainCount)) * 0.12));
  }
  const sample = report.facts?.matchedDecklists || 0;
  const exact = report.facts?.exactDecklists || report.exactDeckCount || 0;
  const inferredSlots = (report.rows || [])
    .filter((row) => row.source === "inferred")
    .reduce((sum, row) => sum + row.quantity, 0);
  return clamp(
    (Math.min(1, sample / 12) * 0.52)
    + (Math.min(1, exact / 6) * 0.25)
    + ((1 - inferredSlots / Math.max(1, stats.mainCount)) * 0.23),
  );
}

function buildTitle(criteria, report = {}) {
  if (report.importedDeck?.name) return report.importedDeck.name;
  return [criteria.archetype, criteria.unitQuery].filter(Boolean).join(" · ") || "AI-assisted deck";
}

function validateImportedDeck(legality, importedDeck, rules = {}) {
  if (!importedDeck) return legality;
  const issues = [...(legality.issues || [])];
  const violations = [...(legality.violations || [])];
  const expectedMain = Number(rules.mainDeckSize || 50);
  const expectedResource = Number(rules.resourceDeckSize || 10);

  if (importedDeck.originalMainCount !== expectedMain) {
    const message = `The imported main deck has ${importedDeck.originalMainCount} cards; the current format requires ${expectedMain}.`;
    issues.push(message);
    violations.push({
      type: "main_deck_size",
      expected: expectedMain,
      actual: importedDeck.originalMainCount,
      message,
    });
  }
  if (expectedResource && importedDeck.originalResourceCount !== expectedResource) {
    const message = `The imported resource deck has ${importedDeck.originalResourceCount} cards; the current format requires ${expectedResource}.`;
    issues.push(message);
    violations.push({
      type: "resource_deck_size",
      expected: expectedResource,
      actual: importedDeck.originalResourceCount,
      message,
    });
  }
  const unknownCards = [
    ...(importedDeck.unknownMainCards || []),
    ...(importedDeck.unknownResourceCards || []),
  ];
  if (unknownCards.length) {
    const message = `Catalog validation could not identify: ${unknownCards.join(", ")}.`;
    issues.push(message);
    violations.push({
      type: "unknown_cards",
      cardNumbers: unknownCards,
      message,
    });
  }
  return {
    ...legality,
    legal: legality.legal && !violations.length,
    issues,
    violations,
  };
}

function buildGains(target, priceDelta, costDelta, gainedTags, gainedTraits) {
  const gains = [];
  if (priceDelta < 0) gains.push(`Estimated saving of R$ ${Math.abs(priceDelta).toFixed(2)} per copy.`);
  if (costDelta < 0) gains.push(`Lowers the curve by ${Math.abs(costDelta)} cost.`);
  if (gainedTags.length) gains.push(`Adds mechanic signals: ${gainedTags.join(", ")}.`);
  if (gainedTraits.length) gains.push(`Adds traits: ${gainedTraits.join(", ")}.`);
  if (!gains.length) gains.push(`Offers a similar ${target.cardType} role at cost ${target.cost || "-"}.`);
  return gains;
}

function buildLosses(source, metaDelta, lostTags, lostTraits) {
  const losses = [];
  if (metaDelta < 0) losses.push(`Recent meta signal falls by ${Math.abs(round(metaDelta, 1))} points.`);
  if (lostTags.length) losses.push(`Loses mechanic signals: ${lostTags.join(", ")}.`);
  if (lostTraits.length) losses.push(`Loses traits: ${lostTraits.join(", ")}.`);
  if (!losses.length) losses.push(`Does not reproduce every printed interaction of ${source.cardName}; verify text-specific lines.`);
  return losses;
}

function buildSynergyImpact(sharedTags, lostTags, sharedTraits, lostTraits) {
  const preserved = [...sharedTags, ...sharedTraits];
  const lost = [...lostTags, ...lostTraits];
  if (preserved.length && !lost.length) return `Preserves the main shared signals: ${preserved.join(", ")}.`;
  if (preserved.length && lost.length) return `Preserves ${preserved.join(", ")}, but removes ${lost.join(", ")} bridges.`;
  if (lost.length) return `Removes ${lost.join(", ")} bridges; use only when that package is not central.`;
  return "Role similarity is based on type, color and curve; no direct trait bridge was detected.";
}

function buildSubstitutionRecommendation(kind, costDelta, priceDelta) {
  if (kind === "affordable") return "Recommended when budget or local availability matters more than peak observed adoption.";
  if (kind === "experimental") return "Recommended for testing only; competitive evidence is limited.";
  if (costDelta < 0) return "Recommended when the deck needs a faster curve.";
  if (priceDelta < 0) return "Recommended as a lower-cost flex option.";
  return "Recommended when its gained traits or mechanics fit the expected field.";
}

function jaccard(left, right) {
  const union = new Set([...left, ...right]);
  if (!union.size) return 0;
  let overlap = 0;
  for (const value of left) if (right.has(value)) overlap += 1;
  return overlap / union.size;
}

function categoryWeight(category) {
  return { essential: 4, flexible: 3, accessible: 2, experimental: 1 }[category] || 0;
}

function increment(target, key, value) {
  target[key] = Number(target[key] || 0) + Number(value || 0);
}
