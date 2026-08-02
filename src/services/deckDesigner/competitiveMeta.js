import { evaluateMainDeckLegality } from "../../domain/deckLegality.js";

export const COMPETITIVE_SCORE_VERSION = "competitive-score-2026-08-01-v1";

export const COMPETITIVE_SCORE_WEIGHTS = Object.freeze({
  placement: 0.3,
  tournamentSize: 0.14,
  tournamentTier: 0.14,
  recency: 0.24,
  consistency: 0.12,
  dataConfidence: 0.06,
});

const FORMAT_IDS = ["GD05", "GD04", "GD03", "GD02", "GD01"];

export function createCompetitiveMetaConfig(data = {}) {
  const results = data.metaResults || [];
  const latestEventDate = latestDate(results) || dateOnly(data.latestEventDate) || dateOnly(new Date());
  const recentCutoffDate = dateOnly(data.recentCutoffDate) || shiftDate(latestEventDate, -120);
  const banlistStart = dateOnly(data.rules?.legalityEffectiveDate) || recentCutoffDate;
  const formats = FORMAT_IDS.map((formatId) => {
    const rows = results.filter((result) => normalizeFormat(result) === formatId);
    if (!rows.length) return null;
    return {
      id: formatId.toLowerCase(),
      label: formatId,
      description: `Resultados registrados no recorte ${formatId}.`,
      mode: "format",
      formatIds: [formatId],
      startDate: earliestDate(rows),
      endDate: latestDate(rows),
      validSets: setsThrough(formatId),
      active: formatId === "GD05",
      archived: formatId !== "GD05",
    };
  }).filter(Boolean);

  return [
    {
      id: "current",
      label: "Meta atual",
      description: "Janela competitiva recente com a banlist vigente.",
      mode: "current",
      startDate: recentCutoffDate,
      endDate: latestEventDate,
      validSets: setsThrough("GD05"),
      banlistEffectiveDate: banlistStart,
      active: true,
      archived: false,
    },
    {
      id: "post-banlist",
      label: "Pós-banlist atual",
      description: "Somente eventos a partir da vigência da lista atual.",
      mode: "current",
      startDate: banlistStart,
      endDate: latestEventDate,
      validSets: setsThrough("GD05"),
      banlistEffectiveDate: banlistStart,
      active: true,
      archived: false,
    },
    ...formats,
    {
      id: "history",
      label: "Histórico completo",
      description: "Arquivo completo; legalidade histórica pode não estar totalmente disponível.",
      mode: "history",
      startDate: earliestDate(results),
      endDate: latestEventDate,
      validSets: [],
      active: false,
      archived: false,
    },
  ];
}

export function getCompetitiveMeta(data = {}, metaId = "current") {
  const metas = createCompetitiveMetaConfig(data);
  return metas.find((meta) => meta.id === metaId) || metas[0];
}

export function calculateRecencyScore(eventDate, meta = {}, referenceDate) {
  const eventTime = parseDate(eventDate);
  const referenceTime = parseDate(referenceDate || meta.endDate || new Date());
  if (!Number.isFinite(eventTime) || !Number.isFinite(referenceTime)) return 0;
  const ageDays = Math.max(0, (referenceTime - eventTime) / 86_400_000);
  const windowDays = meta.mode === "format"
    ? Math.max(45, dateDistance(meta.startDate, meta.endDate) || 120)
    : meta.mode === "history" ? 365 : 105;
  return round(100 * Math.pow(0.5, ageDays / windowDays), 2);
}

