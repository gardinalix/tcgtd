import {
  evaluateMainDeckLegality,
  getCardCopyLimit,
} from "../../domain/deckLegality.js";
import { getSynergiesForCard } from "../synergyAnalyzer.js";
import { calculateDeckStats } from "./deckAnalysis.js";
import { normalizeSearchText, round } from "./deckDesignerUtils.js";

export const ZERO_FORGE_VERSION = "zero-forge-2026-07-30-v3";

const COMPOSITION_TYPES = [
  { id: "unit", type: "UNIT", label: "UNITS" },
  { id: "pilot", type: "PILOT", label: "PILOTS" },
  { id: "command", type: "COMMAND", label: "COMMANDS" },
  { id: "base", type: "BASE", label: "BASES" },
];

const CURVE_BUCKETS = [
  { id: "early", label: "EARLY · COST 0–2", test: (cost) => cost <= 2, targetRatio: 0.36 },
  { id: "mid", label: "MID · COST 3–4", test: (cost) => cost >= 3 && cost <= 4, targetRatio: 0.4 },
  { id: "late", label: "LATE · COST 5+", test: (cost) => cost >= 5, targetRatio: 0.24 },
];

const ROLE_GROUPS = [
  {
    id: "consistency",
    label: "Consistency",
    tags: ["draw", "search"],
    target: 6,
    reason: "Adds draw/search consistency",
  },
  {
    id: "defense",
    label: "Defense",
    tags: ["blocker", "shield", "recovery", "repair"],
    target: 7,
    reason: "Reinforces defense and recovery",
  },
  {
    id: "interaction",
    label: "Interaction",
    tags: ["removal", "bounce", "ap_mod"],
    target: 6,
    reason: "Adds board interaction",
  },
  {
    id: "pressure",
    label: "Pressure",
    tags: ["damage_push", "breach", "attack_support"],
    target: 8,
    reason: "Adds proactive board pressure",
  },
];

