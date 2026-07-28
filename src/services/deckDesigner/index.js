import { analyzeRecommendedDeck } from "./deckAnalysis.js";
import { assembleRecommendedDeck, scoreRecommendationPool } from "./deckRecommendationEngine.js";
import { collectDeckResearch, normalizeDeckEvidence } from "./deckResearch.js";

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
  collectDeckResearch,
  normalizeDeckEvidence,
} from "./deckResearch.js";

export function designDeck(data, criteria) {
  const research = collectDeckResearch(data, criteria);
  const resolvedCriteria = research.criteria;
  const normalized = normalizeDeckEvidence(data, research);
  const scored = scoreRecommendationPool(data, normalized, resolvedCriteria);
  const assembled = assembleRecommendedDeck(data, scored, resolvedCriteria);
  return analyzeRecommendedDeck(data, assembled, resolvedCriteria);
}

export function compactDeckDesign(report = {}) {
  return {
    generatedAt: report.generatedAt,
    criteria: report.criteria,
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
