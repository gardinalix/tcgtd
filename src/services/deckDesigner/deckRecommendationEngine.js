import {
  cardPriceBrl,
  clamp,
  confidenceLabel,
  maxCopiesForCard,
  normalizeColors,
  normalizeSearchText,
  round,
  tokenOverlap,
} from "./deckDesignerUtils.js";
import {
  canAddCardToMain,
  evaluateMainDeckLegality,
  getCardCopyLimit,
} from "../../domain/deckLegality.js";
import { scoreCounterFit } from "./counterPlan.js";

export const DECK_RECOMMENDATION_VERSION = "deck-recommendation-2026-08-27-unit-identity";

export function scoreRecommendationPool(data = {}, evidence = {}, criteria = {}) {
  const cards = data.cards || [];
  const competitiveIntelligence = criteria.competitiveIntelligence !== false;
  const selectedColors = normalizeColors(criteria.colors);
  const requiredIds = new Set((evidence.requiredCards || []).map((card) => card.cardNumber));
  const excludedIds = new Set((evidence.excludedCards || []).map((card) => card.cardNumber));
  const observedById = competitiveIntelligence
    ? new Map((evidence.cardEvidence || []).map((item) => [item.card.cardNumber, item]))
    : new Map();
  const archetypeProfile = (data.archetypes || []).find((profile) =>
    normalizeSearchText(profile.archetype) === normalizeSearchText(criteria.archetype))
    || bestArchetypeProfile(data.archetypes || [], criteria.archetype);
  const signatureTraits = new Set((archetypeProfile?.signatureTraits || []).map(normalizeSearchText));
  const signatureTags = new Set((archetypeProfile?.signatureTags || []).map(normalizeSearchText));
  const unitTokens = normalizeSearchText(criteria.unitQuery);
  const preferenceText = normalizeSearchText(criteria.preferences);
  const budget = Number(criteria.budgetBrl || 0);
  const targetPricePerCopy = budget > 0 ? budget / Number(data.rules?.mainDeckSize || 50) : 0;
  const counterPlan = evidence.counterPlan || {};

  const pool = cards
    .filter((card) => getCardCopyLimit(card, data.rules) > 0)
    .filter((card) => !excludedIds.has(card.cardNumber))
    .filter((card) => !selectedColors.length || card.color === "Neutral" || selectedColors.includes(card.color))
    .map((card) => {
      const observed = observedById.get(card.cardNumber);
      const traitAffinity = affinity(card.traits, signatureTraits);
      const tagAffinity = affinity(card.synergyTags, signatureTags);
      const unitAffinity = unitTokens && normalizeSearchText(card.cardName).includes(unitTokens) ? 1 : 0;
      const observedArchetypeAffinity = Math.max(
        ...(card.topArchetypes || []).map((item) => tokenOverlap(criteria.archetype, item.label)),
        0,
      );
      const archetypeAffinity = competitiveIntelligence ? observedArchetypeAffinity : 0;
      const preferenceAffinity = preferenceText
        ? tokenOverlap(
          preferenceText,
          [
            card.cardName,
            card.effectPreview,
            ...(card.traits || []),
            ...(card.synergyTags || []),
          ].join(" "),
        )
        : 0;
      const metaSignal = competitiveIntelligence
        ? clamp(Math.log1p(Number(card.recentTop8DecksUsing || 0)) / Math.log(180))
        : 0;
      const observedSignal = observed
        ? clamp((observed.weightedUsageRate * 0.62) + (Math.min(1, observed.expectedCopies / 4) * 0.38))
        : 0;
      const theoreticalSignal = clamp(
        (traitAffinity * 0.34)
        + (tagAffinity * 0.24)
        + (archetypeAffinity * 0.2)
        + (unitAffinity * 0.14)
        + (preferenceAffinity * 0.1)
        + (metaSignal * 0.08),
      );
      const price = cardPriceBrl(card);
      const counterFit = scoreCounterFit(card, counterPlan);
      const pricePenalty = targetPricePerCopy > 0 && price > targetPricePerCopy
        ? Math.min(0.32, ((price / targetPricePerCopy) - 1) * 0.08)
        : 0;
      const focusAdjustment = criteria.focus === "casual"
        ? theoreticalSignal * 0.08
        : competitiveIntelligence ? metaSignal * 0.1 : theoreticalSignal * 0.06;
      const requiredBoost = requiredIds.has(card.cardNumber) ? 1 : 0;
      const identitySignal = Math.max(traitAffinity, tagAffinity, archetypeAffinity, unitAffinity);
      const counterEligible = Boolean(observed) || identitySignal >= 0.34;
      const counterBonus = competitiveIntelligence && counterPlan.active && counterEligible ? counterFit.score * 0.1 : 0;
      const finalScore = clamp(
        (observedSignal * 0.58)
        + (theoreticalSignal * 0.18)
        + (preferenceAffinity * 0.08)
        + (metaSignal * 0.1)
        + focusAdjustment
        + counterBonus
        + requiredBoost
        - pricePenalty,
      );
      return {
        card,
        source: observed ? "observed" : "inferred",
        observed,
        traitAffinity,
        tagAffinity,
        archetypeAffinity,
        unitAffinity,
        preferenceAffinity,
        metaSignal,
        price,
        counterScore: counterFit.score,
        counterReasons: counterFit.reasons,
        counterTags: counterFit.matchedTags,
        counterEligible,
        identitySignal,
        required: requiredIds.has(card.cardNumber),
        score: finalScore,
        expectedCopies: observed?.expectedCopies || (requiredIds.has(card.cardNumber) ? 2 : 0),
      };
    })
    .filter((candidate) =>
      candidate.required
      || candidate.observed
      || (competitiveIntelligence
        ? candidate.score >= (evidence.matchedDecks?.length ? 0.22 : 0.08)
        : candidate.identitySignal > 0 || candidate.preferenceAffinity > 0))
    .sort((left, right) =>
      Number(right.required) - Number(left.required)
      || right.score - left.score
      || right.expectedCopies - left.expectedCopies
      || String(left.card.cardNumber).localeCompare(String(right.card.cardNumber)));

  return {
    ...evidence,
    recommendationVersion: DECK_RECOMMENDATION_VERSION,
    archetypeProfile,
    scoredPool: pool,
  };
}