export function buildZeroForgeWorkspace(data = {}, main = {}, focusCardNumber = "", options = {}) {
  const cards = data.cards || [];
  const cardMap = new Map(cards.map((card) => [card.cardNumber, card]));
  const rows = Object.entries(main)
    .map(([cardNumber, quantity]) => ({
      card: cardMap.get(cardNumber),
      quantity: Number(quantity || 0),
    }))
    .filter((row) => row.card && row.quantity > 0);
  const mainCount = sumQuantities(main);
  const maxMain = Number(data.rules?.mainDeckSize || 50);
  const colors = activeColors(rows);
  const stats = calculateDeckStats(rows);
  const composition = buildCompositionTelemetry(rows);
  const curve = buildCurveTelemetry(rows, maxMain);
  const roles = buildRoleTelemetry(rows);
  const availability = Object.fromEntries(cards.map((card) => [
    card.cardNumber,
    evaluateZeroForgeAddition(data, main, card, 1, cardMap),
  ]));
  const seedRows = [...rows].sort((left, right) =>
    Number(right.card.cardNumber === focusCardNumber) - Number(left.card.cardNumber === focusCardNumber)
    || right.quantity - left.quantity
    || Number(right.card.recentTop8DecksUsing || 0) - Number(left.card.recentTop8DecksUsing || 0));
  const deckIds = new Set(rows.map((row) => row.card.cardNumber));
  const relationsByCandidate = new Map();
  const edgeById = new Map();

  for (const row of seedRows) {
    const sourceCard = row.card;
    const relations = getSynergiesForCard(sourceCard, data, { minScore: 20 });
    for (const relation of relations) {
      if (deckIds.has(relation.targetCardId)) {
        const edge = edgeFromRelation(sourceCard.cardNumber, relation);
        if (!edge) continue;
        const existing = edgeById.get(edge.id);
        if (!existing || edge.priority > existing.priority) edgeById.set(edge.id, edge);
        continue;
      }
      if (!relationsByCandidate.has(relation.targetCardId)) relationsByCandidate.set(relation.targetCardId, []);
      relationsByCandidate.get(relation.targetCardId).push({
        sourceCard,
        relation,
        focused: sourceCard.cardNumber === focusCardNumber,
      });
    }
  }

  const suggestions = cards
    .filter((card) => !deckIds.has(card.cardNumber))
    .filter((card) => availability[card.cardNumber]?.allowed)
    .map((card) => scoreSuggestion(card, {
      relations: relationsByCandidate.get(card.cardNumber) || [],
      curve,
      roles,
      colors,
      maxColors: Number(data.rules?.maxColors || 2),
    }))
    .filter((suggestion) => suggestion.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || Number(right.card.recentTop8DecksUsing || 0) - Number(left.card.recentTop8DecksUsing || 0)
      || String(left.card.cardName).localeCompare(String(right.card.cardName)))
    .slice(0, Number(options.limit || 8))
    .map((suggestion, index) => ({ ...suggestion, rank: index + 1 }));

  const legality = evaluateMainDeckLegality(main, cardMap, data.rules || {});
  const issues = [...legality.issues];
  const violations = [...legality.violations];
  if (colors.length > Number(data.rules?.maxColors || 2)) {
    const message = `The deck exceeds the ${data.rules?.maxColors || 2}-color limit.`;
    issues.push(message);
    violations.push({
      type: "color_limit",
      cardNumbers: rows.map((row) => row.card.cardNumber),
      message,
    });
  }
  if (mainCount !== maxMain) {
    issues.push(`Main deck must have ${maxMain} cards. Current: ${mainCount}.`);
  }

  return {
    version: ZERO_FORGE_VERSION,
    rows,
    mainCount,
    maxMain,
    colors,
    stats,
    composition,
    curve,
    roles,
    suggestions,
    availability,
    edges: [...edgeById.values()]
      .sort((left, right) => right.priority - left.priority || right.score - left.score)
      .slice(0, Math.max(24, rows.length * 3)),
    legal: legality.legal && colors.length <= Number(data.rules?.maxColors || 2) && mainCount === maxMain,
    structurallyLegal: legality.legal && colors.length <= Number(data.rules?.maxColors || 2),
    issues,
    violations,
    remaining: Math.max(0, maxMain - mainCount),
  };
}

