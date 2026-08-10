import { CardArt } from "../components/cards/CardArt";
import { PriceTag } from "../components/cards/PriceTag";
import { formatUsd, isTcgMarketAvailable, marketZeonPriceIsTrusted, tcgReferenceBrl } from "../domain/cards";
import {
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";

export function PricesPage({ data }) {
  const cards = [...(data.cards || []), ...(data.resourceCards || [])];
  const priced = cards.filter((card) => isTcgMarketAvailable(card) && Number.isFinite(Number(tcgReferenceBrl(card))));
  const marketZeonPriced = cards.filter((card) => marketZeonPriceIsTrusted(card));
  const comparable = marketZeonPriced.filter((card) => Number.isFinite(Number(card.marketZeonMarkupPct)));
  const highest = priced.slice().sort((left, right) => Number(tcgReferenceBrl(right) || 0) - Number(tcgReferenceBrl(left) || 0)).slice(0, 80);
  const highestMarkup = comparable
    .slice()
    .sort((left, right) => Number(right.marketZeonMarkupPct || 0) - Number(left.marketZeonMarkupPct || 0))
    .slice(0, 80);
  const bestDeals = comparable
    .slice()
    .sort((left, right) => Number(left.marketZeonMarkupPct || 0) - Number(right.marketZeonMarkupPct || 0))
    .slice(0, 20);
  const coverage = cards.length ? Math.round((priced.length / cards.length) * 100) : 0;
  const brCoverage = cards.length ? Math.round((marketZeonPriced.length / cards.length) * 100) : 0;
  const avgMarkup = comparable.length
    ? comparable.reduce((total, card) => total + Number(card.marketZeonMarkupPct || 0), 0) / comparable.length
    : null;

  return (
    <TacticalPageShell className="prices-terminal-page">
      <TacticalPageHeader
        eyebrow="Market"
        title="BR market radar"
        subtitle="LigaGundam and MarketZeon BR listings compared against TCGPlayer reference converted with the current USD/BRL rate."
      />
      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Priced cards" value={priced.length} tone="blue" />
        <TacticalSummaryCard label="TCG coverage" value={`${coverage}%`} />
        <TacticalSummaryCard label="BR coverage" value={`${brCoverage}%`} tone="gold" />
        <TacticalSummaryCard label="Avg BR markup" value={avgMarkup === null ? "N/A" : `${avgMarkup >= 0 ? "+" : ""}${avgMarkup.toFixed(0)}%`} />
      </TacticalSummaryStrip>
      <TacticalDataPanel title="BR markup watchlist" subtitle="Cards with the highest MarketZeon low price versus TCGPlayer BRL reference.">
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
            {highestMarkup.map((card) => (
              <tr key={card.cardNumber}>
                <td><CardArt card={card} className="art-frame art-frame--mini" compact /></td>
                <td>{card.cardNumber}</td>
                <td>{card.cardName}</td>
                <td><PriceTag card={card} /></td>
                <td>{Number.isFinite(Number(card.marketZeonMarkupPct)) ? `${Number(card.marketZeonMarkupPct).toFixed(0)}%` : "N/A"}</td>
                <td>
                  {card.marketZeonBestUrl ? (
                    <a href={card.marketZeonBestUrl} target="_blank" rel="noreferrer">{card.marketZeonBestShop || "MarketZeon"}</a>
                  ) : (
                    card.marketZeonComparisonStatus || "not loaded"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TacticalDataPanel>
      <TacticalDataPanel title="Best BR opportunities" subtitle="Cards currently below the converted TCGPlayer reference.">
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
            {bestDeals.map((card) => (
              <tr key={card.cardNumber}>
                <td><CardArt card={card} className="art-frame art-frame--mini" compact /></td>
                <td>{card.cardNumber}</td>
                <td>{card.cardName}</td>
                <td><PriceTag card={card} /></td>
                <td>{Number(card.marketZeonMarkupPct).toFixed(0)}%</td>
                <td>{card.tcgplayerUrl ? <a href={card.tcgplayerUrl} target="_blank" rel="noreferrer">TCGplayer</a> : formatUsd(card.marketPriceUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TacticalDataPanel>
      <TacticalDataPanel title="Highest TCG references" subtitle="Fallback view from synchronized TCGCSV cache.">
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
            {highest.slice(0, 30).map((card) => (
              <tr key={card.cardNumber}>
                <td><CardArt card={card} className="art-frame art-frame--mini" compact /></td>
                <td>{card.cardNumber}</td>
                <td>{card.cardName}</td>
                <td><PriceTag card={card} /></td>
                <td>{card.priceStatus || "not loaded"}</td>
                <td>{card.tcgplayerUrl ? <a href={card.tcgplayerUrl} target="_blank" rel="noreferrer">TCGplayer</a> : "Tcgcsv cache"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TacticalDataPanel>
    </TacticalPageShell>
  );
}
