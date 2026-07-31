import { getCachedSynergy, setCachedSynergy, synergyCacheKey } from "./synergyCacheService.js";
import { clampScore, rankForScore, ruleWeight, uniqueList } from "./synergyRulesEngine.js";
import {
  canDamageFriendlyUnit,
  hasConditionalPairOrLinkWindow,
  hasDestroyedTrigger,
  linkMatchesCard,
  matchCardTextTarget,
  normalizeText,
  overlap,
  parseCardSignals,
} from "./synergyTextParser.js";

const DEFAULT_MIN_SCORE = 20;
const GENERIC_SHARED_KEYWORDS = new Set([
  "activate action",
  "activate main",
  "attack",
  "burst",
  "deploy",
  "destroyed",
  "during link",
  "during pair",
  "link",
  "pair",
  "resource",
  "shield",
  "trash",
  "when linked",
  "when paired",
]);

export function getSynergiesForCard(sourceCard, data, options = {}) {
  if (!sourceCard) return [];
  const key = synergyCacheKey(sourceCard, data);
  const cached = getCachedSynergy(key);
  const minScore = Number(options.minScore ?? DEFAULT_MIN_SCORE);
  const limit = Number(options.limit || 0);
  const raw = cached?.results || calculateSynergies(sourceCard, data);

  if (!cached) {
    setCachedSynergy(key, { sourceCardId: sourceCard.cardNumber, results: raw });
  }

  const filtered = raw.filter((item) => item.score >= minScore);
  return limit > 0 ? filtered.slice(0, limit) : filtered;
}

export function calculateSynergies(sourceCard, data) {
  const allCards = [...(data?.cards || []), ...(data?.resourceCards || [])];
  const metaIndex = buildMetaIndex(data);
  const sourceSignals = parseCardSignals(sourceCard);
  const evaluationContext = {
    knownCardNames: allCards.map((card) => card.cardName).filter(Boolean),
    knownTraits: uniqueList(allCards.flatMap((card) => card.traits || [])),
  };

  return allCards
    .filter((targetCard) => targetCard.cardNumber !== sourceCard.cardNumber)
    .map((targetCard) => evaluateCardSynergy(
      sourceCard,
      targetCard,
      sourceSignals,
      parseCardSignals(targetCard),
      metaIndex,
      evaluationContext,
    ))
    .filter((item) => item.rank !== "none")
    .sort((left, right) =>
      sortPriority(right) - sortPriority(left)
      || right.score - left.score
      || Number(right.coDeckCount || 0) - Number(left.coDeckCount || 0)
      || Number(right.targetCard?.recentMetaScore || 0) - Number(left.targetCard?.recentMetaScore || 0)
      || String(left.targetCard?.cardName || "").localeCompare(String(right.targetCard?.cardName || "")),
    );
}

