import { CardArt } from "../components/cards/CardArt";
import { PriceTag } from "../components/cards/PriceTag";
import { formatBrl, formatUsd, getPriceTelemetry, tcgReferenceBrl } from "../domain/cards";
import {
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";

export function PricesPage({ data }) {
  const cards = [...(data.cards || []), ...(data.resourceCards || [])];
  const priced = cards.filter((card) => tcgReferenceBrl(card) > 0);
  const comparisons = cards.map((card) => ({ card, delta: getPriceTelemetry(card).deltaPct }));
  const comparable = comparisons.filter(({ delta }) => Number.isFinite(delta));
  const highest = priced.sort((left, right) => tcgReferenceBrl(right) - tcgReferenceBrl(left)).slice(0, 30);
  const highestMarkup = comparable.filter(({ delta }) => delta > 0)
    .sort((left, right) => right.delta - left.delta).slice(0, 80);
  const bestDeals = comparable.filter(({ delta }) => delta < 0)
    .sort((left, right) => left.delta - right.delta)
    .slice(0, 20);
  const coverage = cards.length ? Math.round((priced.length / cards.length) * 100) : 0;
  const brCoverage = cards.length ? Math.round((comparable.length / cards.length) * 100) : 0;

  return (
    <TacticalPageShell className="prices-terminal-page">
      <TacticalPageHeader
        eyebrow="Market"
        title="BR market radar"
        subtitle="LigaGundam BR listings compared against TCGPlayer reference converted with the current USD/BRL rate."
      />
      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Priced cards" value={priced.length} tone="blue" />
        <TacticalSummaryCard label="TCG coverage" value={`${coverage}%`} />
        <TacticalSummaryCard label="LigaGundam coverage" value={`${brCoverage}%`} tone="gold" />
      </TacticalSummaryStrip>
      <TacticalDataPanel title="LigaGundam price watchlist" subtitle="Cards with the highest LigaGundam markup versus TCGPlayer BRL reference.">
        <div className="react-table-wrap" tabIndex={0} role="region" aria-label="Market price comparison">
        <table className="data-table react-card-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Number</th>
              <th>Name</th>
              <th>BR low / TCG ref</th>
              <th>Markup</th>
              <th>BR source</th>
            </tr>
          </thead>
          <tbody>
            {highestMarkup.map(({ card, delta }) => (
              <tr key={card.cardNumber}>
                <td><CardArt card={card} className="art-frame art-frame--mini" compact /></td>
                <td>{card.cardNumber}</td>
                <td>{card.cardName}</td>
                <td><PriceTag card={card} /></td>
                <td>+{delta.toFixed(0)}%</td>
                <td>{card.ligaGundamBestUrl ? <a href={card.ligaGundamBestUrl} target="_blank" rel="noreferrer">LigaGundam</a> : "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </TacticalDataPanel>
      <TacticalDataPanel title="Best BR opportunities" subtitle="Cards currently below the converted TCGPlayer reference.">
        <div className="react-table-wrap" tabIndex={0} role="region" aria-label="Market price comparison">
        <table className="data-table react-card-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Number</th>
              <th>Name</th>
              <th>BR low / TCG ref</th>
              <th>Delta</th>
              <th>TCG source</th>
            </tr>
          </thead>
          <tbody>
            {bestDeals.map(({ card, delta }) => (
              <tr key={card.cardNumber}>
                <td><CardArt card={card} className="art-frame art-frame--mini" compact /></td>
                <td>{card.cardNumber}</td>
                <td>{card.cardName}</td>
                <td><PriceTag card={card} /></td>
                <td>{delta.toFixed(0)}%</td>
                <td>{card.tcgplayerUrl ? <a href={card.tcgplayerUrl} target="_blank" rel="noreferrer">TCGplayer</a> : formatUsd(card.marketPriceUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </TacticalDataPanel>
      <TacticalDataPanel title="Highest TCG references" subtitle="Fallback view from synchronized TCGCSV cache.">
        <div className="react-table-wrap" tabIndex={0} role="region" aria-label="Market price comparison">
        <table className="data-table react-card-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Number</th>
              <th>Name</th>
              <th>BRL / USD</th>
              <th>Status</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {highest.map((card) => (
              <tr key={card.cardNumber}>
                <td><CardArt card={card} className="art-frame art-frame--mini" compact /></td>
                <td>{card.cardNumber}</td>
                <td>{card.cardName}</td>
                <td>{formatBrl(tcgReferenceBrl(card))} / {formatUsd(card.marketPriceUsd)}</td>
                <td>{card.priceStatus || "not loaded"}</td>
                <td>{card.tcgplayerUrl ? <a href={card.tcgplayerUrl} target="_blank" rel="noreferrer">TCGplayer</a> : "Tcgcsv cache"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </TacticalDataPanel>
    </TacticalPageShell>
  );
}