export function assembleRecommendedDeck(data = {}, scored = {}, criteria = {}) {
  if (scored.sourceDeck?.deckId) {
    return assembleCompetitiveSourceDeck(data, scored);
  }
  const mainDeckSize = Number(data.rules?.mainDeckSize || 50);
  const pool = ensureViablePool(data, scored.scoredPool || [], criteria, scored.excludedCards || []);
  const quantities = {};
  const cardMap = new Map((data.cards || []).map((card) => [card.cardNumber, card]));
  const targetDistinctCards = preferredDistinctCardCount(mainDeckSize, pool.length);

  for (const candidate of pool.filter((item) => item.required)) {
    const targetQuantity = Math.min(
      maxCopiesForCard(candidate.card, data.rules),
      Math.max(1, Math.round(candidate.expectedCopies || 2)),
    );
    for (let copy = 0; copy < targetQuantity; copy += 1) {
      if (!canAddCardToMain(quantities, candidate.card, cardMap, data.rules)) break;
      quantities[candidate.card.cardNumber] = Number(quantities[candidate.card.cardNumber] || 0) + 1;
    }
  }

  reserveCounterSlots(quantities, pool, cardMap, data.rules, criteria);

  while (sumQuantities(quantities) < mainDeckSize) {
    const eligible = pool
      .filter((candidate) =>
        Number(quantities[candidate.card.cardNumber] || 0) < maxCopiesForCard(candidate.card, data.rules)
        && canAddCardToMain(quantities, candidate.card, cardMap, data.rules));
    const established = eligible.filter((candidate) => Number(quantities[candidate.card.cardNumber] || 0) > 0);
    const candidates = Object.keys(quantities).length < targetDistinctCards || !established.length
      ? eligible
      : established;
    const next = candidates
      .map((candidate) => ({
        candidate,
        marginal: marginalCopyScore(candidate, Number(quantities[candidate.card.cardNumber] || 0), criteria),
      }))
      .sort((left, right) =>
        right.marginal - left.marginal
        || right.candidate.score - left.candidate.score)[0];
    if (!next) break;
    const cardNumber = next.candidate.card.cardNumber;
    quantities[cardNumber] = Number(quantities[cardNumber] || 0) + 1;
  }

  while (sumQuantities(quantities) > mainDeckSize) {
    const removable = pool
      .filter((candidate) => Number(quantities[candidate.card.cardNumber] || 0) > (candidate.required ? 1 : 0))
      .sort((left, right) => left.score - right.score)[0];
    if (!removable) break;
    quantities[removable.card.cardNumber] -= 1;
    if (!quantities[removable.card.cardNumber]) delete quantities[removable.card.cardNumber];
  }

  const poolById = new Map(pool.map((candidate) => [candidate.card.cardNumber, candidate]));
  const rows = Object.entries(quantities)
    .map(([cardNumber, quantity]) => buildRecommendationRow(
      poolById.get(cardNumber),
      quantity,
      scored.matchedDecks?.length || 0,
    ))
    .filter(Boolean)
    .sort(deckRowSort);
  const resourceCard = (data.resourceCards || [])[0];
  const resource = resourceCard
    ? { [resourceCard.cardNumber]: Number(data.rules?.resourceDeckSize || 10) }
    : {};
  const legality = evaluateMainDeckLegality(quantities, cardMap, data.rules);
  if (!legality.legal) {
    throw new Error(`The recommendation engine produced an illegal deck: ${legality.issues.join(" ")}`);
  }

  return {
    ...scored,
    generatedAt: new Date().toISOString(),
    main: quantities,
    resource,
    rows,
    mainCount: sumQuantities(quantities),
    legality,
  };
}