export function evaluateCardSynergy(sourceCard, targetCard, sourceSignals, targetSignals, metaIndex, evaluationContext = {}) {
  let score = 0;
  const types = [];
  const evidence = [];
  const rules = [];

  function add(ruleId, type, reason, multiplier = 1) {
    const weight = ruleWeight(ruleId) * multiplier;
    if (!weight) return;
    score += weight;
    types.push(type);
    evidence.push(reason);
    rules.push(ruleId);
  }

  const sourceLinksTarget = sourceSignals.linkTargets.filter((link) => linkMatchesCard(link, targetCard, targetSignals));
  const targetLinksSource = targetSignals.linkTargets.filter((link) => linkMatchesCard(link, sourceCard, sourceSignals));
  if (sourceLinksTarget.length || targetLinksSource.length) {
    const pairType = sourceSignals.type === "pilot" || targetSignals.type === "pilot"
      ? sourceSignals.type === "pilot" ? "Unit compatible" : "Pilot compatible"
      : "Direct LINK/PAIR";
    add("direct_link_pair", pairType, `Direct LINK/PAIR bridge detected through ${displayList([...sourceLinksTarget, ...targetLinksSource])}.`);
  }

  const sharedTraits = overlap(sourceSignals.traits, targetSignals.traits);
  if (sharedTraits.length) {
    add("shared_trait", "Trait support", `Shared trait signal: ${displayList(sharedTraits)}.`);
  }

  const sharedTags = overlap(sourceSignals.keywords, targetSignals.keywords).filter((tag) => !GENERIC_SHARED_KEYWORDS.has(tag));
  if (sharedTags.length) {
    add("shared_keyword", "Shared keyword", `Shared tactical keyword/tag: ${displayList(sharedTags)}.`);
  }

  const sharedArchetypes = overlap(archetypeLabels(sourceCard), archetypeLabels(targetCard));
  if (sharedArchetypes.length) {
    add("shared_archetype", "Deck core", `Both cards are associated with ${displayList(sharedArchetypes.slice(0, 3))}.`);
  }

  const coDeck = coDeckInfo(sourceCard.cardNumber, targetCard.cardNumber, metaIndex);
  if (coDeck.count) {
    const multiplier = coDeck.count >= 5 ? 1 : 0.45 + Math.min(coDeck.count, 4) * 0.12;
    add("competitive_cooccurrence", coDeck.count >= 5 ? "Deck core" : "Side option", `Appears together in ${coDeck.count} normalized event decklist(s).`, multiplier);
  }

  const sourceTargetsTarget = matchCardTextTarget(
    sourceCard,
    targetCard,
    sourceSignals,
    targetSignals,
    evaluationContext,
  );
  const targetTargetsSource = matchCardTextTarget(
    targetCard,
    sourceCard,
    targetSignals,
    sourceSignals,
    evaluationContext,
  );
  const textBridgeDetails = [
    sourceTargetsTarget.matched
      ? {
        direction: "source_to_target",
        sourceCardNumber: sourceCard.cardNumber,
        targetCardNumber: targetCard.cardNumber,
        ...sourceTargetsTarget,
      }
      : null,
    targetTargetsSource.matched
      ? {
        direction: "target_to_source",
        sourceCardNumber: targetCard.cardNumber,
        targetCardNumber: sourceCard.cardNumber,
        ...targetTargetsSource,
      }
      : null,
  ].filter(Boolean);
  const textBridgeSpecificity = Math.max(0, ...textBridgeDetails.map((detail) => detail.specificity));
  if (textBridgeDetails.length) {
    const directCommand = targetSignals.type === "command" || sourceSignals.type === "command";
    add(
      "text_bridge",
      directCommand ? "Command interaction" : "Textual bridge",
      `Printed text targets ${textBridgeDetails.map((detail) => detail.label).join("; ")}.`,
      textBridgeSpecificity >= 4 ? 1.5 : directCommand ? 1 : 0.75,
    );
  }

  const mechanicSetup = [];
  const sourceEnablesDestroyed = canDamageFriendlyUnit(sourceSignals) && targetSignals.type === "unit" && hasDestroyedTrigger(targetSignals);
  const targetEnablesDestroyed = canDamageFriendlyUnit(targetSignals) && sourceSignals.type === "unit" && hasDestroyedTrigger(sourceSignals);
  if (sourceEnablesDestroyed || targetEnablesDestroyed) {
    const enabler = sourceEnablesDestroyed ? sourceCard : targetCard;
    const receiver = sourceEnablesDestroyed ? targetCard : sourceCard;
    const receiverSignals = sourceEnablesDestroyed ? targetSignals : sourceSignals;
    const timingNote = hasConditionalPairOrLinkWindow(receiverSignals) ? " while its LINK/PAIR condition is active" : "";
    mechanicSetup.push("destroyed-trigger");
    add(
      "mechanic_setup",
      "Trigger setup",
      `${enabler.cardName} can damage one of your Units, which can set up ${receiver.cardName}'s Destroyed trigger${timingNote}. This is a tactical setup bridge, not an official LINK.`,
      1.2,
    );
  }

  if (sourceSignals.color && targetSignals.color && sourceSignals.color === targetSignals.color) {
    add("same_color", "Color support", `Same color identity: ${displayValue(sourceSignals.color)}.`);
  }

  if (isCurveComplement(sourceSignals.cost, targetSignals.cost)) {
    add("curve_support", "Cost/curve support", `Cost curve is complementary (${sourceCard.cost || "-"} into ${targetCard.cost || "-"}).`);
  }

  const hasHardBridge = sourceLinksTarget.length
    || targetLinksSource.length
    || sharedArchetypes.length
    || coDeck.count
    || mechanicSetup.length
    || textBridgeDetails.length;
  if (!hasHardBridge && sourceSignals.color && targetSignals.color && sourceSignals.color !== targetSignals.color && sourceSignals.color !== "neutral" && targetSignals.color !== "neutral") {
    add("color_conflict", "Color conflict", `Different colors without a confirmed link/deck bridge (${displayValue(sourceSignals.color)} vs ${displayValue(targetSignals.color)}).`);
  }

  const finalScore = calibrateMechanicalScore(score, rules, { textBridgeSpecificity });
  const rank = rankForScore(finalScore);

  return {
    id: `${sourceCard.cardNumber}__${targetCard.cardNumber}`,
    sourceCardId: sourceCard.cardNumber,
    targetCardId: targetCard.cardNumber,
    targetCard,
    score: finalScore,
    rank,
    synergyTypes: uniqueList(types),
    explanation: buildExplanation(rank, evidence, rules),
    evidence: uniqueList(evidence),
    coDeckCount: coDeck.count,
    sharedArchetypes,
    sharedTraits,
    mechanicSetup: uniqueList(mechanicSetup),
    textBridgeDetails,
    textBridgeSpecificity,
    textBridgeLabel: textBridgeDetails
      .sort((left, right) => right.specificity - left.specificity)[0]?.label || "",
    algorithmRules: uniqueList(rules),
  };
}

function sortPriority(result) {
  const rules = new Set(result.algorithmRules || []);
  let priority = 0;
  if (rules.has("direct_link_pair")) priority += 1000;
  if (result.synergyTypes?.some((type) => /pilot compatible|unit compatible/i.test(type))) priority += 500;
  if (rules.has("shared_trait")) priority += 120;
  if (rules.has("mechanic_setup")) priority += 90;
  if (rules.has("competitive_cooccurrence")) priority += Math.min(100, Number(result.coDeckCount || 0) / 4);
  if (rules.has("shared_archetype")) priority += 60;
  if (rules.has("text_bridge")) priority += 45;
  return priority;
}

