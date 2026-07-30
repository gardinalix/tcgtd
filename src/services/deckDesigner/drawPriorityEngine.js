import { normalizeSearchText, round } from "./deckDesignerUtils.js";

const MATCHUP_SIGNALS = {
  fast: {
    blocker: 26,
    removal: 22,
    shield: 18,
    bounce: 16,
    recovery: 14,
    repair: 12,
  },
  control: {
    breach: 24,
    damage_push: 22,
    ap_mod: 18,
    draw: 16,
    search: 16,
    removal: 10,
  },
  attrition: {
    draw: 28,
    search: 26,
    recovery: 22,
    repair: 18,
    trash: 14,
    base_support: 12,
  },
};

export function buildDrawPriorityPlan(sourceCard, rows = [], context = {}, graph = {}) {
  const mode = drawModeForCard(sourceCard);
  if (!mode) return null;
  const turn = normalizeTurn(context.turn);
  const matchup = String(context.matchup || "Balanced / unknown");
  const sourceCardNumber = sourceCard.cardNumber;
  const allCandidates = rows
    .filter((row) => row?.card?.cardNumber)
    .filter((row) => row.card.cardNumber !== sourceCardNumber);
  const searchProfile = mode === "search"
    ? searchEligibilityProfile(sourceCard, allCandidates)
    : { candidates: allCandidates, constraints: [], exact: false };
  const degreeById = graphDegreeIndex(graph);

  const recommendations = searchProfile.candidates
    .map((row) => scoreCandidate(row, {
      turn,
      matchup,
      matchupKind: matchupKindFor(matchup),
      degree: degreeById.get(row.card.cardNumber) || 0,
    }))
    .sort((left, right) =>
      right.score - left.score
      || Number(right.row.quantity || 0) - Number(left.row.quantity || 0)
      || String(left.card.cardName).localeCompare(String(right.card.cardName)))
    .slice(0, 3)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  const drawCount = parseDrawCount(sourceCard);
  const title = mode === "search"
    ? "SEARCH · PRIORITY TARGETS"
    : `DRAW${drawCount ? ` ${drawCount}` : ""} · PRIORITY HITS`;
  const disclaimer = mode === "search"
    ? searchProfile.exact
      ? `Targets are limited by the card's printed search constraints: ${searchProfile.constraints.join(", ")}.`
      : "The printed effect searches or selects cards, but its full eligibility could not be safely inferred; priorities use the cards in this deck."
    : `${sourceCard.cardName} does not search the deck; it draws random cards. These are the strongest hits for the selected turn and matchup.`;

  return {
    mode,
    sourceCardNumber,
    title,
    disclaimer,
    turn,
    matchup,
    recommendations,
    constraints: searchProfile.constraints,
  };
}

export function drawModeForCard(card) {
  const text = cardText(card);
  const tags = new Set((card?.synergyTags || []).map(normalizeTag));
  const searches = tags.has("search")
    || /\bsearch (?:your|the) deck\b/i.test(text)
    || /\blook at (?:the )?top\b[\s\S]{0,100}\badd\b[\s\S]{0,40}\bhand\b/i.test(text);
  if (searches) return "search";
  const draws = tags.has("draw") || /\bdraw(?:s)?\s+(?:a|one|two|\d+)/i.test(text);
  return draws ? "draw" : "";
}

function searchEligibilityProfile(sourceCard, rows) {
  const text = cardText(sourceCard);
  const normalizedText = normalizeSearchText(text);
  const mentionedTypes = ["UNIT", "PILOT", "COMMAND", "BASE"]
    .filter((type) => new RegExp(`\\b${type.toLowerCase()}\\b`, "i").test(normalizedText));
  const traitTokens = [...text.matchAll(/[（(]([^()（）]{2,40})[）)]/g)]
    .map((match) => normalizeSearchText(match[1]))
    .filter(Boolean);
  const recognizedTraits = traitTokens.filter((token) => rows.some((row) =>
    (row.card.traits || []).some((trait) => normalizeSearchText(trait) === token)));
  const levelLimit = numericLimit(text, /\blv\.?\s*(\d+)\s+or lower\b/i);
  const costLimit = numericLimit(text, /\bcost\s*(\d+)\s+or lower\b/i);
  const constraints = [
    ...mentionedTypes.map((type) => type),
    ...recognizedTraits.map((trait) => `${trait} trait`),
    ...(levelLimit == null ? [] : [`Lv.${levelLimit} or lower`]),
    ...(costLimit == null ? [] : [`cost ${costLimit} or lower`]),
  ];
  const hasParsedConstraint = constraints.length > 0;
  const candidates = rows.filter((row) => {
    const { card } = row;
    if (mentionedTypes.length && !mentionedTypes.includes(String(card.cardType || "").toUpperCase())) return false;
    if (recognizedTraits.length && !(card.traits || []).some((trait) =>
      recognizedTraits.includes(normalizeSearchText(trait)))) return false;
    if (levelLimit != null && Number(card.level || 0) > levelLimit) return false;
    if (costLimit != null && Number(card.cost || 0) > costLimit) return false;
    return true;
  });
  return {
    candidates: candidates.length ? candidates : rows,
    constraints,
    exact: hasParsedConstraint && candidates.length > 0,
  };
}