export function prepareZeroForgeMsaImport(data = {}, parsedDeck = {}) {
  const cardMap = new Map((data.cards || []).map((card) => [card.cardNumber, card]));
  const resourceMap = new Map((data.resourceCards || []).map((card) => [card.cardNumber, card]));
  const recognizedMain = {};
  const recognizedResource = {};
  const unknownMainCards = [];
  const unknownResourceCards = [];

  for (const [cardNumber, quantity] of Object.entries(parsedDeck.main || {})) {
    if (cardMap.has(cardNumber)) recognizedMain[cardNumber] = Number(quantity || 0);
    else unknownMainCards.push(cardNumber);
  }
  for (const [cardNumber, quantity] of Object.entries(parsedDeck.resource || {})) {
    if (resourceMap.has(cardNumber) || cardMap.has(cardNumber)) {
      recognizedResource[cardNumber] = Number(quantity || 0);
    } else {
      unknownResourceCards.push(cardNumber);
    }
  }

  const firstCardNumber = Object.keys(recognizedMain)[0] || "";
  const recognizedResourceCount = sumQuantities(recognizedResource);
  const expectedResourceCount = Number(data.rules?.resourceDeckSize || 10);
  const hasPastedResources = Object.keys(parsedDeck.resource || {}).length > 0;
  const canPreserveResources = !hasPastedResources
    || (recognizedResourceCount === expectedResourceCount && !unknownResourceCards.length);
  const resourceWarning = hasPastedResources && !canPreserveResources
    ? "Imported resources were incomplete or invalid, so the standard resource deck will be used when saving."
    : "";
  const mainCount = sumQuantities(recognizedMain);
  const maxMain = Number(data.rules?.mainDeckSize || 50);
  const rows = Object.entries(recognizedMain).map(([cardNumber, quantity]) => ({
    card: cardMap.get(cardNumber),
    quantity,
  }));
  const colors = activeColors(rows);
  const maxColors = Number(data.rules?.maxColors || 2);
  const legality = evaluateMainDeckLegality(recognizedMain, cardMap, data.rules || {});
  const issues = [...legality.issues];
  const violations = [...legality.violations];
  if (colors.length > maxColors) {
    const message = `The deck exceeds the ${maxColors}-color limit.`;
    issues.push(message);
    violations.push({
      type: "color_limit",
      cardNumbers: rows.map((row) => row.card.cardNumber),
      message,
    });
  }
  if (mainCount !== maxMain) issues.push(`Main deck must have ${maxMain} cards. Current: ${mainCount}.`);
  const workspace = {
    mainCount,
    maxMain,
    colors,
    legal: legality.legal && colors.length <= maxColors && mainCount === maxMain,
    structurallyLegal: legality.legal && colors.length <= maxColors,
    issues,
    violations,
  };
  return {
    title: String(parsedDeck.title || "My MSA deck").trim() || "My MSA deck",
    main: recognizedMain,
    resource: canPreserveResources ? recognizedResource : {},
    pastedMainCount: Number(parsedDeck.mainCount || sumQuantities(parsedDeck.main)),
    recognizedMainCount: sumQuantities(recognizedMain),
    recognizedResourceCount,
    expectedResourceCount,
    resourceWarning,
    recognizedUniqueMainCards: Object.keys(recognizedMain).length,
    unknownMainCards,
    unknownResourceCards,
    ignoredLines: parsedDeck.ignoredLines || [],
    firstCardNumber,
    workspace,
    canImport: mainCount > 0,
  };
}

export function describeZeroForgeCardState(workspace = {}, main = {}, card = {}) {
  const cardNumber = card.cardNumber || "";
  const quantity = Number(main?.[cardNumber] || 0);
  const assessment = workspace.availability?.[cardNumber] || {};
  const maxCopies = Number(assessment.maxCopies ?? card.copyLimit ?? 4);
  const violation = (workspace.violations || [])
    .find((item) => (item.cardNumbers || []).includes(cardNumber));

  if (violation) {
    return {
      status: "RULE VIOLATION",
      detail: violation.message || assessment.reason || "This card conflicts with the current deck rules.",
      className: "is-locked",
      statusClassName: "is-blocked",
      quantity,
      maxCopies,
      violation,
    };
  }

  if (quantity > 0) {
    if (maxCopies === 0) {
      return {
        status: "BANNED",
        detail: assessment.reason || `${card.cardName || cardNumber} is banned by the current rules.`,
        className: "is-locked",
        statusClassName: "is-blocked",
        quantity,
        maxCopies,
      };
    }
    if (quantity >= maxCopies) {
      return {
        status: "IN DECK · COPY LIMIT",
        detail: `${quantity}/${maxCopies} copies in deck`,
        className: "is-limit",
        statusClassName: "is-limit",
        quantity,
        maxCopies,
      };
    }
    return {
      status: "IN DECK · LEGAL",
      detail: workspace.mainCount >= workspace.maxMain
        ? `Main deck full · ${quantity}/${maxCopies} copies`
        : `${quantity}/${maxCopies} copies in deck`,
      className: "is-deck",
      statusClassName: "",
      quantity,
      maxCopies,
    };
  }

  if (maxCopies === 0 || assessment.type === "banned_card") {
    return {
      status: "BANNED",
      detail: assessment.reason || `${card.cardName || cardNumber} is banned by the current rules.`,
      className: "is-locked",
      statusClassName: "is-blocked",
      quantity,
      maxCopies,
    };
  }
  if (assessment.allowed) {
    return {
      status: "LEGAL ADDITION",
      detail: assessment.reason || "Available to add",
      className: "is-legal",
      statusClassName: "",
      quantity,
      maxCopies,
    };
  }
  if (assessment.type === "main_deck_size") {
    return {
      status: "DECK CAPACITY REACHED",
      detail: "Remove a card before adding this one.",
      className: "is-limit",
      statusClassName: "is-limit",
      quantity,
      maxCopies,
    };
  }
  return {
    status: "LOCKED BY DECK RULES",
    detail: assessment.reason || "This card conflicts with the current deck rules.",
    className: "is-locked",
    statusClassName: "is-blocked",
    quantity,
    maxCopies,
  };
}

