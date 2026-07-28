import {
  formatBrl,
  formatUsd,
  isTcgMarketAvailable,
  ligaGundamPriceIsTrusted,
  marketZeonPriceIsTrusted,
  tcgReferenceBrl,
} from "../../domain/cards";

export function PriceTag({ card }) {
  const tcgAvailable = isTcgMarketAvailable(card);
  const hasMarketZeonPrice = marketZeonPriceIsTrusted(card);
  const hasLigaGundamPrice = ligaGundamPriceIsTrusted(card);
  const tcgBrl = tcgReferenceBrl(card);
  const hasTcgPrice = Number.isFinite(Number(tcgBrl));
  const markup = Number(card.marketZeonMarkupPct);
  const markupLabel = hasMarketZeonPrice && Number.isFinite(markup)
    ? `${markup >= 0 ? "+" : ""}${markup.toFixed(0)}% BR`
    : "";
  const tcgLabel = hasTcgPrice ? formatBrl(tcgBrl) : "Unavailable";
  const usdLabel = hasTcgPrice ? formatUsd(card.marketPriceUsd) : (
    card.priceStatus === "variant_unavailable" ? "TCGP variant unavailable" : "TCGP unavailable"
  );
  const fxLabel = Number.isFinite(Number(card.usdBrlRate))
    ? `FX ${Number(card.usdBrlRate).toFixed(2)}`
    : "FX fallback";
  const ligaLabel = priceSourceLabel({
    hasPrice: hasLigaGundamPrice,
    value: card.ligaGundamLowPriceBrl,
    status: card.ligaGundamComparisonStatus || card.ligaGundamVariantPriceStatus,
    tcgAvailable,
  });
  const marketZeonLabel = priceSourceLabel({
    hasPrice: hasMarketZeonPrice,
    value: card.marketZeonLowPriceBrl,
    status: card.marketZeonComparisonStatus || card.marketZeonVariantPriceStatus,
    tcgAvailable,
  });
  const tcgSourceLabel = card.priceReferenceScope === "variant_unavailable" ? "TCGP variant" : "TCGP BRL reference";

  return (
    <span className="react-price-tag">
      <span className={`price-box price-primary${tcgAvailable ? "" : " price-box--unavailable"}`}>
        <span className="price-source">{tcgSourceLabel}</span>
        <strong>{tcgLabel}</strong>
        <small>{usdLabel} / {fxLabel}</small>
      </span>
      <span className="price-market-strip">
        <span className={`price-box price-market-chip price-market-chip--liga${hasLigaGundamPrice ? "" : " price-box--pending"}`} title={card.ligaGundamBestShop || card.ligaGundamComparisonStatus || "Waiting sync"}>
          <span className="price-source">LigaGundam low</span>
          <strong>{ligaLabel}</strong>
          <small>{hasLigaGundamPrice ? card.ligaGundamBestShop || "Best BR listing" : sourceStatusLabel(card.ligaGundamComparisonStatus || card.ligaGundamVariantPriceStatus)}</small>
        </span>
        <span className={`price-box price-market-chip price-market-chip--marketzeon${hasMarketZeonPrice ? "" : " price-box--pending"}`} title={card.marketZeonBestShop || card.marketZeonComparisonStatus || "Waiting sync"}>
          <span className="price-source">MarketZeon low</span>
          <strong>{marketZeonLabel}</strong>
          <small>{hasMarketZeonPrice ? card.marketZeonBestShop || "Best BR listing" : sourceStatusLabel(card.marketZeonComparisonStatus || card.marketZeonVariantPriceStatus)}</small>
        </span>
      </span>
      {markupLabel ? <small className={markup > 20 ? "price-markup price-markup--hot" : "price-markup"}>{markupLabel}</small> : null}
    </span>
  );
}

function priceSourceLabel({ hasPrice, value, status, tcgAvailable }) {
  if (hasPrice) return formatBrl(value);
  if (!tcgAvailable) return "Unavailable";
  const normalized = String(status || "").toLowerCase();
  if (!normalized || normalized === "not_loaded" || normalized.includes("no_ligagundam") || normalized.includes("not_found")) {
    return "Sync pending";
  }
  return "No BR listing";
}

function sourceStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (!normalized || normalized === "not_loaded") return "Awaiting source sync";
  if (normalized.includes("no_ligagundam") || normalized.includes("not_found")) return "Source not confirmed";
  if (normalized.includes("variant")) return "Variant match";
  return normalized.replaceAll("_", " ");
}