function scoreCandidate(row, context) {
  const { card } = row;
  const cost = Number(card.cost || 0);
  const tags = new Set((card.synergyTags || []).map(normalizeTag));
  const reasons = [];
  let score = 0;

  const curveGap = cost - context.turn;
  if (curveGap <= 0) {
    score += 34 - Math.min(12, Math.abs(curveGap) * 3);
    reasons.push(`Playable by turn ${context.turn}`);
  } else if (curveGap === 1) {
    score += 22;
    reasons.push("Sets up the next turn");
  } else {
    score -= Math.min(24, curveGap * 7);
  }

  if (context.turn <= 2 && cost <= 2) score += 16;
  if (context.turn >= 5 && cost >= 4) {
    score += 12;
    reasons.push("Late-game payoff");
  }

  const matchupWeights = MATCHUP_SIGNALS[context.matchupKind] || {};
  const matchupHits = [...tags]
    .filter((tag) => matchupWeights[tag])
    .sort((left, right) => matchupWeights[right] - matchupWeights[left]);
  for (const tag of matchupHits) score += matchupWeights[tag];
  if (matchupHits.length) reasons.push(matchupReason(context.matchupKind, matchupHits[0]));

  const categoryBonus = { essential: 16, flexible: 8, accessible: 5, experimental: 0 }[row.category] || 0;
  score += categoryBonus;
  if (categoryBonus >= 16) reasons.push("Core deck piece");

  score += Math.min(10, Number(row.quantity || 0) * 2);
  score += Math.min(12, context.degree * 2);
  score += Math.min(10, Math.log1p(Number(card.recentTop8DecksUsing || 0)) * 1.8);

  if (!reasons.length) reasons.push(`${row.quantity || 1} copies in the deck`);

  return {
    card,
    row,
    score: round(score, 1),
    reasons: [...new Set(reasons)].slice(0, 3),
  };
}

function graphDegreeIndex(graph = {}) {
  const degree = new Map((graph.nodes || []).map((node) => [node.id, Number(node.degree || 0)]));
  for (const edge of graph.edges || []) {
    if (!degree.has(edge.source)) degree.set(edge.source, 1);
    if (!degree.has(edge.target)) degree.set(edge.target, 1);
  }
  return degree;
}

function matchupKindFor(matchup) {
  const value = normalizeSearchText(matchup);
  if (/fast|pressure|aggro/.test(value)) return "fast";
  if (/control|late game|late-game|slow/.test(value)) return "control";
  if (/attrition|resource/.test(value)) return "attrition";
  return "balanced";
}

function matchupReason(kind, tag) {
  const labels = {
    fast: `Defensive answer: ${displayTag(tag)}`,
    control: `Pressure against control: ${displayTag(tag)}`,
    attrition: `Attrition value: ${displayTag(tag)}`,
  };
  return labels[kind] || displayTag(tag);
}

function parseDrawCount(card) {
  const text = cardText(card);
  const match = text.match(/\bdraw\s+(\d+|one|two|three)\b/i);
  if (!match) return 0;
  return { one: 1, two: 2, three: 3 }[match[1].toLowerCase()] || Number(match[1]) || 0;
}

function numericLimit(text, pattern) {
  const match = text.match(pattern);
  return match ? Number(match[1]) : null;
}

function normalizeTurn(value) {
  const turn = Number(value || 3);
  return Math.max(1, Math.min(5, Math.round(turn)));
}

function normalizeTag(value) {
  return normalizeSearchText(value).replace(/\s+/g, "_");
}

function displayTag(value) {
  return String(value || "").replace(/_/g, " ");
}

function cardText(card) {
  return [card?.effectPreview, card?.effectText, card?.cardText, card?.text]
    .filter(Boolean)
    .join(" ");
}
