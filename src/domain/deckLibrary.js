import { normalizeDeck, sectionCount } from "./deck.js";

export function createSavedDeck(ownerId, patch = {}) {
  const now = new Date().toISOString();
  const deck = normalizeDeck(patch);
  return {
    id: patch.id || `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ownerId,
    name: deck.name || patch.name || "Untitled deck",
    visibility: patch.visibility === "public" ? "public" : "private",
    archetype: patch.archetype || "",
    colors: Array.isArray(patch.colors) ? patch.colors : [],
    format: patch.format || "Current",
    event: patch.event || "",
    result: patch.result || "",
    notes: patch.notes || "",
    sourceName: patch.sourceName || "",
    sourceUrl: patch.sourceUrl || "",
    externalId: patch.externalId || "",
    selectedMetaId: patch.selectedMetaId || "current",
    sourceTournamentDeckId: patch.sourceTournamentDeckId || "",
    sourceMetadata: patch.sourceMetadata && typeof patch.sourceMetadata === "object" ? { ...patch.sourceMetadata } : null,
    parentDeckId: patch.parentDeckId || "",
    assistantConversationId: patch.assistantConversationId || "",
    lastCompetitiveScore: Number.isFinite(Number(patch.lastCompetitiveScore)) ? Number(patch.lastCompetitiveScore) : null,
    changeHistory: Array.isArray(patch.changeHistory) ? patch.changeHistory.slice(-100) : [],
    banlistVersion: patch.banlistVersion || "",
    designerReport: patch.designerReport && typeof patch.designerReport === "object" ? patch.designerReport : null,
    createdAt: patch.createdAt || now,
    updatedAt: now,
    main: deck.main,
    resource: deck.resource,
  };
}

export function updateSavedDeck(state, deckId, updater) {
  const decks = (state.decks || []).map((deck) => {
    if (deck.id !== deckId) return deck;
    const patch = typeof updater === "function" ? updater(deck) : updater;
    const normalized = normalizeDeck({ ...deck, ...patch });
    return {
      ...deck,
      ...patch,
      main: normalized.main,
      resource: normalized.resource,
      updatedAt: new Date().toISOString(),
    };
  });
  return { ...state, decks };
}

export function duplicateDeck(state, deckId, ownerId) {
  const source = (state.decks || []).find((deck) => deck.id === deckId);
  if (!source) return state;
  const copy = createSavedDeck(ownerId, {
    ...source,
    id: undefined,
    name: `${source.name} Copy`,
    visibility: "private",
  });
  return { ...state, decks: [copy, ...(state.decks || [])], activeDeckId: copy.id };
}

export function deleteDeck(state, deckId) {
  const decks = (state.decks || []).filter((deck) => deck.id !== deckId);
  return {
    ...state,
    decks,
    activeDeckId: state.activeDeckId === deckId ? decks[0]?.id || "" : state.activeDeckId,
  };
}

export function deckStats(deck, libraryMap = new Map()) {
  const rows = Object.entries(deck.main || {}).map(([cardNumber, quantity]) => ({
    card: libraryMap.get(cardNumber),
    quantity: Number(quantity || 0),
  }));
  const colors = countBy(rows, (row) => row.card?.color || "Unknown");
  const types = countBy(rows, (row) => row.card?.cardType || "Unknown");
  const rarities = countBy(rows, (row) => row.card?.rarity || "Unknown");
  const curve = countBy(rows, (row) => row.card?.cost || "-");
  return {
    mainCount: sectionCount(deck.main),
    resourceCount: sectionCount(deck.resource),
    colors,
    types,
    rarities,
    curve,
  };
}

export function parseDeckList(text = "") {
  const parsed = parseMsaDeckList(text);
  return { main: parsed.main, resource: parsed.resource };
}

export function parseMsaDeckList(text = "") {
  const main = {};
  const resource = {};
  const lines = String(text).split(/\r?\n/);
  const entries = [];
  const ignoredLines = [];
  let section = "main";
  let title = "";
  let hasSeenSection = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isDeckSectionHeading(trimmed, "resource")) {
      section = "resource";
      hasSeenSection = true;
      continue;
    }
    if (isDeckSectionHeading(trimmed, "main")) {
      section = "main";
      hasSeenSection = true;
      continue;
    }
    const match = matchDeckListEntry(trimmed);
    if (!match) {
      if (!title && !hasSeenSection && !normalizeImportedCardNumber(trimmed)) {
        title = trimmed;
      } else {
        ignoredLines.push({ lineNumber: index + 1, text: trimmed });
      }
      continue;
    }
    const quantity = Number(match[1] || 0);
    const cardNumber = normalizeImportedCardNumber(match[2]);
    if (!quantity || !cardNumber) {
      ignoredLines.push({ lineNumber: index + 1, text: trimmed });
      continue;
    }
    const resolvedSection = section === "resource" || /^R-\d{3}$/i.test(cardNumber)
      ? "resource"
      : "main";
    const target = resolvedSection === "resource" ? resource : main;
    target[cardNumber] = (target[cardNumber] || 0) + quantity;
    entries.push({
      lineNumber: index + 1,
      text: trimmed,
      section: resolvedSection,
      quantity,
      cardNumber,
    });
  }
  return {
    title: title || "My MSA deck",
    main,
    resource,
    entries,
    ignoredLines,
    mainCount: sumQuantities(main),
    resourceCount: sumQuantities(resource),
    uniqueMainCards: Object.keys(main).length,
    uniqueResourceCards: Object.keys(resource).length,
  };
}

export function normalizeImportedCardNumber(value = "") {
  const raw = String(value || "").trim().toUpperCase();
  const match = raw.match(/\b([A-Z]{1,6}\d{0,2}-\d{3})(?:[-_](?:ALT|P)\d+|_P\d+)?\b/i);
  return match ? match[1].toUpperCase() : "";
}

export function normalizeImportedColors(value = "") {
  if (Array.isArray(value)) return value.map((color) => String(color).trim()).filter(Boolean);
  return String(value || "")
    .split(/[,/;|]+/)
    .map((color) => color.trim())
    .filter(Boolean);
}

export function publicDecksFromMeta(data, { limit = Infinity } = {}) {
  const results = Array.isArray(data.metaResults) ? data.metaResults : [];
  return results
    .filter((result) => result.hasDecklist !== false && result.deckId)
    .slice(0, limit)
    .map(deckSummaryFromMetaResult);
}

export function deckSummaryFromMetaResult(result = {}) {
  return {
    id: result.deckId,
    name: result.archetype || result.eventName || "Competitive deck",
    author: result.playerName || "Unknown player",
    visibility: "public",
    format: normalizeFormatLabel(result.formatName, result.eventType, result.sourcePageTitle),
    colors: String(result.colorCombination || "").split("/").filter(Boolean),
    colorCombination: result.colorCombination || "",
    archetype: result.archetype || "",
    result: result.placingLabel || "",
    event: result.eventName || "",
    eventDate: result.eventDate || "",
    playerCount: result.playerCount || "",
    sourceName: result.sourceName || "",
    sourceUrl: result.sourceUrl || "",
    deckUrl: result.deckUrl || "",
  };
}

export function parseDeckUrlList(deckUrl = "") {
  const main = {};
  if (!deckUrl) return main;
  try {
    const url = new URL(deckUrl);
    const rawDeck = url.searchParams.get("deck") || "";
    for (const entry of rawDeck.split(",")) {
      const [rawCardNumber, rawQuantity] = entry.split(":");
      const cardNumber = String(rawCardNumber || "").trim().toUpperCase();
      const quantity = Number(rawQuantity || 0);
      if (!cardNumber || !quantity) continue;
      main[cardNumber] = (main[cardNumber] || 0) + quantity;
    }
  } catch {
    const match = String(deckUrl).match(/[?&]deck=([^&]+)/i);
    const rawDeck = match ? decodeURIComponent(match[1]) : "";
    for (const entry of rawDeck.split(",")) {
      const [rawCardNumber, rawQuantity] = entry.split(":");
      const cardNumber = String(rawCardNumber || "").trim().toUpperCase();
      const quantity = Number(rawQuantity || 0);
      if (!cardNumber || !quantity) continue;
      main[cardNumber] = (main[cardNumber] || 0) + quantity;
    }
  }
  return main;
}

function normalizeFormatLabel(...values) {
  for (const value of values) {
    const match = String(value || "").match(/\b(?:GD|ST|EX|PR)\d{2}\b/i);
    if (match) return match[0].toUpperCase();
  }
  return values.find(Boolean) || "Unknown";
}

function countBy(rows, selector) {
  return rows.reduce((acc, row) => {
    const key = selector(row);
    acc[key] = (acc[key] || 0) + row.quantity;
    return acc;
  }, {});
}

function isDeckSectionHeading(value, section) {
  const normalized = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return section === "resource"
    ? /^(?:resource deck|resources?|deck de recursos?)(?:\s*\(\d+\))?\s*:?\s*$/.test(normalized)
    : /^(?:main deck|main|deck principal)(?:\s*\(\d+\))?\s*:?\s*$/.test(normalized);
}

function matchDeckListEntry(value) {
  const quantityFirst = String(value || "").match(/^(\d+)\s*(?:x|×)?\s*(.+)$/i);
  if (quantityFirst) return quantityFirst;
  const quantityLast = String(value || "").match(/^(.+?)\s*(?:x|×)\s*(\d+)$/i);
  return quantityLast ? [quantityLast[0], quantityLast[2], quantityLast[1]] : null;
}

function sumQuantities(section = {}) {
  return Object.values(section).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
}
