import { evaluateMainDeckLegality } from "./deckLegality.js";

export const DEFAULT_DECK = {
  name: "ZERO System Deck",
  main: {},
  resource: {},
};

export function normalizeDeck(deck = {}) {
  return {
    ...deck,
    name: deck.name || DEFAULT_DECK.name,
    main: compactSection(deck.main),
    resource: compactSection(deck.resource),
  };
}

export function compactSection(section = {}) {
  return Object.fromEntries(
    Object.entries(section)
      .map(([cardNumber, quantity]) => [cardNumber, Math.max(0, Number(quantity || 0))])
      .filter(([, quantity]) => quantity > 0),
  );
}

export function changeDeckQuantity(deck, section, cardNumber, delta, max = 4) {
  const current = Number(deck[section]?.[cardNumber] || 0);
  const next = Math.max(0, Math.min(max, current + delta));
  const nextSection = { ...(deck[section] || {}) };
  if (next) {
    nextSection[cardNumber] = next;
  } else {
    delete nextSection[cardNumber];
  }
  return normalizeDeck({ ...deck, [section]: nextSection });
}

export function sectionCount(section = {}) {
  return Object.values(section).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
}

export function buildDeckRows(deck, section, libraryMap) {
  return Object.entries(deck[section] || {})
    .map(([cardNumber, quantity]) => ({ card: libraryMap.get(cardNumber), quantity: Number(quantity || 0) }))
    .filter((row) => row.card)
    .sort((left, right) => String(left.card.cardNumber).localeCompare(String(right.card.cardNumber)));
}

export function buildPlainDeckList(deck, libraryMap, section = "main") {
  return buildDeckRows(deck, section, libraryMap)
    .map((row) => `${row.quantity}x${row.card.cardNumber}`)
    .join("\n");
}

export function getDeckIssues(deck, rules = {}, mainMap = new Map()) {
  const issues = [];
  const mainSize = Number(rules.mainDeckSize || 50);
  const resourceSize = Number(rules.resourceDeckSize || 10);
  const mainCount = sectionCount(deck.main);
  const resourceCount = sectionCount(deck.resource);
  if (mainCount !== mainSize) issues.push(`Main deck must have ${mainSize} cards. Current: ${mainCount}.`);
  if (resourceCount !== resourceSize) issues.push(`Resource deck must have ${resourceSize} cards. Current: ${resourceCount}.`);

  const colors = new Set();
  for (const cardNumber of Object.keys(deck.main || {})) {
    const card = mainMap.get(cardNumber);
    if (card?.color && card.color !== "Neutral") colors.add(card.color);
  }
  if (colors.size > Number(rules.maxColors || 2)) {
    issues.push(`Main deck uses ${colors.size} colors. Current limit: ${rules.maxColors || 2}.`);
  }
  issues.push(...evaluateMainDeckLegality(deck.main, mainMap, rules).issues);
  return issues;
}