function calibrateMechanicalScore(rawScore, rules = [], context = {}) {
  const signals = new Set(rules);
  const hasDirectLink = signals.has("direct_link_pair");
  const hasMechanicSetup = signals.has("mechanic_setup");
  const hasTextBridge = signals.has("text_bridge");
  const hasSharedTrait = signals.has("shared_trait");
  const hasSharedKeyword = signals.has("shared_keyword");
  let score = Number(rawScore || 0);

  if (hasDirectLink) return clampScore(Math.max(90, score));
  if (hasMechanicSetup) return clampScore(Math.max(80, score));
  if (hasTextBridge && Number(context.textBridgeSpecificity || 0) >= 4) {
    return clampScore(Math.max(85, score));
  }
  if (hasTextBridge && hasSharedTrait && hasSharedKeyword) {
    return clampScore(Math.max(80, score));
  }
  if (hasTextBridge && hasSharedTrait) {
    return clampScore(Math.min(79, Math.max(65, score)));
  }
  if (hasTextBridge) {
    return clampScore(Math.min(74, Math.max(50, score)));
  }
  if (hasSharedTrait && hasSharedKeyword) {
    return clampScore(Math.min(74, Math.max(50, score)));
  }
  if (hasSharedTrait || hasSharedKeyword) {
    return clampScore(Math.min(49, Math.max(25, score)));
  }
  return clampScore(Math.min(39, score));
}

function buildMetaIndex(data) {
  const cardToDecks = new Map();
  const deckRows = new Map();
  for (const row of data?.metaDeckCards || []) {
    const cardNumber = row.cardNumber;
    const deckId = row.deckId;
    if (!cardNumber || !deckId) continue;
    if (!cardToDecks.has(cardNumber)) cardToDecks.set(cardNumber, new Set());
    cardToDecks.get(cardNumber).add(deckId);
    if (!deckRows.has(deckId)) deckRows.set(deckId, []);
    deckRows.get(deckId).push(row);
  }
  return { cardToDecks, deckRows };
}

function coDeckInfo(sourceCardNumber, targetCardNumber, metaIndex) {
  const sourceDecks = metaIndex.cardToDecks.get(sourceCardNumber) || new Set();
  const targetDecks = metaIndex.cardToDecks.get(targetCardNumber) || new Set();
  let count = 0;
  for (const deckId of sourceDecks) {
    if (targetDecks.has(deckId)) count += 1;
  }
  return { count };
}

function archetypeLabels(card) {
  return (card?.topArchetypes || []).map((item) => normalizeText(item.label)).filter(Boolean);
}

function isCurveComplement(sourceCost, targetCost) {
  if (!Number.isFinite(sourceCost) || !Number.isFinite(targetCost)) return false;
  const low = Math.min(sourceCost, targetCost);
  const high = Math.max(sourceCost, targetCost);
  return (low <= 2 && high >= 3 && high <= 6) || Math.abs(sourceCost - targetCost) <= 1;
}

function buildExplanation(rank, evidence, rules) {
  const visibleEvidence = uniqueList(evidence)
    .sort((left, right) => evidencePriority(right) - evidencePriority(left))
    .slice(0, 3);
  if (!visibleEvidence.length) {
    return "No actionable synergy explanation was generated.";
  }
  const mechanicalRules = new Set([
    "direct_link_pair",
    "mechanic_setup",
    "text_bridge",
    "shared_trait",
    "shared_keyword",
  ]);
  const hasMechanicalBridge = rules.some((rule) => mechanicalRules.has(rule));
  if (!hasMechanicalBridge) {
    return `Low synergy (deck context only): ${visibleEvidence.join(" ")} No direct mechanical bridge was detected.`;
  }
  const prefix = {
    high: "High synergy",
    good: "Good synergy",
    low: "Low synergy",
  }[rank] || "Synergy";
  const isTextOnly = rules.every((rule) => ["text_bridge", "shared_keyword", "same_color", "curve_support"].includes(rule));
  const source = isTextOnly ? " Suggested by textual/heuristic analysis." : "";
  return `${prefix}: ${visibleEvidence.join(" ")}${source}`;
}

function evidencePriority(value) {
  const text = normalizeText(value);
  if (text.startsWith("direct link/pair") || text.startsWith("direct link pair")) return 100;
  if (text.startsWith("printed text targets")) return 95;
  if (text.includes("destroyed trigger") || text.includes("tactical setup bridge")) return 90;
  if (text.startsWith("shared trait")) return 70;
  if (text.startsWith("shared tactical keyword")) return 60;
  if (text.startsWith("appears together")) return 40;
  if (text.startsWith("both cards are associated")) return 30;
  if (text.startsWith("same color")) return 20;
  if (text.startsWith("cost curve")) return 10;
  return 0;
}

function displayList(values) {
  return uniqueList(values.map(displayValue)).slice(0, 4).join(", ");
}

function displayValue(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
