export function getMetaSignal(card) {
  const recentMeta = Number(card.recentMetaScore || 0);
  const overallMeta = Number(card.overallMetaScore || 0);
  const recentUse = Number(card.recentTop8DecksUsing || 0);
  const allUse = Number(card.allTop8DecksUsing || 0);
  const marketPrice = Number(card.marketPriceUsd || 0);

  if (recentMeta >= 18 || recentUse >= 3 || overallMeta >= 28 || allUse >= 8) {
    return { value: "keep", label: "KEEP", tone: "green", reason: "Strong current or historical meta signal." };
  }
  if (recentMeta >= 6 || overallMeta >= 10 || recentUse || allUse >= 3 || marketPrice >= 2) {
    return { value: "watch", label: "WATCH", tone: "gold", reason: "Moderate meta, usage, or price signal." };
  }
  return { value: "bulk", label: "BULK", tone: "muted", reason: "No strong competitive or price signal in current data." };
}

export function formatBrl(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "No BRL price";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric).replace(/\u00a0/g, " ");
}

export function formatUsd(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "No USD price";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric).replace("$", "US$ ");
}

export function isTcgMarketAvailable(card) {
  return String(card?.priceStatus || "").toLowerCase() === "ok";
}

export function tcgReferenceBrl(card) {
  if (!isTcgMarketAvailable(card)) return null;
  if (Number.isFinite(Number(card?.marketPriceBrlFx))) return Number(card.marketPriceBrlFx);
  if (Number.isFinite(Number(card?.marketPriceBrlX5))) return Number(card.marketPriceBrlX5);
  return null;
}

export function marketZeonPriceIsTrusted(card) {
  return isTcgMarketAvailable(card) && Number.isFinite(Number(card?.marketZeonLowPriceBrl)) && Number(card.marketZeonLowPriceBrl) > 0;
}

export function ligaGundamPriceIsTrusted(card) {
  return isTcgMarketAvailable(card) && Number.isFinite(Number(card?.ligaGundamLowPriceBrl)) && Number(card.ligaGundamLowPriceBrl) > 0;
}

export function effectiveBrlPrice(card) {
  return getPriceTelemetry(card).value;
}

export function getPriceTelemetry(card) {
  const reference = tcgReferenceBrl(card);
  const listings = [
    ligaGundamPriceIsTrusted(card) ? {
      code: "LIGA",
      label: "LigaGundam",
      value: Number(card.ligaGundamLowPriceBrl),
      shop: card.ligaGundamBestShop || "Marketplace",
      url: card.ligaGundamBestUrl || "",
      checkedAt: card.ligaGundamPriceLastCheckedUtc || "",
    } : null,
    marketZeonPriceIsTrusted(card) ? {
      code: "MZ",
      label: "MarketZeon",
      value: Number(card.marketZeonLowPriceBrl),
      shop: card.marketZeonBestShop || "Marketplace",
      url: card.marketZeonBestUrl || "",
      checkedAt: card.marketZeonPriceLastCheckedUtc || "",
    } : null,
  ].filter(Boolean).sort((left, right) => left.value - right.value || left.code.localeCompare(right.code));
  const primary = listings[0] || null;
  const comparison = [
    ...listings,
    Number.isFinite(reference) ? {
      code: "REF",
      label: "TCGplayer reference",
      value: reference,
      shop: "Converted USD reference",
      url: card?.tcgplayerUrl || "",
      checkedAt: card?.priceLastCheckedUtc || "",
      isReference: true,
    } : null,
  ].filter(Boolean);

  if (primary) {
    const deltaPct = Number.isFinite(reference) && reference > 0
      ? ((primary.value / reference) - 1) * 100
      : null;
    return {
      kind: "market",
      status: "available",
      label: "BR market low",
      value: primary.value,
      sourceCode: primary.code,
      sourceLabel: primary.label,
      shop: primary.shop,
      checkedAt: primary.checkedAt,
      deltaPct,
      comparison,
    };
  }

  if (Number.isFinite(reference)) {
    return {
      kind: "reference",
      status: "reference_only",
      label: "TCG reference",
      value: reference,
      sourceCode: "REF",
      sourceLabel: "TCGplayer",
      shop: "Converted USD reference",
      checkedAt: card?.priceLastCheckedUtc || "",
      deltaPct: null,
      comparison,
    };
  }

  return {
    kind: "unavailable",
    status: "unavailable",
    label: "Market signal",
    value: null,
    sourceCode: "N/A",
    sourceLabel: "No synchronized source",
    shop: "",
    checkedAt: "",
    deltaPct: null,
    comparison: [],
  };
}

export function sortCards(cards, mode) {
  const sorted = cards.slice();
  sorted.sort((left, right) => {
    if (mode === "name") return text(left.cardName).localeCompare(text(right.cardName));
    if (mode === "number") return text(left.cardNumber).localeCompare(text(right.cardNumber));
    if (mode === "price-high") return priceSort(right) - priceSort(left);
    if (mode === "price-low") return priceSort(left) - priceSort(right);
    if (mode === "meta-signal") return signalRank(getMetaSignal(left).value) - signalRank(getMetaSignal(right).value);
    return Number(right.recentMetaScore || 0) - Number(left.recentMetaScore || 0) || text(left.cardName).localeCompare(text(right.cardName));
  });
  return sorted;
}

function signalRank(value) {
  return { keep: 0, watch: 1, bulk: 2 }[value] ?? 3;
}

function priceSort(card) {
  const price = effectiveBrlPrice(card);
  return Number.isFinite(price) ? price : -1;
}

function text(value) {
  return String(value || "");
}
