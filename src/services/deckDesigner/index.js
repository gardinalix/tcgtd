import { analyzeRecommendedDeck } from "./deckAnalysis.js";
import { assembleRecommendedDeck, scoreRecommendationPool } from "./deckRecommendationEngine.js";
import {
  buildDeckVariantResearch,
  collectDeckResearch,
  getObservedArchetypesForFilters,
  getObservedArchetypesForUnit,
  normalizeDeckEvidence,
} from "./deckResearch.js";
import {
  clamp,
  confidenceLabel,
  normalizeSearchText,
  round,
} from "./deckDesignerUtils.js";

export {
  analyzeRecommendedDeck,
  applyRecommendedSubstitution,
  calculateDeckStats,
} from "./deckAnalysis.js";
export {
  assembleRecommendedDeck,
  scoreRecommendationPool,
} from "./deckRecommendationEngine.js";
export {
  buildDeckVariantResearch,
  collectDeckResearch,
  getObservedArchetypesForFilters,
  getObservedArchetypesForUnit,
  normalizeDeckEvidence,
} from "./deckResearch.js";
export {
  buildZeroForgeSaveReport,
  buildZeroForgeWorkspace,
  evaluateZeroForgeAddition,
  ZERO_FORGE_VERSION,
} from "./zeroForgeEngine.js";

export function designDeck(data, criteria) {
  return designDeckVariants(data, criteria)[0];
}

export function designDeckVariants(data, criteria) {
  const research = collectDeckResearch(data, criteria);
  const variants = buildDeckVariantResearch(data, research);
  const researchSets = variants.length ? variants : [research];
  return researchSets.map((variantResearch) => {
    const resolvedCriteria = variantResearch.criteria;
    const normalized = normalizeDeckEvidence(data, variantResearch);
    const scored = scoreRecommendationPool(data, normalized, resolvedCriteria);
    const assembled = assembleRecommendedDeck(data, scored, resolvedCriteria);
    return analyzeRecommendedDeck(data, assembled, resolvedCriteria);
  });
}

export function analyzeImportedDeck(data = {}, parsedDeck = {}, options = {}) {
  const cardMap = new Map((data.cards || []).map((card) => [card.cardNumber, card]));
  const resourceMap = new Map((data.resourceCards || []).map((card) => [card.cardNumber, card]));
  const unknownMainCards = Object.keys(parsedDeck.main || {}).filter((cardNumber) => !cardMap.has(cardNumber));
  const unknownResourceCards = Object.keys(parsedDeck.resource || {}).filter((cardNumber) => !resourceMap.has(cardNumber));
  const recognizedMain = Object.fromEntries(Object.entries(parsedDeck.main || {})
    .filter(([cardNumber]) => cardMap.has(cardNumber)));
  const recognizedResource = Object.fromEntries(Object.entries(parsedDeck.resource || {})
    .filter(([cardNumber]) => resourceMap.has(cardNumber)));
  const main = { ...(parsedDeck.main || {}) };
  const resource = { ...(parsedDeck.resource || {}) };
  const rows = Object.entries(recognizedMain)
    .map(([cardNumber, quantity]) => buildImportedRow(cardMap.get(cardNumber), quantity))
    .sort((left, right) =>
      String(left.card.cardType).localeCompare(String(right.card.cardType))
      || Number(left.card.cost || 99) - Number(right.card.cost || 99)
      || String(left.card.cardNumber).localeCompare(String(right.card.cardNumber)));
  const colors = [...new Set(rows
    .map((row) => row.card.color)
    .filter((color) => color && !["Neutral", "-"].includes(color)))];
  const archetype = options.archetype || inferImportedArchetype(rows);
  const criteria = {
    colors,
    unitQuery: "",
    archetype,
    preferences: "Analyze the pasted MSA list without changing its card quantities.",
    requiredCards: "",
    excludedCards: "",
    budgetBrl: options.budgetBrl || "",
    focus: "competitive",
  };
  const research = collectDeckResearch(data, criteria);
  const limitations = [
    ...(research.limitations || []),
  ];
  if (unknownMainCards.length) {
    limitations.push(`MSA import: ${unknownMainCards.length} main-deck card number(s) were not found in the current catalog: ${unknownMainCards.join(", ")}.`);
  }
  if (unknownResourceCards.length) {
    limitations.push(`MSA import: ${unknownResourceCards.length} resource card number(s) were not found in the current catalog: ${unknownResourceCards.join(", ")}.`);
  }
  if ((parsedDeck.ignoredLines || []).length) {
    limitations.push(`MSA import: ${parsedDeck.ignoredLines.length} line(s) could not be read and were ignored.`);
  }

  return analyzeRecommendedDeck(data, {
    ...research,
    generatedAt: new Date().toISOString(),
    criteria,
    main,
    resource,
    rows,
    mainCount: Object.values(main).reduce((sum, quantity) => sum + Number(quantity || 0), 0),
    assemblyMode: "msa_import",
    importedDeck: {
      name: parsedDeck.title || "My MSA deck",
      format: "MSA pasted list",
      originalMainCount: Number(parsedDeck.mainCount || 0),
      originalResourceCount: Number(parsedDeck.resourceCount || 0),
      recognizedMainCount: Object.values(recognizedMain).reduce((sum, quantity) => sum + Number(quantity || 0), 0),
      recognizedResourceCount: Object.values(recognizedResource).reduce((sum, quantity) => sum + Number(quantity || 0), 0),
      uniqueMainCards: Number(parsedDeck.uniqueMainCards || Object.keys(parsedDeck.main || {}).length),
      unknownMainCards,
      unknownResourceCards,
      ignoredLines: parsedDeck.ignoredLines || [],
    },
    sources: [
      {
        classification: "user_provided_decklist",
        name: "Pasted MSA decklist",
        url: "",
        detail: `${parsedDeck.mainCount || 0} main-deck cards and ${parsedDeck.resourceCount || 0} resource cards supplied by the pilot.`,
        sourceDate: "",
        consultationDate: new Date().toISOString(),
      },
      ...(research.sources || []),
    ],
    limitations,
  }, criteria);
}