function assembleCompetitiveSourceDeck(data, scored) {
  const poolById = new Map((scored.scoredPool || [])
    .map((candidate) => [candidate.card.cardNumber, candidate]));
  const quantities = {};
  for (const row of scored.normalizedRows || []) {
    quantities[row.cardNumber] = Number(quantities[row.cardNumber] || 0) + Number(row.quantity || 0);
  }
  const cardMap = new Map((data.cards || []).map((card) => [card.cardNumber, card]));
  const legality = evaluateMainDeckLegality(quantities, cardMap, data.rules);
  if (!legality.legal) {
    throw new Error(`The selected competitive source deck is no longer legal: ${legality.issues.join(" ")}`);
  }
  const rows = Object.entries(quantities)
    .map(([cardNumber, quantity]) => {
      const candidate = poolById.get(cardNumber);
      const recommendation = buildRecommendationRow(candidate, quantity, 1);
      if (!recommendation) return null;
      const category = quantity >= 3
        ? "essential"
        : quantity === 2
          ? "flexible"
          : "experimental";
      return {
        ...recommendation,
        category,
        source: "observed",
        expectedCopies: quantity,
        recommendationReason: `${quantity}x in the selected ${scored.sourceDeck.placingLabel || "competitive"} list by ${scored.sourceDeck.playerName}; preserved exactly from the source deck.`,
      };
    })
    .filter(Boolean)
    .sort(deckRowSort);
  const resourceCard = (data.resourceCards || [])[0];
  const resource = resourceCard
    ? { [resourceCard.cardNumber]: Number(data.rules?.resourceDeckSize || 10) }
    : {};

  return {
    ...scored,
    generatedAt: new Date().toISOString(),
    main: quantities,
    resource,
    rows,
    mainCount: sumQuantities(quantities),
    assemblyMode: "competitive_source",
    legality,
  };
}

