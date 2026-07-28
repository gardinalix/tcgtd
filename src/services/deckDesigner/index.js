import { analyzeRecommendedDeck } from "./deckAnalysis.js";
import { assembleRecommendedDeck, scoreRecommendationPool } from "./deckRecommendationEngine.js";
import {
  buildDeckVariantResearch,
  collectDeckResearch,
  normalizeDeckEvidence,
} from "./deckResearch.js";

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
  normalizeDeckEvidence,
} from "./deckResearch.js";

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

export function compactDeckDesign(report = {}) {
  return {
    generatedAt: report.generatedAt,
    criteria: report.criteria,
    assemblyMode: report.assemblyMode,
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
