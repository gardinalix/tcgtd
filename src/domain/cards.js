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
  return `R$ ${numeric.toFixed(2)}`;
}

export function formatUsd(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "No USD price";
  return `US$ ${numeric.toFixed(2)}`;
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
  if (ligaGundamPriceIsTrusted(card)) return Number(card.ligaGundamLowPriceBrl);
  if (marketZeonPriceIsTrusted(card)) return Number(card.marketZeonLowPriceBrl);
  const reference = tcgReferenceBrl(card);
  if (Number.isFinite(reference)) return reference;
  return null;
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
