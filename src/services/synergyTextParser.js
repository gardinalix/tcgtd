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
    .replace(/[【】()[\]{}.,:;!?'"`]/g, " ")
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
    return value.length >= 3 && normalized.includes(value);
  });
}

export function linkMatchesCard(linkTarget, card, signals = parseCardSignals(card)) {
  const link = normalizeText(linkTarget);
  if (!link) return false;
  if (signals.name && (signals.name === link || signals.name.includes(link) || link.includes(signals.name))) {
    return true;
  }
  return [...signals.traits, ...signals.keywords]
    .filter((term) => term && !GENERIC_LINK_TERMS.has(term))
    .some((term) => link.includes(term) || term.includes(link));
}

function uniqueNormalized(values = []) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function toNumber(value) {
  const match = String(value || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}