export function evaluateZeroForgeAddition(data = {}, main = {}, card = {}, amount = 1, existingCardMap) {
  const cardMap = existingCardMap || new Map((data.cards || []).map((item) => [item.cardNumber, item]));
  const current = Number(main?.[card.cardNumber] || 0);
  const maxCopies = getCardCopyLimit(card, data.rules || {});
  const nextCount = sumQuantities(main) + Number(amount || 0);
  const maxMain = Number(data.rules?.mainDeckSize || 50);

  if (!card?.cardNumber || amount <= 0) {
    return blocked("Invalid card selection.", "invalid_card", maxCopies);
  }
  if (nextCount > maxMain) {
    return blocked(`The main deck is already at its ${maxMain}-card limit.`, "main_deck_size", maxCopies);
  }
  if (current + amount > maxCopies) {
    const reason = maxCopies === 0
      ? `${card.cardName || card.cardNumber} is banned by the current rules.`
      : `${card.cardName || card.cardNumber} is limited to ${maxCopies} copies.`;
    return blocked(reason, maxCopies === 0 ? "banned_card" : "copy_limit", maxCopies);
  }

  const nextMain = {
    ...main,
    [card.cardNumber]: current + amount,
  };
  const nextRows = Object.keys(nextMain)
    .map((cardNumber) => cardMap.get(cardNumber))
    .filter(Boolean);
  const colors = [...new Set(nextRows
    .map((item) => item.color)
    .filter((color) => color && !["Neutral", "-"].includes(color)))];
  const maxColors = Number(data.rules?.maxColors || 2);
  if (colors.length > maxColors) {
    return blocked(
      `${card.cardName || card.cardNumber} would create a third deck color; the current limit is ${maxColors}.`,
      "color_limit",
      maxCopies,
    );
  }

  const legality = evaluateMainDeckLegality(nextMain, cardMap, data.rules || {});
  if (!legality.legal) {
    const violation = legality.violations[0];
    return blocked(violation?.message || legality.issues[0], violation?.type || "rules", maxCopies, violation);
  }

  return {
    allowed: true,
    reason: current ? `Copy ${current + amount} of ${card.cardName} is legal.` : `${card.cardName} can enter the deck.`,
    type: "allowed",
    maxCopies,
    nextQuantity: current + amount,
    nextMain,
  };
}