export function calculateCompetitiveScore(result = {}, context = {}) {
  const placing = Math.max(1, Number(result.placingRank || parsePlacement(result.placingLabel) || 64));
  const playerCount = Math.max(0, Number(result.playerCount || 0));
  const group = context.group || { appearances: 1, topCuts: placing <= 8 ? 1 : 0, uniquePlayers: 1 };
  const placementScore = clamp(110 - (Math.log2(placing) * 22), 0, 100);
  const tournamentSizeScore = playerCount
    ? clamp((Math.log2(Math.max(8, playerCount)) - 3) * 22, 18, 100)
    : 24;
  const tournamentTierScore = eventTierScore(result);
  const recencyScore = calculateRecencyScore(result.eventDate, context.meta, context.referenceDate);
  const consistencyScore = clamp(
    24
      + Math.log2(Math.max(1, group.appearances)) * 15
      + (group.topCuts / Math.max(1, group.appearances)) * 34
      + Math.min(12, group.uniquePlayers * 2),
    0,
    100,
  );
  const dataConfidenceScore = clamp(
    30
      + (result.hasDecklist !== false ? 30 : 0)
      + (context.complete ? 20 : 0)
      + (result.sourceUrl || result.deckUrl ? 10 : 0)
      + (playerCount ? 10 : 0),
    0,
    100,
  );
  const finalScore = round(
    placementScore * COMPETITIVE_SCORE_WEIGHTS.placement
      + tournamentSizeScore * COMPETITIVE_SCORE_WEIGHTS.tournamentSize
      + tournamentTierScore * COMPETITIVE_SCORE_WEIGHTS.tournamentTier
      + recencyScore * COMPETITIVE_SCORE_WEIGHTS.recency
      + consistencyScore * COMPETITIVE_SCORE_WEIGHTS.consistency
      + dataConfidenceScore * COMPETITIVE_SCORE_WEIGHTS.dataConfidence,
    1,
  );

  return {
    version: COMPETITIVE_SCORE_VERSION,
    placementScore: round(placementScore, 1),
    tournamentSizeScore: round(tournamentSizeScore, 1),
    tournamentTierScore: round(tournamentTierScore, 1),
    recencyScore: round(recencyScore, 1),
    consistencyScore: round(consistencyScore, 1),
    dataConfidenceScore: round(dataConfidenceScore, 1),
    finalScore,
  };
}

export function isResultEligibleForMeta(data = {}, result = {}, metaOrId = "current") {
  const meta = typeof metaOrId === "string" ? getCompetitiveMeta(data, metaOrId) : metaOrId;
  const deck = mainForResult(data, result);
  const expectedSize = Number(data.rules?.mainDeckSize || 50);
  const quantity = sumQuantities(deck.main);
  const format = normalizeFormat(result);
  const resultDate = dateOnly(result.eventDate);
  const withinDate = (!meta.startDate || resultDate >= meta.startDate)
    && (!meta.endDate || resultDate <= meta.endDate);
  const withinFormat = meta.mode !== "format" || meta.formatIds.includes(format);
  const complete = quantity === expectedSize && deck.unknownCards.length === 0;
  const flagged = Boolean(result.invalid || result.incomplete || result.duplicate || result.isDuplicate);
  const currentLegality = meta.mode === "current"
    ? evaluateMainDeckLegality(deck.main, deck.cardMap, data.rules || {})
    : { legal: true, issues: [], violations: [] };
  const eligible = Boolean(
    result.deckId
      && result.hasDecklist !== false
      && resultDate
      && withinDate
      && withinFormat
      && complete
      && !flagged
      && currentLegality.legal,
  );

  return {
    eligible,
    meta,
    main: deck.main,
    complete,
    quantity,
    unknownCards: deck.unknownCards,
    legal: currentLegality.legal,
    legality: currentLegality,
    reason: !result.deckId
      ? "missing_deck_id"
      : !withinFormat
          ? "incompatible_format"
        : !withinDate
          ? "outside_meta_window"
          : flagged
            ? "flagged_result"
            : !complete
              ? "incomplete_decklist"
              : !currentLegality.legal
                ? "current_rules_violation"
                : "eligible",
  };
}