export function buildRecommendationRow(candidate, quantity, sampleSize) {
  if (!candidate?.card) return null;
  const usageRate = candidate.observed?.usageRate || 0;
  const confidenceValue = candidate.required
    ? Math.max(0.48, sampleConfidence(sampleSize) * 0.78)
    : clamp(
      (sampleConfidence(sampleSize) * 0.42)
      + (usageRate * 0.42)
      + (candidate.metaSignal * 0.16),
    );
  const category = candidate.required
    ? "essential"
    : candidate.source === "inferred"
      ? "experimental"
      : usageRate >= 0.62
        ? "essential"
        : usageRate >= 0.24
          ? "flexible"
          : "experimental";
  return {
    card: candidate.card,
    quantity,
    category,
    confidence: confidenceLabel(confidenceValue),
    confidenceValue: round(confidenceValue, 2),
    source: candidate.source,
    usageRate: round(usageRate, 2),
    decksUsing: candidate.observed?.decksUsing || 0,
    expectedCopies: round(candidate.expectedCopies, 2),
    counterScore: round(candidate.counterScore || 0, 3),
    counterReasons: candidate.counterReasons || [],
    counterTags: candidate.counterTags || [],
    recommendationReason: recommendationReason(candidate, category),
  };
}

function ensureViablePool(data, pool, criteria, excludedCards = []) {
  const poolIds = new Set(pool.map((candidate) => candidate.card.cardNumber));
  const excludedIds = new Set(excludedCards.map((card) => card.cardNumber));
  const selectedColors = normalizeColors(criteria.colors);
  const competitiveIntelligence = criteria.competitiveIntelligence !== false;
  const fallback = (data.cards || [])
    .filter((card) => getCardCopyLimit(card, data.rules) > 0)
    .filter((card) => !selectedColors.length || card.color === "Neutral" || selectedColors.includes(card.color))
    .filter((card) => !excludedIds.has(card.cardNumber))
    .filter((card) => !poolIds.has(card.cardNumber))
    .sort((left, right) => competitiveIntelligence
      ? Number(right.recentTop8DecksUsing || 0) - Number(left.recentTop8DecksUsing || 0)
        || Number(right.recentMetaScore || 0) - Number(left.recentMetaScore || 0)
      : Number(left.cost || 99) - Number(right.cost || 99)
        || String(left.cardNumber).localeCompare(String(right.cardNumber)))
    .slice(0, competitiveIntelligence ? undefined : 180)
    .map((card) => ({
      card,
      source: "inferred",
      observed: null,
      traitAffinity: 0,
      tagAffinity: 0,
      archetypeAffinity: 0,
      unitAffinity: 0,
      metaSignal: competitiveIntelligence
        ? clamp(Math.log1p(Number(card.recentTop8DecksUsing || 0)) / Math.log(180))
        : 0,
      price: cardPriceBrl(card),
      counterScore: 0,
      counterReasons: [],
      counterTags: [],
      counterEligible: false,
      identitySignal: 0,
      required: false,
      score: competitiveIntelligence
        ? 0.08 + clamp(Number(card.recentMetaScore || 0) / 100) * 0.12
        : 0.08,
      expectedCopies: 0,
    }));
  return [...pool, ...fallback];
}

function reserveCounterSlots(quantities, pool, cardMap, rules, criteria) {
  if (!String(criteria.counterArchetype || "").trim()) return;
  const reserveLimit = Math.min(6, Number(rules?.mainDeckSize || 50));
  let reserved = 0;
  const candidates = pool
    .filter((candidate) => candidate.counterEligible && Number(candidate.counterScore || 0) > 0)
    .sort((left, right) => right.counterScore - left.counterScore
      || right.identitySignal - left.identitySignal
      || Number(Boolean(right.observed)) - Number(Boolean(left.observed))
      || right.score - left.score);

  for (const candidate of candidates) {
    if (reserved >= reserveLimit) break;
    const current = Number(quantities[candidate.card.cardNumber] || 0);
    const cap = maxCopiesForCard(candidate.card, rules);
    if (current >= cap || !canAddCardToMain(quantities, candidate.card, cardMap, rules)) continue;
    quantities[candidate.card.cardNumber] = current + 1;
    reserved += 1;
  }
}