export function buildZeroForgeSaveReport(data = {}, main = {}, options = {}) {
  const workspace = buildZeroForgeWorkspace(data, main, options.focusCardNumber, { limit: 8 });
  const title = String(options.title || "ZERO Forge Deck").trim() || "ZERO Forge Deck";
  const importedFromMsa = Boolean(options.importedFromMsa);
  const resourceCard = (data.resourceCards || [])[0];
  const resourceCount = Number(data.rules?.resourceDeckSize || 10);
  const importedResource = Object.fromEntries(Object.entries(options.resource || {})
    .filter(([, quantity]) => Number(quantity || 0) > 0)
    .map(([cardNumber, quantity]) => [cardNumber, Number(quantity)]));
  const resource = Object.keys(importedResource).length
    ? importedResource
    : resourceCard?.cardNumber
      ? { [resourceCard.cardNumber]: resourceCount }
      : {};
  const rows = workspace.rows.map((row) => ({
    ...row,
    category: row.quantity >= 3 ? "essential" : "flexible",
    confidence: "Medium",
    confidenceValue: 0.65,
    source: "zero_forge",
    recommendationReason: "Added by the pilot in ZERO Forge assisted construction.",
  }));

  return {
    generatedAt: new Date().toISOString(),
    title,
    main: { ...main },
    resource,
    rows,
    criteria: {
      colors: workspace.colors,
      unitQuery: "",
      archetype: "ZERO Forge",
      preferences: importedFromMsa
        ? "MSA deck imported and edited through map-driven assisted construction."
        : "Map-driven assisted construction from zero.",
      requiredCards: "",
      excludedCards: "",
      budgetBrl: "",
      focus: "competitive",
    },
    assemblyMode: "zero_forge",
    forgeOrigin: importedFromMsa ? "msa_import" : "from_zero",
    strategy: importedFromMsa
      ? `Imported from MSA and edited in ZERO Forge with rule-aware additions and live synergy, curve, trait and board-pressure guidance. Current main deck: ${workspace.mainCount}/${workspace.maxMain}.`
      : `Built from zero in ZERO Forge with rule-aware additions and live synergy, curve, trait and board-pressure guidance. Current main deck: ${workspace.mainCount}/${workspace.maxMain}.`,
    confidence: workspace.legal ? "High" : "Medium",
    confidenceValue: workspace.legal ? 0.82 : 0.62,
    limitations: workspace.issues,
    facts: {
      matchedDecklists: 0,
      eventCount: 0,
    },
    observedFacts: [],
    strengths: [],
    weaknesses: [],
    matchups: [],
    synergies: [],
    substitutions: {},
    stats: workspace.stats,
    legality: {
      legal: workspace.legal,
      issues: workspace.issues,
      violations: workspace.violations,
      rulesEffectiveDate: data.rules?.legalityEffectiveDate || "",
      sourceUrl: data.rules?.legalitySourceUrl || "",
    },
    sources: [],
    evidenceSummary: importedFromMsa
      ? "Pilot-imported MSA deck edited with live catalog, competitive co-play and printed-text assistance."
      : "Pilot-authored deck with live catalog, competitive co-play and printed-text assistance.",
  };
}

function scoreSuggestion(card, context) {
  const relations = [...context.relations].sort((left, right) =>
    relationPriority(right) - relationPriority(left));
  const best = relations[0] || null;
  let score = metaScore(card);
  const reasons = [];

  for (const [index, item] of relations.slice(0, 4).entries()) {
    const multiplier = item.focused ? 1.35 : index === 0 ? 0.72 : 0.32;
    score += relationPriority(item) * multiplier;
  }

  if (best) reasons.push(...relationReasons(best));

  const curveBucket = context.curve.find((bucket) => bucket.test(Number(card.cost || 0)));
  if (curveBucket?.need > 0) {
    score += Math.min(24, 5 + curveBucket.need * 1.5);
    reasons.push(`Fills the ${curveBucket.label.toLowerCase()} curve`);
  } else if (curveBucket?.need < -3) {
    score -= 8;
  }

  const tags = new Set((card.synergyTags || []).map(normalizeTag));
  for (const role of context.roles) {
    if (role.need <= 0 || !role.tags.some((tag) => tags.has(tag))) continue;
    score += Math.min(18, 4 + role.need * 1.5);
    reasons.push(role.reason);
  }

  const color = String(card.color || "");
  if (!color || color === "Neutral" || color === "-") {
    score += 2;
  } else if (context.colors.includes(color)) {
    score += 12;
  } else if (context.colors.length < context.maxColors) {
    score += 1;
  }

  return {
    card,
    score: round(score, 1),
    strength: best?.relation?.rank || (score >= 95 ? "good" : "support"),
    category: score >= 145 ? "priority" : score >= 90 ? "strong" : "support",
    bestSourceCardNumber: best?.sourceCard?.cardNumber || "",
    bestSourceCard: best?.sourceCard || null,
    relation: best?.relation || null,
    reasons: [...new Set(reasons)].slice(0, 3),
  };
}

