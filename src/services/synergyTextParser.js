const SUPPORT_PATTERNS = [
  { type: "Protection", pattern: /\b(blocker|shield|protect|can't receive|cannot receive|recover|repair)\b/i },
  { type: "Draw", pattern: /\b(draw|add .* hand|search|look at|reveal)\b/i },
  { type: "Removal", pattern: /\b(destroy|rest|damage|ap-\d|return .* hand|trash)\b/i },
  { type: "Recursion", pattern: /\b(trash|return .* from|recover|repair|retrieve)\b/i },
  { type: "Setup", pattern: /\b(deploy|activate|search|resource|set .* active)\b/i },
  { type: "Extension", pattern: /\b(once per turn|during your turn|when paired|during pair|during link)\b/i },
  { type: "Finisher", pattern: /\b(breach|first strike|damage to the first card|ap\+\d)\b/i },
  { type: "Meta call", pattern: /\b(blocker|destroyed|enemy unit|enemy units)\b/i },
];

const KEYWORD_PATTERNS = [
  "Blocker",
  "Breach",
  "Repair",
  "First Strike",
  "Shield",
  "Burst",
  "Deploy",
  "Attack",
  "Destroyed",
  "During Link",
  "During Pair",
  "When Linked",
  "When Paired",
  "Activate Main",
  "Activate Action",
  "High-Maneuver",
  "Suppression",
  "Pair",
  "Link",
  "Token",
  "Trash",
  "Resource",
  "Recover",
];

const GENERIC_LINK_TERMS = new Set(["link", "pair", "pilot", "unit", "command", "base"]);
const GENERIC_TEXT_TERMS = new Set([
  "activate action",
  "activate main",
  "attack",
  "base",
  "burst",
  "command",
  "deploy",
  "destroyed",
  "during link",
  "during pair",
  "link",
  "pair",
  "pilot",
  "resource",
  "shield",
  "trash",
  "unit",
  "when linked",
  "when paired",
]);
const TARGET_CARD_TYPES = ["unit", "pilot", "command", "base"];
const GENERIC_TARGET_KEYWORDS = new Set([
  ...GENERIC_TEXT_TERMS,
  "blocker",
  "draw",
  "removal",
  "setup",
]);

export function parseCardSignals(card) {
  const text = normalizeText([card?.effectPreview, card?.effectText, card?.cardText, card?.text].filter(Boolean).join(" "));
  const traits = uniqueNormalized(card?.traits || []);
  const tags = uniqueNormalized(card?.synergyTags || []);
  const linkTargets = uniqueNormalized(card?.linkTargets || []);
  const keywords = uniqueNormalized([
    ...KEYWORD_PATTERNS.filter((keyword) => normalizeText(text).includes(normalizeText(keyword))),
    ...tags,
  ]);
  const supportTypes = SUPPORT_PATTERNS
    .filter((item) => item.pattern.test(text))
    .map((item) => item.type);

  return {
    name: normalizeText(card?.cardName),
    number: normalizeText(card?.cardNumber),
    color: normalizeText(card?.color),
    type: normalizeText(card?.cardType),
    cost: toNumber(card?.cost),
    level: toNumber(card?.level),
    text,
    traits,
    tags,
    linkTargets,
    keywords,
    supportTypes: uniqueNormalized(supportTypes),
    searchableText: normalizeText([
      card?.cardName,
      card?.cardNumber,
      card?.color,
      card?.cardType,
      card?.effectPreview,
      ...(card?.traits || []),
      ...(card?.synergyTags || []),
      ...(card?.linkTargets || []),
    ].join(" ")),
  };
}

export function importantTermsFor(card, signals = parseCardSignals(card)) {
  return uniqueNormalized([
    signals.name,
    signals.number,
    signals.color,
    signals.type,
    ...signals.traits,
    ...signals.keywords,
    ...signals.linkTargets,
  ]).filter((term) => term.length >= 3 && !GENERIC_TEXT_TERMS.has(term));
}

export function matchCardTextTarget(
  sourceCard,
  targetCard,
  sourceSignals = parseCardSignals(sourceCard),
  targetSignals = parseCardSignals(targetCard),
  options = {},
) {
  const text = normalizeText(sourceSignals.text);
  if (!text) return emptyTextTargetMatch();

  const explicitName = targetSignals.name
    && isMostSpecificNameMention(text, targetSignals.name, options.knownCardNames || []);
  const explicitNumber = targetSignals.number && containsTerm(text, targetSignals.number);
  const matchedTraits = targetSignals.traits.filter((trait) => containsTerm(text, trait));
  const matchedKeywords = targetSignals.keywords
    .filter((keyword) => !GENERIC_TARGET_KEYWORDS.has(keyword))
    .filter((keyword) => containsTerm(text, keyword));
  const mentionedTypes = TARGET_CARD_TYPES.filter((type) => containsTerm(text, type));
  const targetType = normalizeText(targetSignals.type);
  const friendlyTypeSupport = mentionedTypes.includes(targetType)
    && friendlyTypeIsTargeted(
      text,
      targetType,
      targetSignals.traits,
      options.knownTraits || [],
    );
  const colorTypeSupport = Boolean(
    targetSignals.color
    && targetType
    && containsTerm(text, `${targetSignals.color} ${targetType}`),
  );

  if (!explicitName && !explicitNumber && mentionedTypes.length && !mentionedTypes.includes(targetType)) {
    return {
      ...emptyTextTargetMatch(),
      blockedBy: `Printed text targets ${mentionedTypes.join("/")} cards, not ${targetType || "this type"}.`,
    };
  }

  const bounds = extractNumericBounds(text);
  if (!explicitName && !explicitNumber && mentionedTypes.includes(targetType)) {
    if (bounds.minimumLevel != null && Number(targetSignals.level || 0) < bounds.minimumLevel) {
      return {
        ...emptyTextTargetMatch(),
        blockedBy: `Requires Lv.${bounds.minimumLevel} or higher.`,
      };
    }
    if (bounds.maximumLevel != null && Number(targetSignals.level || 0) > bounds.maximumLevel) {
      return {
        ...emptyTextTargetMatch(),
        blockedBy: `Requires Lv.${bounds.maximumLevel} or lower.`,
      };
    }
    if (bounds.minimumCost != null && Number(targetSignals.cost || 0) < bounds.minimumCost) {
      return {
        ...emptyTextTargetMatch(),
        blockedBy: `Requires cost ${bounds.minimumCost} or higher.`,
      };
    }
    if (bounds.maximumCost != null && Number(targetSignals.cost || 0) > bounds.maximumCost) {
      return {
        ...emptyTextTargetMatch(),
        blockedBy: `Requires cost ${bounds.maximumCost} or lower.`,
      };
    }
  }

  const matched = Boolean(
    explicitName
    || explicitNumber
    || matchedTraits.length
    || matchedKeywords.length
    || colorTypeSupport
    || friendlyTypeSupport
  );
  if (!matched) return emptyTextTargetMatch();

  let specificity = 1;
  if (explicitName || explicitNumber) specificity = 5;
  else if (matchedTraits.length && mentionedTypes.includes(targetType) && hasNumericBounds(bounds)) specificity = 5;
  else if (matchedTraits.length && mentionedTypes.includes(targetType)) specificity = 4;
  else if (matchedKeywords.length && mentionedTypes.includes(targetType)) specificity = 4;
  else if (matchedTraits.length || colorTypeSupport) specificity = 3;
  else if (matchedKeywords.length) specificity = 2;

  const requirements = [
    ...(explicitName ? [`named ${targetCard.cardName}`] : []),
    ...matchedTraits.map(displayTerm),
    ...(mentionedTypes.includes(targetType) ? [String(targetCard.cardType || targetType).toUpperCase()] : []),
    ...matchedKeywords.map(displayTerm),
    ...boundLabels(bounds),
  ];

  return {
    matched: true,
    specificity,
    explicitName: Boolean(explicitName || explicitNumber),
    matchedTraits,
    matchedKeywords,
    mentionedTypes,
    bounds,
    requirements: [...new Set(requirements)],
    label: [...new Set(requirements)].join(" · ") || `${String(targetCard.cardType || "card").toUpperCase()} support`,
    blockedBy: "",
  };
}

export function canDamageFriendlyUnit(signals) {
  const text = normalizeText(signals?.text);
  return (
    /\bchoose 1 of your units?\b/.test(text)
    && /\bdeal \d+ damage to them\b/.test(text)
  ) || /\byour units?\b.{0,80}\bdeal \d+ damage\b/.test(text);
}

export function hasDestroyedTrigger(signals) {
  return /\bdestroyed\b/.test(normalizeText(signals?.text));
}

export function hasConditionalPairOrLinkWindow(signals) {
  return /\bduring (link|pair)\b/.test(normalizeText(signals?.text))
    || /\bwhen (linked|paired)\b/.test(normalizeText(signals?.text));
}

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[【】()[\]{}.,:;!?'"`<>]/g, " ")
    .replace(/\btrait\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function overlap(left = [], right = []) {
  const rightSet = new Set(right.map(normalizeText));
  return uniqueNormalized(left).filter((value) => rightSet.has(value));
}

export function mentionsAny(text, terms = []) {
  const normalized = normalizeText(text);
  return terms.filter((term) => {
    const value = normalizeText(term);
    return value.length >= 3 && containsTerm(normalized, value);
  });
}

export function linkMatchesCard(linkTarget, card, signals = parseCardSignals(card)) {
  const alternatives = String(linkTarget || "")
    .split("/")
    .map(normalizeText)
    .filter(Boolean);
  if (!alternatives.length) return false;
  if (signals.name && alternatives.some((link) =>
    link.length >= 3
    && (
      signals.name === link
      || containsTerm(signals.name, link)
      || containsTerm(link, signals.name)
    ))) {
    return true;
  }
  const traits = new Set(signals.traits
    .filter((term) => term && !GENERIC_LINK_TERMS.has(term)));
  return alternatives.some((link) =>
    !GENERIC_LINK_TERMS.has(link)
    && traits.has(link.replace(/\btrait\b/g, "").trim()));
}

function uniqueNormalized(values = []) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function containsTerm(text, term) {
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term);
  if (!normalizedText || !normalizedTerm) return false;
  const pattern = normalizedTerm
    .split(/\s+/)
    .map(escapeRegExp)
    .join("\\s+");
  return new RegExp(`(?:^|\\s)${pattern}(?=$|\\s)`, "i").test(normalizedText);
}

function isMostSpecificNameMention(text, targetName, knownCardNames) {
  const normalizedTarget = normalizeText(targetName);
  if (!normalizedTarget || !containsTerm(text, normalizedTarget)) return false;
  return !knownCardNames
    .map(normalizeText)
    .filter((name) => name && name !== normalizedTarget)
    .some((name) =>
      name.length > normalizedTarget.length
      && containsTerm(name, normalizedTarget)
      && containsTerm(text, name));
}

function friendlyTypeIsTargeted(text, type, targetTraits = [], knownTraits = []) {
  const phrases = friendlyTypeTargetPhrases(text, type);
  if (!phrases.length) return false;
  const targetTraitSet = new Set(uniqueNormalized(targetTraits));
  const possibleConstraints = uniqueNormalized(knownTraits)
    .filter((trait) => trait && !GENERIC_LINK_TERMS.has(trait));

  return phrases.some((phrase) => {
    const constraints = possibleConstraints
      .filter((trait) => containsTerm(phrase, trait));
    return !constraints.length
      || constraints.some((trait) => targetTraitSet.has(trait));
  });
}

function friendlyTypeTargetPhrases(text, type) {
  const normalized = normalizeText(text);
  const plural = type === "base" ? "bases?" : `${escapeRegExp(type)}s?`;
  const patterns = [
    new RegExp(`\\b(?:friendly|another|all friendly|each friendly|all your|each of your)\\b.{0,70}\\b${plural}\\b`, "gi"),
    new RegExp(`\\byour\\s+(?:(?!\\b(?:hand|turn|trash|shield|deck)\\b).){0,60}\\b${plural}\\b`, "gi"),
    new RegExp(`\\b${plural}\\b.{0,50}\\b(?:you control|in your deck|in your hand|in play)\\b`, "gi"),
  ];
  return uniqueNormalized(patterns.flatMap((pattern) =>
    [...normalized.matchAll(pattern)].map((match) => match[0])));
}

function extractNumericBounds(text) {
  return {
    minimumLevel: numericMatch(text, /\blv\s*(\d+)\s*or higher\b/i),
    maximumLevel: numericMatch(text, /\blv\s*(\d+)\s*or lower\b/i),
    minimumCost: numericMatch(text, /\bcost\s*(\d+)\s*or higher\b/i),
    maximumCost: numericMatch(text, /\bcost\s*(\d+)\s*or lower\b/i),
  };
}

function numericMatch(text, pattern) {
  const match = String(text || "").match(pattern);
  return match ? Number(match[1]) : null;
}

function hasNumericBounds(bounds) {
  return Object.values(bounds).some((value) => value != null);
}

function boundLabels(bounds) {
  return [
    ...(bounds.minimumLevel == null ? [] : [`Lv.${bounds.minimumLevel}+`]),
    ...(bounds.maximumLevel == null ? [] : [`Lv.${bounds.maximumLevel}-`]),
    ...(bounds.minimumCost == null ? [] : [`COST ${bounds.minimumCost}+`]),
    ...(bounds.maximumCost == null ? [] : [`COST ${bounds.maximumCost}-`]),
  ];
}

function displayTerm(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function emptyTextTargetMatch() {
  return {
    matched: false,
    specificity: 0,
    explicitName: false,
    matchedTraits: [],
    matchedKeywords: [],
    mentionedTypes: [],
    bounds: extractNumericBounds(""),
    requirements: [],
    label: "",
    blockedBy: "",
  };
}

function toNumber(value) {
  const match = String(value || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}
