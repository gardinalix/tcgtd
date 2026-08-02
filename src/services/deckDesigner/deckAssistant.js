import { createDeckDiff } from "./deckChangeHistory.js";

export const DECK_ASSISTANT_CONTEXT_VERSION = "forge-assistant-context-2026-08-01-v1";

export function buildDeckAssistantContext({
  data = {},
  deckId = "",
  deckName = "",
  selectedMetaId = "current",
  workspace = {},
  main = {},
  sourceMetadata = null,
  originalMain = {},
  recentChanges = [],
  relevantMetaDecks = [],
} = {}) {
  const cardMap = new Map((data.cards || []).map((card) => [card.cardNumber, card]));
  const cards = Object.entries(main).map(([cardId, quantity]) => {
    const card = cardMap.get(cardId) || {};
    return {
      cardId,
      name: card.cardName || cardId,
      quantity: Number(quantity || 0),
      type: card.cardType || "UNKNOWN",
      color: card.color || "",
      cost: finiteNumber(card.cost),
      traits: Array.isArray(card.traits) ? card.traits.slice(0, 12) : [],
      tags: Array.isArray(card.synergyTags) ? card.synergyTags.slice(0, 12) : [],
      effectText: String(card.effectPreview || card.cardText || "").slice(0, 800),
    };
  });
  return {
    version: DECK_ASSISTANT_CONTEXT_VERSION,
    deckId: deckId || undefined,
    deckName: deckName || "Deck sem nome",
    selectedMetaId,
    format: sourceMetadata?.originalMetaId || "current",
    colors: workspace.colors || [],
    cards,
    statistics: {
      mainCount: Number(workspace.mainCount || 0),
      maxMain: Number(workspace.maxMain || data.rules?.mainDeckSize || 50),
      averageCost: Number(workspace.stats?.averageCost || 0),
      curve: workspace.curve || [],
      composition: workspace.composition || [],
      roles: workspace.roles || [],
    },
    validation: {
      legal: Boolean(workspace.legal),
      structurallyLegal: Boolean(workspace.structurallyLegal),
      issues: (workspace.issues || []).slice(0, 30),
      violations: (workspace.violations || []).slice(0, 20),
      banlistVersion: data.rules?.legalityEffectiveDate || "",
    },
    sourceTournament: sourceMetadata || undefined,
    sourceDiff: sourceMetadata ? createDeckDiff(originalMain, main) : undefined,
    recentChanges: recentChanges.slice(-20).map((entry) => ({
      label: entry.label,
      origin: entry.origin,
      createdAt: entry.createdAt,
      diff: entry.diff,
    })),
    relevantMetaDecks: relevantMetaDecks.slice(0, 8).map((deck) => ({
      deckId: deck.result?.deckId,
      archetype: deck.result?.archetype,
      playerName: deck.result?.playerName,
      eventName: deck.result?.eventName,
      eventDate: deck.result?.eventDate,
      competitiveScore: deck.competitiveScore,
    })),
  };
}

export async function sendDeckAssistantMessage(input, options = {}) {
  const endpoint = options.endpoint || "/api/deck-assistant";
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const failure = new Error(error.message || "O núcleo estratégico não respondeu.");
    failure.status = response.status;
    throw failure;
  }
  return normalizeDeckAssistantResponse(await response.json());
}

export async function getDeckAssistantStatus(options = {}) {
  const endpoint = options.endpoint || "/api/deck-assistant";
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(endpoint, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Não foi possível verificar a conexão do núcleo estratégico.");
  const payload = await response.json();
  return {
    configured: Boolean(payload?.configured),
    provider: String(payload?.provider || "none"),
    model: String(payload?.model || ""),
  };
}

export function normalizeDeckAssistantResponse(value = {}) {
  const payload = value && typeof value === "object" ? value : {};
  const suggestion = payload.suggestion && typeof payload.suggestion === "object"
    ? {
      remove: normalizeOperations(payload.suggestion.remove),
      add: normalizeOperations(payload.suggestion.add),
      expectedImpact: String(payload.suggestion.expectedImpact || ""),
      confidence: ["low", "medium", "high"].includes(payload.suggestion.confidence)
        ? payload.suggestion.confidence
        : "low",
    }
    : null;
  return {
    id: String(payload.id || `assistant-${Date.now().toString(36)}`),
    message: String(payload.message || "Não há dados suficientes para uma conclusão segura."),
    evidenceType: ["objective", "inference", "preference", "meta", "insufficient_data"].includes(payload.evidenceType)
      ? payload.evidenceType
      : "insufficient_data",
    caveats: Array.isArray(payload.caveats) ? payload.caveats.map(String).slice(0, 8) : [],
    suggestion: suggestion && (suggestion.remove.length || suggestion.add.length) ? suggestion : null,
    provider: String(payload.provider || "forge-local"),
    model: String(payload.model || ""),
  };
}

export function buildLocalAssistantResponse(context = {}, message = "") {
  const normalizedMessage = String(message || "").toLowerCase();
  const roles = context.statistics?.roles || [];
  const curve = context.statistics?.curve || [];
  const roleNeed = [...roles].sort((left, right) => Number(right.need || 0) - Number(left.need || 0))[0];
  const curveNeed = [...curve].sort((left, right) => Number(right.need || 0) - Number(left.need || 0))[0];
  const issues = context.validation?.issues || [];
  const focus = /brick|tijolo/.test(normalizedMessage)
    ? "bricks"
    : /curva|curve/.test(normalizedMessage)
      ? "curve"
      : /meta|competitiv/.test(normalizedMessage)
        ? "meta"
        : "consistency";
  const observations = [];
  if (issues.length) observations.push(`Validação: ${issues[0]}`);
  if (curveNeed?.need > 0) observations.push(`A faixa ${curveNeed.label} está ${curveNeed.need} sinal(is) abaixo do alvo heurístico.`);
  if (roleNeed?.need > 0) observations.push(`${roleNeed.label} é a maior lacuna funcional detectada (${roleNeed.count}/${roleNeed.target}).`);
  if (!observations.length) observations.push("A lista não apresenta um déficit objetivo nos sinais estruturados disponíveis.");
  return normalizeDeckAssistantResponse({
    message: `${focus === "meta" ? "Leitura de meta" : focus === "curve" ? "Leitura de curva" : focus === "bricks" ? "Leitura de risco" : "Leitura de consistência"}: ${observations.join(" ")}`,
    evidenceType: issues.length ? "objective" : "inference",
    caveats: [
      "Diagnóstico local baseado apenas nos dados estruturados carregados; nenhum efeito de carta foi inventado.",
      context.relevantMetaDecks?.length ? "Listas competitivas relacionadas foram incluídas no contexto." : "Não há amostra competitiva relacionada suficiente no contexto atual.",
    ],
    provider: "forge-local",
  });
}

function normalizeOperations(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      id: String(row?.id || `${row?.cardId || "card"}:${index}`),
      cardId: String(row?.cardId || ""),
      quantity: Math.max(0, Math.min(4, Number(row?.quantity || 0))),
      reason: String(row?.reason || ""),
    }))
    .filter((row) => row.cardId && row.quantity > 0);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