export function getCompetitiveRecommendations(data = {}, metaId = "current", filters = {}) {
  const meta = getCompetitiveMeta(data, metaId);
  const evaluated = (data.metaResults || [])
    .map((result) => ({ result, eligibility: isResultEligibleForMeta(data, result, meta) }))
    .filter((item) => item.eligibility.eligible)
    .filter((item) => matchesFilters(item.result, filters));
  const groups = buildArchetypeGroups(evaluated.map((item) => item.result));
  const referenceDate = meta.endDate || latestDate(evaluated.map((item) => item.result));

  return evaluated
    .map(({ result, eligibility }) => {
      const group = groups.get(groupKey(result));
      const scoreBreakdown = calculateCompetitiveScore(result, {
        meta,
        referenceDate,
        complete: eligibility.complete,
        group,
      });
      return {
        id: result.resultId || result.deckId,
        result,
        main: eligibility.main,
        meta,
        legal: eligibility.legal,
        legality: eligibility.legality,
        scoreBreakdown,
        competitiveScore: scoreBreakdown.finalScore,
        appearances: group?.appearances || 1,
        averageEventSize: Math.round(group?.averageEventSize || Number(result.playerCount || 0)),
        latestResultDate: group?.latestResultDate || result.eventDate,
        dataConfidence: confidenceLabel(scoreBreakdown.dataConfidenceScore),
      };
    })
    .sort((left, right) =>
      right.competitiveScore - left.competitiveScore
        || String(right.result.eventDate).localeCompare(String(left.result.eventDate))
        || Number(left.result.placingRank || 999) - Number(right.result.placingRank || 999));
}

export function createForgeImportFromResult(data = {}, result = {}, selectedMetaId = "current") {
  const eligibility = isResultEligibleForMeta(data, result, selectedMetaId);
  const meta = eligibility.meta || getCompetitiveMeta(data, selectedMetaId);
  const sourceMetadata = {
    sourceTournamentDeckId: result.deckId || "",
    sourceResultId: result.resultId || "",
    playerName: result.playerName || "",
    eventName: result.eventName || "",
    placement: result.placingLabel || String(result.placingRank || ""),
    eventDate: result.eventDate || "",
    originalMetaId: normalizeFormat(result).toLowerCase() || "history",
    selectedMetaId: meta.id,
    sourceUrl: result.deckUrl || result.sourceUrl || "",
    importedAt: new Date().toISOString(),
    archetype: result.archetype || "",
    colors: splitColors(result.colorCombination),
    legalInSelectedMeta: eligibility.eligible,
  };
  return {
    id: `forge-import:${result.resultId || result.deckId}`,
    name: `${result.archetype || "Competitive deck"} · ${result.playerName || "Pilot"}`,
    main: { ...eligibility.main },
    resource: {},
    selectedMetaId: meta.id,
    sourceMetadata,
    originalMain: { ...eligibility.main },
  };
}

function mainForResult(data, result) {
  const cardMap = new Map((data.cards || []).map((card) => [card.cardNumber, card]));
  const main = {};
  const rows = (data.metaDeckCards || []).filter((row) => row.deckId === result.deckId);
  for (const row of rows) {
    if (!row.cardNumber) continue;
    main[row.cardNumber] = (main[row.cardNumber] || 0) + Number(row.quantity || 0);
  }
  if (!Object.keys(main).length && result.deckUrl) {
    try {
      const url = new URL(result.deckUrl);
      const encoded = url.searchParams.get("deck") || "";
      for (const entry of encoded.split(",")) {
        const [cardNumber, quantity] = entry.split(":");
        if (cardNumber && Number(quantity)) main[cardNumber.toUpperCase()] = Number(quantity);
      }
    } catch {
      // A normalized deck row is required when the source URL cannot be parsed.
    }
  }
  return {
    main,
    cardMap,
    unknownCards: Object.keys(main).filter((cardNumber) => !cardMap.has(cardNumber)),
  };
}