function relationPriority(item) {
  const relation = item?.relation || item;
  const rules = new Set(relation?.algorithmRules || []);
  let score = Number(relation?.score || 0) * 0.48;
  if (rules.has("direct_link_pair")) score += 72;
  if (rules.has("mechanic_setup")) score += 58;
  if (rules.has("text_bridge")) score += 52 + Number(relation.textBridgeSpecificity || 0) * 4;
  if (rules.has("competitive_cooccurrence")) score += Math.min(38, Number(relation.coDeckCount || 0) * 4);
  if (rules.has("shared_trait")) score += 18;
  if (rules.has("shared_keyword")) score += 12;
  return score;
}

function relationReasons(item) {
  const relation = item.relation;
  const rules = new Set(relation.algorithmRules || []);
  const sourceName = item.sourceCard.cardName;
  const reasons = [];
  if (rules.has("direct_link_pair")) reasons.push(`Printed LINK/PAIR with ${sourceName}`);
  if (rules.has("text_bridge")) reasons.push(`Printed-text interaction with ${sourceName}`);
  if (rules.has("mechanic_setup")) reasons.push(`Mechanical setup with ${sourceName}`);
  if (Number(relation.coDeckCount || 0) > 0) {
    reasons.push(`Appears with ${sourceName} in ${relation.coDeckCount} competitive list(s)`);
  }
  if (rules.has("shared_trait")) reasons.push(`Shares a relevant trait with ${sourceName}`);
  return reasons;
}

function edgeFromRelation(sourceCardNumber, relation) {
  const rules = new Set(relation.algorithmRules || []);
  const printed = ["direct_link_pair", "mechanic_setup", "text_bridge"].some((rule) => rules.has(rule));
  const observed = Number(relation.coDeckCount || 0) > 0;
  if (!printed && !observed && Number(relation.score || 0) < 50) return null;
  const id = [sourceCardNumber, relation.targetCardId].sort().join("__");
  return {
    id,
    source: sourceCardNumber,
    target: relation.targetCardId,
    score: relation.score,
    strength: relation.rank,
    kind: printed ? "printed" : observed ? "observed" : "inferred",
    explanation: relation.explanation,
    priority: relationPriority(relation),
  };
}

function buildCurveTelemetry(rows, maxMain) {
  return CURVE_BUCKETS.map((bucket) => {
    const count = rows
      .filter((row) => bucket.test(Number(row.card.cost || 0)))
      .reduce((sum, row) => sum + row.quantity, 0);
    const target = Math.round(maxMain * bucket.targetRatio);
    return {
      ...bucket,
      count,
      target,
      need: target - count,
    };
  });
}

function buildCompositionTelemetry(rows) {
  const counts = rows.reduce((result, row) => {
    const type = String(row.card.cardType || "").toUpperCase();
    result[type] = (result[type] || 0) + Number(row.quantity || 0);
    return result;
  }, {});

  return COMPOSITION_TYPES.map((item) => ({
    ...item,
    count: Number(counts[item.type] || 0),
  }));
}

function buildRoleTelemetry(rows) {
  return ROLE_GROUPS.map((role) => {
    const count = rows.reduce((sum, row) => {
      const tags = new Set((row.card.synergyTags || []).map(normalizeTag));
      return role.tags.some((tag) => tags.has(tag)) ? sum + row.quantity : sum;
    }, 0);
    return {
      ...role,
      count,
      need: role.target - count,
    };
  });
}

function activeColors(rows) {
  return [...new Set(rows
    .map((row) => row.card.color)
    .filter((color) => color && !["Neutral", "-"].includes(color)))];
}

function metaScore(card) {
  return Math.min(20, Math.log1p(Number(card.recentTop8DecksUsing || 0)) * 2.6);
}

function normalizeTag(value) {
  return normalizeSearchText(value).replace(/\s+/g, "_");
}

function sumQuantities(main = {}) {
  return Object.values(main).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
}

function blocked(reason, type, maxCopies, violation = null) {
  return {
    allowed: false,
    reason,
    type,
    maxCopies,
    violation,
  };
}
