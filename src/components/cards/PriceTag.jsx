import { formatBrl, getPriceTelemetry } from "../../domain/cards";

export function PriceTag({ card, compact = false }) {
  const signal = getPriceTelemetry(card);
  const deltaLabel = Number.isFinite(signal.deltaPct)
    ? `${signal.deltaPct >= 0 ? "+" : ""}${signal.deltaPct.toFixed(0)}% vs REF`
    : "";

  return (
    <span className={`react-price-tag market-readout market-readout--${signal.kind}${compact ? " is-compact" : ""}`}>
      <span className="market-readout__primary">
        <small>{signal.label}</small>
        <strong>{signal.value === null ? "—" : formatBrl(signal.value)}</strong>
        <em>{signal.sourceCode} // {signal.shop || signal.sourceLabel}</em>
      </span>
      {signal.comparison.length ? (
        <span className="market-readout__sources" aria-label="Price source comparison">
          {signal.comparison.map((source) => (
            <span
              key={source.code}
              className={`${source.code === signal.sourceCode ? "is-primary" : ""}${source.isReference ? " is-reference" : ""}`.trim()}
              title={`${source.label}: ${formatBrl(source.value)}${source.shop ? ` · ${source.shop}` : ""}`}
            >
              <small>{source.code}</small>
              <b>{formatAmount(source.value)}</b>
            </span>
          ))}
        </span>
      ) : (
        <span className="market-readout__empty">NO SYNCHRONIZED LISTING</span>
      )}
      {deltaLabel ? <small className={`market-readout__delta${signal.deltaPct > 20 ? " is-hot" : signal.deltaPct < -20 ? " is-low" : ""}`}>{deltaLabel}</small> : null}
    </span>
  );
}

export function MarketPriceBadge({ card }) {
  const signal = getPriceTelemetry(card);
  return (
    <span className={`market-price-badge market-price-badge--${signal.kind}`} title={`${signal.label} · ${signal.sourceLabel}${signal.shop ? ` · ${signal.shop}` : ""}`}>
      <small>{signal.sourceCode}</small>
      <strong>{signal.value === null ? "—" : formatAmount(signal.value)}</strong>
      <em>{signal.kind === "market" ? "BR LOW" : signal.kind === "reference" ? "BR REF" : "NO DATA"}</em>
    </span>
  );
}

function formatAmount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
