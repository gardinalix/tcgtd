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

export const DECK_RECOMMENDATION_VERSION = "deck-recommendation-2026-07-28";

export function scoreRecommendationPool(data = {}, evidence = {}, criteria = {}) {
  const cards = data.cards || [];
  const selectedColors = normalizeColors(criteria.colors);
  const requiredIds = new Set((evidence.requiredCards || []).map((card) => card.cardNumber));
  const excludedIds = new Set((evidence.excludedCards || []).map((card) => card.cardNumber));
  const observedById = new Map((evidence.cardEvidence || []).map((item) => [item.card.cardNumber, item]));
  const archetypeProfile = (data.archetypes || []).find((profile) =>
    normalizeSearchText(profile.archetype) === normalizeSearchText(criteria.archetype))
    || bestArchetypeProfile(data.archetypes || [], criteria.archetype);
  const signatureTraits = new Set((archetypeProfile?.signatureTraits || []).map(normalizeSearchText));
  const signatureTags = new Set((archetypeProfile?.signatureTags || []).map(normalizeSearchText));
  const unitTokens = normalizeSearchText(criteria.unitQuery);
  const preferenceText = normalizeSearchText(criteria.preferences);
  const budget = Number(criteria.budgetBrl || 0);
  const targetPricePerCopy = budget > 0 ? budget / Number(data.rules?.mainDeckSize || 50) : 0;

  const pool = cards
    .filter((card) => !excludedIds.has(card.cardNumber))
    .filter((card) => !selectedColors.length || card.color === "Neutral" || selectedColors.includes(card.color))
    .map((card) => {
      const observed = observedById.get(card.cardNumber);
      const traitAffinity = affinity(card.traits, signatureTraits);
      const tagAffinity = affinity(card.synergyTags, signatureTags);
      const unitAffinity = unitTokens && normalizeSearchText(card.cardName).includes(unitTokens) ? 1 : 0;
      const archetypeAffinity = Math.max(
        ...(card.topArchetypes || []).map((item) => tokenOverlap(criteria.archetype, item.label)),
        0,
      );
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
      const metaSignal = clamp(Math.log1p(Number(card.recentTop8DecksUsing || 0)) / Math.log(180));
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
      const pricePenalty = targetPricePerCopy > 0 && price > targetPricePerCopy
        ? Math.min(0.32, ((price / targetPricePerCopy) - 1) * 0.08)
        : 0;
      const focusAdjustment = criteria.focus === "casual"
        ? theoreticalSignal * 0.08
        : metaSignal * 0.1;
      const requiredBoost = requiredIds.has(card.cardNumber) ? 1 : 0;
      const finalScore = clamp(
        (observedSignal * 0.58)
        + (theoreticalSignal * 0.18)
        + (preferenceAffinity * 0.08)
        + (metaSignal * 0.1)
        + focusAdjustment
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
        required: requiredIds.has(card.cardNumber),
        score: finalScore,
        expectedCopies: observed?.expectedCopies || (requiredIds.has(card.cardNumber) ? 2 : 0),
      };
    })
    .filter((candidate) =>
      candidate.required
      || candidate.observed
      || candidate.score >= (evidence.matchedDecks?.length ? 0.22 : 0.08))
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
  const mainDeckSize = Number(data.rules?.mainDeckSize || 50);
  const pool = ensureViablePool(data, scored.scoredPool || [], criteria);
  const quantities = {};

  for (const candidate of pool.filter((item) => item.required)) {
    quantities[candidate.card.cardNumber] = Math.min(
      maxCopiesForCard(candidate.card, data.rules),
      Math.max(1, Math.round(candidate.expectedCopies || 2)),
    );
  }

  while (sumQuantities(quantities) < mainDeckSize) {
    const next = pool
      .filter((candidate) =>
        Number(quantities[candidate.card.cardNumber] || 0) < maxCopiesForCard(candidate.card, data.rules))
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

  return {
    ...scored,
    generatedAt: new Date().toISOString(),
    main: quantities,
    resource,
    rows,
    mainCount: sumQuantities(quantities),
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
    recommendationReason: recommendationReason(candidate, category),
  };
}

function ensureViablePool(data, pool, criteria) {
  const poolIds = new Set(pool.map((candidate) => candidate.card.cardNumber));
  const selectedColors = normalizeColors(criteria.colors);
  const fallback = (data.cards || [])
    .filter((card) => !selectedColors.length || card.color === "Neutral" || selectedColors.includes(card.color))
    .filter((card) => !poolIds.has(card.cardNumber))
    .sort((left, right) =>
      Number(right.recentTop8DecksUsing || 0) - Number(left.recentTop8DecksUsing || 0)
      || Number(right.recentMetaScore || 0) - Number(left.recentMetaScore || 0))
    .map((card) => ({
      card,
      source: "inferred",
      observed: null,
      traitAffinity: 0,
      tagAffinity: 0,
      archetypeAffinity: 0,
      unitAffinity: 0,
      metaSignal: clamp(Math.log1p(Number(card.recentTop8DecksUsing || 0)) / Math.log(180)),
      price: cardPriceBrl(card),
      required: false,
      score: 0.08 + clamp(Number(card.recentMetaScore || 0) / 100) * 0.12,
      expectedCopies: 0,
    }));
  return [...pool, ...fallback];
}

function marginalCopyScore(candidate, currentCopies, criteria) {
  const target = Math.max(1, Math.round(candidate.expectedCopies || (candidate.source === "observed" ? 1 : 0)));
  const withinObservedTarget = currentCopies < target;
  const duplicateDecay = withinObservedTarget ? 1.18 : 0.34 / (currentCopies - target + 1);
  const curveValue = Number(candidate.card.cost || 0);
  const curveBalance = curveValue <= 4 ? 0.055 : 0;
  const required = candidate.required && currentCopies < Math.max(1, target) ? 1.4 : 0;
  const casualVariety = criteria.focus === "casual" && currentCopies >= 2 ? -0.06 : 0;
  return (candidate.score * duplicateDecay) + curveBalance + required + casualVariety;
}

function recommendationReason(candidate, category) {
  if (candidate.required) return "Included as a user constraint; quantity is limited by official copy rules.";
  if (candidate.source === "observed") {
    return `${Math.round((candidate.observed?.usageRate || 0) * 100)}% adoption in the matched sample; ${category} slot by observed prevalence.`;
  }
  const signals = [];
  if (candidate.traitAffinity) signals.push("trait fit");
  if (candidate.tagAffinity) signals.push("mechanic fit");
  if (candidate.archetypeAffinity) signals.push("archetype signal");
  if (candidate.metaSignal) signals.push("general meta use");
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
