import { getCardCopyLimit } from "../../domain/deckLegality.js";

export const DESIGNER_COLORS = ["Blue", "Green", "Red", "White", "Purple"];

const COLOR_ALIASES = {
  b: "Blue",
  blue: "Blue",
  g: "Green",
  green: "Green",
  r: "Red",
  red: "Red",
  w: "White",
  white: "White",
  p: "Purple",
  purple: "Purple",
};

export function normalizeSearchText(value = "") {
  return String(value || "")
    .replaceAll("∀", " Turn A ")
    .replace(/[Ξξ]/gu, " Xi ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

export function tokenize(value = "") {
  return normalizeSearchText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !["deck", "the", "and"].includes(token));
}

export function normalizeColors(value = []) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[/,;|\s]+/);
  return [...new Set(values
    .map((color) => COLOR_ALIASES[normalizeSearchText(color)] || titleCase(color))
    .filter((color) => DESIGNER_COLORS.includes(color)))];
}

export function parseCardTerms(value = "") {
  return [...new Set(String(value || "")
    .split(/[\n,;]+/)
    .map((term) => normalizeSearchText(term))
    .filter(Boolean))];
}

export function findCardsByTerms(cards = [], value = "") {
  const terms = parseCardTerms(value);
  if (!terms.length) return { cards: [], unresolved: [] };
  const resolved = [];
  const unresolved = [];
  for (const term of terms) {
    const exact = cards.find((card) =>
      normalizeSearchText(card.cardNumber) === term
      || normalizeSearchText(card.cardName) === term);
    const partial = exact || cards.find((card) =>
      normalizeSearchText(card.cardName).includes(term)
      || normalizeSearchText(card.cardNumber).includes(term));
    if (partial) {
      if (!resolved.some((card) => card.cardNumber === partial.cardNumber)) resolved.push(partial);
    } else {
      unresolved.push(term);
    }
  }
  return { cards: resolved, unresolved };
}

export function cardPriceBrl(card = {}) {
  const candidates = [
    card.marketZeonLowPriceBrl,
    card.ligaGundamLowPriceBrl,
    card.marketPriceBrlFx,
  ]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0);
  return candidates.length ? Math.min(...candidates) : 0;
}

export function maxCopiesForCard(card = {}, rules = {}) {
  return getCardCopyLimit(card, rules);
}

export function placingWeight(rank) {
  const value = Number(rank || 99);
  if (value === 1) return 1;
  if (value <= 2) return 0.92;
  if (value <= 4) return 0.82;
  if (value <= 8) return 0.68;
  if (value <= 16) return 0.5;
  return 0.35;
}

export function recencyWeight(dateValue, latestDateValue) {
  const date = Date.parse(dateValue || "");
  const latest = Date.parse(latestDateValue || "");
  if (!Number.isFinite(date) || !Number.isFinite(latest)) return 0.65;
  const days = Math.max(0, (latest - date) / 86_400_000);
  return Math.max(0.35, Math.exp(-days / 220));
}

export function tokenOverlap(leftValue, rightValue) {
  const left = new Set(tokenize(leftValue));
  const right = new Set(tokenize(rightValue));
  if (!left.size || !right.size) return 0;
  let matches = 0;
  for (const token of left) if (right.has(token)) matches += 1;
  return matches / Math.max(1, Math.min(left.size, right.size));
}

export function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

export function uniqueBy(items = [], selector = (item) => item) {
  const seen = new Set();
  return items.filter((item) => {
    const key = selector(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function titleCase(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function confidenceLabel(value) {
  if (value >= 0.76) return "High";
  if (value >= 0.46) return "Medium";
  return "Low";
}