function buildArchetypeGroups(results) {
  const groups = new Map();
  for (const result of results) {
    const key = groupKey(result);
    if (!groups.has(key)) groups.set(key, { rows: [], players: new Set() });
    const group = groups.get(key);
    group.rows.push(result);
    if (result.playerName) group.players.add(result.playerName);
  }
  return new Map([...groups.entries()].map(([key, group]) => {
    const playerCounts = group.rows.map((row) => Number(row.playerCount || 0)).filter(Boolean);
    return [key, {
      appearances: group.rows.length,
      topCuts: group.rows.filter((row) => Number(row.placingRank || 999) <= 8).length,
      uniquePlayers: group.players.size,
      averageEventSize: playerCounts.length
        ? playerCounts.reduce((sum, value) => sum + value, 0) / playerCounts.length
        : 0,
      latestResultDate: latestDate(group.rows),
    }];
  }));
}

function matchesFilters(result, filters) {
  const colors = splitColors(result.colorCombination).map((color) => color.toLowerCase());
  if (filters.color && filters.color !== "Any" && !colors.includes(String(filters.color).toLowerCase())) return false;
  if (filters.archetype && !String(result.archetype || "").toLowerCase().includes(String(filters.archetype).toLowerCase())) return false;
  if (filters.player && !String(result.playerName || "").toLowerCase().includes(String(filters.player).toLowerCase())) return false;
  if (filters.minimumPlayers && Number(result.playerCount || 0) < Number(filters.minimumPlayers)) return false;
  return true;
}

function eventTierScore(result) {
  const text = `${result.eventType || ""} ${result.officialStatus || ""} ${result.eventName || ""}`.toLowerCase();
  if (/championship|regional|world|national|qualifier/.test(text)) return 100;
  if (/official|challenge|showdown|cup/.test(text)) return 82;
  if (/store|local|weekly/.test(text)) return 58;
  if (/unofficial|community/.test(text)) return 44;
  return 62;
}

function normalizeFormat(result) {
  return `${result.formatName || ""} ${result.eventType || ""} ${result.sourcePageTitle || ""}`
    .match(/\bGD\d{2}\b/i)?.[0]?.toUpperCase() || "";
}

function setsThrough(formatId) {
  const max = Number(String(formatId).replace(/\D/g, ""));
  return FORMAT_IDS
    .map((id) => ({ id, value: Number(id.replace(/\D/g, "")) }))
    .filter((item) => item.value <= max)
    .sort((left, right) => left.value - right.value)
    .map((item) => item.id);
}

function groupKey(result) {
  return `${String(result.archetype || "Unknown").toLowerCase()}|${splitColors(result.colorCombination).sort().join("/").toLowerCase()}`;
}

function splitColors(value) {
  return String(value || "").split(/[/,+|]+/).map((item) => item.trim()).filter(Boolean);
}

function confidenceLabel(score) {
  return score >= 80 ? "Alta" : score >= 56 ? "Média" : "Baixa";
}

function parsePlacement(value) {
  return Number(String(value || "").match(/\d+/)?.[0] || 0);
}

function sumQuantities(section = {}) {
  return Object.values(section).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
}

function latestDate(rows = []) {
  return rows.map((row) => dateOnly(row.eventDate)).filter(Boolean).sort().at(-1) || "";
}

function earliestDate(rows = []) {
  return rows.map((row) => dateOnly(row.eventDate)).filter(Boolean).sort()[0] || "";
}

function dateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function parseDate(value) {
  const date = dateOnly(value);
  return date ? new Date(`${date}T00:00:00Z`).getTime() : Number.NaN;
}

function dateDistance(start, end) {
  const startTime = parseDate(start);
  const endTime = parseDate(end);
  return Number.isFinite(startTime) && Number.isFinite(endTime)
    ? Math.max(0, (endTime - startTime) / 86_400_000)
    : 0;
}

function shiftDate(value, days) {
  const time = parseDate(value);
  if (!Number.isFinite(time)) return "";
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value || 0)));
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}