export function compactDeckDesign(report = {}) {
  return {
    generatedAt: report.generatedAt,
    criteria: report.criteria,
    assemblyMode: report.assemblyMode,
    importedDeck: report.importedDeck,
    sourceDeck: report.sourceDeck,
    confidence: report.confidence,
    confidenceValue: report.confidenceValue,
    strategy: report.strategy,
    facts: report.facts,
    observedFacts: report.observedFacts,
    limitations: report.limitations,
    strengths: report.strengths,
    weaknesses: report.weaknesses,
    matchups: report.matchups,
    sources: report.sources,
    legality: report.legality,
    cardRecommendations: (report.rows || []).map((row) => ({
      cardNumber: row.card.cardNumber,
      quantity: row.quantity,
      category: row.category,
      confidence: row.confidence,
      source: row.source,
      reason: row.recommendationReason,
    })),
    substitutionHistory: report.substitutionHistory || [],
  };
}

function buildImportedRow(card, quantity) {
  const metaSignal = clamp(Math.log1p(Number(card.recentTop8DecksUsing || 0)) / Math.log(180));
  const confidenceValue = clamp(0.58 + (metaSignal * 0.34));
  return {
    card,
    quantity: Number(quantity || 0),
    category: Number(quantity || 0) >= 3 ? "essential" : "flexible",
    confidence: confidenceLabel(confidenceValue),
    confidenceValue: round(confidenceValue, 2),
    source: "imported",
    usageRate: 0,
    decksUsing: Number(card.recentTop8DecksUsing || 0),
    expectedCopies: Number(quantity || 0),
    recommendationReason: "Preserved exactly from the pasted MSA list.",
  };
}

function inferImportedArchetype(rows = []) {
  const scores = new Map();
  for (const row of rows) {
    for (const profile of row.card.topArchetypes || []) {
      const label = String(profile.label || "").trim();
      if (!label || normalizeSearchText(label) === "other") continue;
      const score = Number(profile.count || 1) * Number(row.quantity || 0);
      scores.set(label, (scores.get(label) || 0) + score);
    }
  }
  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0]
    || "Imported MSA deck";
}
