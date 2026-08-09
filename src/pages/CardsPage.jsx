import { useMemo, useRef, useState } from "react";
import { CardDetail } from "../components/cards/CardDetail";
import { CardTable } from "../components/cards/CardTable";
import { CardTile } from "../components/cards/CardTile";
import { SynergyPanel } from "../components/synergy/SynergyPanel";
import {
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";
import { filterCards, uniqueValues } from "../utils/cardFilters";
import { sortCards } from "../domain/cards";

export function CardsPage({ data, filters, setFilter, onOpenCard, onOpenSynergy, onOpenSynergyMap }) {
  const [selectedCardId, setSelectedCardId] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [sortMode, setSortMode] = useState("recent-meta");
  const [printMode, setPrintMode] = useState("all");
  const selectedPanelRef = useRef(null);
  const cards = data.cards || [];
  const resourceCards = data.resourceCards || [];
  const allCards = useMemo(() => [...cards, ...resourceCards], [cards, resourceCards]);
  const searchableCards = useMemo(() => expandCardsByPrinting(allCards), [allCards]);
  const visibleCards = useMemo(() => {
    const filtered = filterCards(searchableCards, filters).filter((card) => {
      if (printMode === "base") return !card.hasAltArt;
      if (printMode === "alts") return card.hasAltArt;
      return true;
    });
    return sortCards(filtered, sortMode);
  }, [searchableCards, filters, sortMode, printMode]);
  const selectedCard = searchableCards.find((card) => card.displayId === selectedCardId) || visibleCards[0] || null;
  const pageCards = visibleCards.slice(0, 160);
  const options = {
    colors: ["Any", ...uniqueValues(searchableCards, (card) => card.color)],
    types: ["Any", ...uniqueValues(searchableCards, (card) => card.cardType)],
    rarities: ["Any", ...uniqueValues(searchableCards, (card) => card.rarity)],
    sets: ["Any", ...uniqueValues(searchableCards.flatMap((card) => card.packageCodes || []), (value) => value)],
  };

  function selectCard(cardId) {
    setSelectedCardId(cardId);
    if (window.matchMedia?.("(max-width: 1280px)").matches) {
      window.requestAnimationFrame(() => {
        selectedPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  return (
    <TacticalPageShell className="cards-terminal-page card-gallery-v2">
      <TacticalPageHeader
        eyebrow="Gallery / card intelligence"
        title="Card gallery"
        subtitle="Image-first browsing with print-level filters, visible market references and competitive context."
      />
      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Database" value={searchableCards.length} detail={`${allCards.length} base cards, variants expanded.`} tone="blue" />
        <TacticalSummaryCard label="Scan result" value={visibleCards.length} detail={`Showing first ${pageCards.length}.`} tone="green" />
        <TacticalSummaryCard label="Mode" value={viewMode} detail={`Sorted by ${sortMode}.`} />
        <TacticalSummaryCard label="Selected" value={selectedCard?.displayCardNumber || selectedCard?.cardNumber || "-"} detail={selectedCard?.cardName || "Awaiting selection."} tone="gold" />
      </TacticalSummaryStrip>

      <div className="cards-terminal-grid react-cards-page">
      <aside className="panel filter-panel react-filter-panel">
        <div className="panel-head">
          <h2>Analysis parameters</h2>
          <p>Search and classify units without leaving the tactical database.</p>
        </div>
        <div className="filter-grid">
          <label>
            <span>Search</span>
            <input value={filters.search} placeholder="Name, number, text..." onChange={(event) => setFilter("search", event.target.value)} />
          </label>
          <Select label="Set" value={filters.set} options={options.sets} onChange={(value) => setFilter("set", value)} />
          <Select label="Color" value={filters.color} options={options.colors} onChange={(value) => setFilter("color", value)} />
          <Select label="Type" value={filters.type} options={options.types} onChange={(value) => setFilter("type", value)} />
          <Select label="Rarity" value={filters.rarity} options={options.rarities} onChange={(value) => setFilter("rarity", value)} />
          <label>
            <span>Cost</span>
            <input value={filters.cost} placeholder="<=3" onChange={(event) => setFilter("cost", event.target.value)} />
          </label>
          <label>
            <span>Trait / keyword</span>
            <input value={filters.trait} placeholder="Blocker, Earth..." onChange={(event) => setFilter("trait", event.target.value)} />
          </label>
          <label>
            <span>Sort</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
              <option value="recent-meta">Recent meta</option>
              <option value="meta-signal">Meta signal</option>
              <option value="number">Number</option>
              <option value="name">Name</option>
              <option value="price-high">Highest BRL price</option>
              <option value="price-low">Lowest BRL price</option>
            </select>
          </label>
        </div>
        <div className="button-row">
          <span className="card-print-switch" role="group" aria-label="Filter printings">
            <button type="button" onClick={() => setPrintMode("all")} className={printMode === "all" ? "is-active" : ""}>All prints</button>
            <button type="button" onClick={() => setPrintMode("base")} className={printMode === "base" ? "is-active" : ""}>Base only</button>
            <button type="button" onClick={() => setPrintMode("alts")} className={printMode === "alts" ? "is-active" : ""}>Alt arts</button>
          </span>
          <button type="button" onClick={() => setViewMode("grid")} className={viewMode === "grid" ? "is-active" : ""}>Grid</button>
          <button type="button" onClick={() => setViewMode("table")} className={viewMode === "table" ? "is-active" : ""}>Table</button>
        </div>
      </aside>

      <section className="panel react-card-results">
        <div className="panel-head">
          <h2>{visibleCards.length} units found</h2>
          <p>{printMode === "all" ? "All printings" : printMode === "base" ? "Base printings" : "Alternate printings"} · showing first {pageCards.length}.</p>
        </div>
        {viewMode === "table" ? (
          <CardTable
            cards={pageCards}
            onSelect={selectCard}
          />
        ) : (
          <div className="card-grid">
            {pageCards.map((card) => (
              <CardTile
                key={card.displayId || card.cardNumber}
                card={card}
                onSelect={selectCard}
                onOpenSynergyMap={onOpenSynergyMap}
              />
            ))}
          </div>
        )}
      </section>

      <aside className="cards-terminal-side-stack" ref={selectedPanelRef}>
        <CardDetail
          card={selectedCard}
          onOpenCard={onOpenCard}
          onOpenSynergyMap={onOpenSynergyMap}
        />
        <SynergyPanel
          sourceCard={selectedCard}
          data={data}
          limit={3}
          compact
          onOpenCard={onOpenCard}
          onOpenFull={onOpenSynergy}
        />
      </aside>
      </div>
    </TacticalPageShell>
  );
}

function expandCardsByPrinting(cards) {
  return cards.flatMap((card) => {
    const printings = Array.isArray(card.printings) ? card.printings.filter((printing) => printing?.detailSearchId || printing?.imageUrl) : [];
    if (printings.length <= 1) {
      return [{ ...card, displayId: card.detailSearchId || card.cardNumber, displayCardNumber: card.displayCardNumber || card.cardNumber }];
    }

    const seen = new Set();
    return printings
      .filter((printing) => {
        const id = printing.detailSearchId || `${card.cardNumber}-${printing.rarity || ""}-${printing.variantCode || ""}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((printing) => buildPrintingCard(card, printing));
  });
}

function buildPrintingCard(card, printing) {
  const displayId = printing.detailSearchId || `${card.cardNumber}-${printing.rarity || ""}-${printing.variantCode || ""}`;
  const isBasePrinting = displayId === card.cardNumber;
  const packageCodes = [...new Set([printing.packageCode, ...(card.packageCodes || [])].filter(Boolean))];
  const packageLabels = [...new Set([printing.packageLabel, ...(card.packageLabels || [])].filter(Boolean))];
  const displayCardNumber = displayId === card.cardNumber ? card.cardNumber : `${card.cardNumber} / ${printing.rarity || "variant"}`;
  const isAltArt = Boolean(printing.isParallelVariant || String(printing.rarity || "").includes("+"));
  const fallbackPrice = isBasePrinting ? card : {};
  const tcgplayerProductId = printing.tcgplayerProductId || printing.tcgplayer_product_id || fallbackPrice.tcgplayerProductId || "";
  const tcgplayerUrl = printing.tcgplayerUrl || printing.tcgplayer_url || fallbackPrice.tcgplayerUrl || "";
  const marketPriceUsd = coalesceNumber(printing.marketPriceUsd, coalesceNumber(printing.market_price_usd, fallbackPrice.marketPriceUsd));
  const marketPriceBrlFx = coalesceNumber(printing.marketPriceBrlFx, coalesceNumber(printing.market_price_brl_fx, fallbackPrice.marketPriceBrlFx));
  const marketPriceBrlX5 = coalesceNumber(printing.marketPriceBrlX5, coalesceNumber(printing.market_price_brl_x5, fallbackPrice.marketPriceBrlX5));
  const lowPriceUsd = coalesceNumber(printing.lowPriceUsd, coalesceNumber(printing.low_price_usd, fallbackPrice.lowPriceUsd));
  const midPriceUsd = coalesceNumber(printing.midPriceUsd, coalesceNumber(printing.mid_price_usd, fallbackPrice.midPriceUsd));
  const highPriceUsd = coalesceNumber(printing.highPriceUsd, coalesceNumber(printing.high_price_usd, fallbackPrice.highPriceUsd));
  const priceStatus = printing.priceStatus || printing.price_status || fallbackPrice.priceStatus || "variant_not_mapped";

  return {
    ...card,
    displayId,
    displayCardNumber,
    detailSearchId: displayId,
    imageUrl: printing.imageUrl || card.imageUrl,
    remoteImageUrl: printing.remoteImageUrl || card.remoteImageUrl,
    detailUrl: printing.detailUrl || card.detailUrl,
    rarity: printing.rarity || card.rarity,
    whereToGetIt: printing.whereToGetIt || card.whereToGetIt,
    packageCodes,
    packageLabels,
    tcgplayerProductId,
    tcgplayerUrl,
    marketPriceUsd,
    marketPriceBrlX5,
    marketPriceBrlFx,
    usdBrlRate: coalesceNumber(printing.usdBrlRate, card.usdBrlRate),
    usdBrlRateSource: printing.usdBrlRateSource || card.usdBrlRateSource,
    usdBrlRateCheckedUtc: printing.usdBrlRateCheckedUtc || card.usdBrlRateCheckedUtc,
    lowPriceUsd,
    midPriceUsd,
    highPriceUsd,
    priceLastCheckedUtc: printing.priceLastCheckedUtc || card.priceLastCheckedUtc,
    priceStatus,
    priceReferenceScope: marketPriceUsd !== undefined ? "printing" : "variant_unavailable",
    variantCode: printing.variantCode || card.variantCode,
    isParallelVariant: Boolean(printing.isParallelVariant),
    hasAltArt: isAltArt,
    printingPriceStatus: printing.marketZeonVariantPriceStatus,
    marketZeonLowPriceBrl: coalesceNumber(printing.marketZeonLowPriceBrl, undefined),
    marketZeonBestShop: printing.marketZeonBestShop || "",
    marketZeonBestUrl: printing.marketZeonBestUrl || "",
    marketZeonListingId: printing.marketZeonListingId,
    marketZeonStoreCount: coalesceNumber(printing.marketZeonStoreCount, 0),
    marketZeonListingCount: coalesceNumber(printing.marketZeonListingCount, 0),
    marketZeonPriceLastCheckedUtc: printing.marketZeonPriceLastCheckedUtc || card.marketZeonPriceLastCheckedUtc,
    ligaGundamLowPriceBrl: coalesceNumber(printing.ligaGundamLowPriceBrl, coalesceNumber(printing.ligagundam_low_price_brl, undefined)),
    ligaGundamAvgPriceBrl: coalesceNumber(printing.ligaGundamAvgPriceBrl, coalesceNumber(printing.ligagundam_avg_price_brl, undefined)),
    ligaGundamHighPriceBrl: coalesceNumber(printing.ligaGundamHighPriceBrl, coalesceNumber(printing.ligagundam_high_price_brl, undefined)),
    ligaGundamBestShop: printing.ligaGundamBestShop || "",
    ligaGundamBestUrl: printing.ligaGundamBestUrl || "",
    ligaGundamStoreCount: coalesceNumber(printing.ligaGundamStoreCount, 0),
    ligaGundamListingCount: coalesceNumber(printing.ligaGundamListingCount, 0),
    ligaGundamComparisonStatus: printing.ligaGundamVariantPriceStatus || printing.ligaGundamComparisonStatus || "",
    ligaGundamPriceLastCheckedUtc: printing.ligaGundamPriceLastCheckedUtc || card.ligaGundamPriceLastCheckedUtc,
    searchText: [
      card.searchText,
      displayId,
      displayCardNumber,
      printing.rarity,
      printing.variantCode,
      printing.whereToGetIt,
      isAltArt ? "alt art parallel rarity plus" : "",
    ].filter(Boolean).join(" ").toLowerCase(),
  };
}

function coalesceNumber(primary, fallback) {
  return Number.isFinite(Number(primary)) ? Number(primary) : fallback;
}

function Select({ label, value, options, onChange }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