function marginalCopyScore(candidate, currentCopies, criteria) {
  const target = preferredCopyCount(candidate);
  const withinObservedTarget = currentCopies < target;
  const duplicateDecay = currentCopies === 0
    ? 1
    : withinObservedTarget
      ? 0.86
      : 0.22 / (currentCopies - target + 1);
  const curveValue = Number(candidate.card.cost || 0);
  const curveBalance = curveValue <= 4 ? 0.055 : 0;
  const required = candidate.required && currentCopies < Math.max(1, target) ? 1.4 : 0;
  const casualVariety = criteria.focus === "casual" && currentCopies >= 2 ? -0.06 : 0;
  return (candidate.score * duplicateDecay) + curveBalance + required + casualVariety;
}

function preferredDistinctCardCount(mainDeckSize, poolSize) {
  const target = Math.round(mainDeckSize / 2.5);
  return Math.min(poolSize, Math.max(14, Math.min(20, target)));
}

function preferredCopyCount(candidate) {
  const observedTarget = Number(candidate.expectedCopies || 0);
  if (observedTarget > 0) return Math.max(1, Math.round(observedTarget));
  if (candidate.required) return 2;
  if (candidate.source === "observed") return 2;
  return Number(candidate.identitySignal || 0) >= 0.45 ? 3 : 2;
}

function recommendationReason(candidate, category) {
  if (candidate.required) return "Included as a user constraint; quantity is limited by official copy rules.";
  if (candidate.source === "observed") {
    const counterReason = candidate.counterReasons?.[0]
      ? ` Counter plan: ${candidate.counterReasons[0]}.`
      : "";
    return `${Math.round((candidate.observed?.usageRate || 0) * 100)}% adoption in the matched sample; ${category} slot by observed prevalence.${counterReason}`;
  }
  const signals = [];
  if (candidate.traitAffinity) signals.push("trait fit");
  if (candidate.tagAffinity) signals.push("mechanic fit");
  if (candidate.archetypeAffinity) signals.push("archetype signal");
  if (candidate.metaSignal) signals.push("general meta use");
  if (candidate.counterReasons?.[0]) signals.push(`counter plan: ${candidate.counterReasons[0]}`);
  return `Theoretical inclusion from ${signals.join(", ") || "same-color curve coverage"}; not observed in the matched sample.`;
}

function bestArchetypeProfile(profiles, query) {
  return profiles
    .map((profile) => ({ profile, score: tokenOverlap(query, profile.archetype) }))
    .sort((left, right) => right.score - left.score)[0]?.profile || null;
}

function affinity(values = [], targetSet = new Set()) {
  if (!values.length || !targetSet.size) return 0;
  const matches = values.filter((value) => targetSet.has(normalizeSearchText(value))).length;
  return matches / Math.min(values.length, targetSet.size);
}

function sampleConfidence(sampleSize) {
  if (sampleSize >= 12) return 1;
  if (sampleSize >= 6) return 0.78;
  if (sampleSize >= 3) return 0.58;
  if (sampleSize >= 1) return 0.34;
  return 0.16;
}

function deckRowSort(left, right) {
  return String(left.card.cardType).localeCompare(String(right.card.cardType))
    || Number(left.card.cost || 99) - Number(right.card.cost || 99)
    || String(left.card.cardName).localeCompare(String(right.card.cardName));
}

function sumQuantities(section = {}) {
  return Object.values(section).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
}
