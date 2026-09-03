import { useEffect, useMemo, useRef, useState } from "react";
import { CardDetail } from "../components/cards/CardDetail";
import { CardTable } from "../components/cards/CardTable";
import { CardTile } from "../components/cards/CardTile";
import { SynergyPanel } from "../components/synergy/SynergyPanel";
import {
  TacticalPageHeader,
  TacticalPageShell,
} from "../components/tactical/TacticalPageShell";
import { DEFAULT_FILTERS as DEFAULT_CARD_FILTERS, filterCards, uniqueValues } from "../utils/cardFilters";
import { sortCards } from "../domain/cards";

const INITIAL_CARD_BATCH = 24;

export function CardsPage({ data, filters, setFilter, onOpenCard, onOpenSynergy, onOpenSynergyMap }) {
  const [selectedCardId, setSelectedCardId] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [sortMode, setSortMode] = useState("recent-meta");
  const [printMode, setPrintMode] = useState("all");
  const [resultLimit, setResultLimit] = useState(INITIAL_CARD_BATCH);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState(filters);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.matchMedia?.("(max-width: 820px)").matches ?? false);
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
  const pageCards = visibleCards.slice(0, resultLimit);
  const activeFilterCount = Object.values(filters).filter((value) => value && value !== "Any").length;
  const options = {
    colors: ["Any", ...orderColors(uniqueValues(searchableCards, (card) => card.color))],
    types: ["Any", ...uniqueValues(searchableCards, (card) => card.cardType)],
    rarities: ["Any", ...uniqueValues(searchableCards, (card) => card.rarity)],
    sets: ["Any", ...uniqueValues(searchableCards.flatMap((card) => card.packageCodes || []), (value) => value)],
  };
  const colorCounts = useMemo(() => searchableCards.reduce((counts, card) => {
    const color = card.color || "Unknown";
    counts[color] = (counts[color] || 0) + 1;
    return counts;
  }, {}), [searchableCards]);

  useEffect(() => {
    setResultLimit(INITIAL_CARD_BATCH);
  }, [filters, sortMode, printMode]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const syncMobileLayout = () => setIsMobileLayout(media.matches);
    syncMobileLayout();
    media.addEventListener("change", syncMobileLayout);
    return () => media.removeEventListener("change", syncMobileLayout);
  }, []);

  useEffect(() => {
    if (!filtersOpen && !dossierOpen) return undefined;
    document.body.classList.add("has-v3-drawer");
    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      setFiltersOpen(false);
      setDossierOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("has-v3-drawer");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [filtersOpen, dossierOpen]);

  function selectCard(cardId) {
    setSelectedCardId(cardId);
    setDossierOpen(true);
    if (window.matchMedia?.("(min-width: 821px) and (max-width: 1280px)").matches) {
      window.requestAnimationFrame(() => {
        selectedPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function openFilters() {
    setFilterDraft(filters);
    setFiltersOpen(true);
  }

  function closeFilters() {
    setFiltersOpen(false);
  }

  function updateDraftFilter(key, value) {
    setFilterDraft((current) => ({ ...current, [key]: value }));
  }

  function clearDraftFilters() {
    setFilterDraft({ ...DEFAULT_CARD_FILTERS });
  }

  function applyDraftFilters() {
    Object.entries(filterDraft).forEach(([key, value]) => setFilter(key, value));
    setFiltersOpen(false);
  }

  const selectedCardIndex = selectedCard
    ? visibleCards.findIndex((card) => (card.displayId || card.cardNumber) === (selectedCard.displayId || selectedCard.cardNumber))
    : -1;
  const filterSheetIsHidden = isMobileLayout && !filtersOpen;
  const dossierSheetIsHidden = isMobileLayout && !dossierOpen;

  function selectRelativeCard(direction) {
    if (!visibleCards.length || selectedCardIndex < 0) return;
    const nextIndex = (selectedCardIndex + direction + visibleCards.length) % visibleCards.length;
    selectCard(visibleCards[nextIndex].displayId || visibleCards[nextIndex].cardNumber);
  }

  return (
    <TacticalPageShell className="cards-terminal-page card-gallery-v2">
      <TacticalPageHeader
        eyebrow="SUBSYSTEM 01 // OBJECT ACQUISITION"
        title="Card Intelligence Archive"
        subtitle="Scan printings, effects, market references and competitive signals without leaving the active dossier."
        actions={(
          <button className="v3-mobile-filter-trigger" type="button" onClick={openFilters}>
            <span>FILTERS</span>
            <strong>{activeFilterCount || "ALL"}</strong>
          </button>
        )}
      />
      <div className="cards-terminal-grid react-cards-page tactical-acquisition-layout">
      <div className="cards-acquisition-axis" aria-hidden="true">
        <span>OBJECT ACQUISITION</span><i /><b>{String(visibleCards.length).padStart(4, "0")}</b>
      </div>
      <button className={`v3-drawer-backdrop${filtersOpen ? " is-open" : ""}`} type="button" aria-label="Cancel filter changes" onClick={closeFilters} />
      <aside
        className={`panel filter-panel react-filter-panel hud-control-stack${filtersOpen ? " is-open" : ""}`}
        data-hud-zone="SCAN PARAMETERS"
        aria-label="Card filters"
        aria-hidden={filterSheetIsHidden || undefined}
        aria-modal={isMobileLayout && filtersOpen ? true : undefined}
        inert={filterSheetIsHidden ? "true" : undefined}
        role={isMobileLayout ? "dialog" : undefined}
      >
        <div className="panel-head">
          <div><h2>Analysis parameters</h2><p>Search and classify units without leaving the tactical database.</p></div>
          <button className="v3-drawer-close" type="button" aria-label="Cancel filter changes" onClick={closeFilters}>×</button>
        </div>
        <div className="filter-grid">
          <label>
            <span>Search</span>
            <input value={filtersOpen ? filterDraft.search : filters.search} placeholder="Name, number, text..." onChange={(event) => filtersOpen ? updateDraftFilter("search", event.target.value) : setFilter("search", event.target.value)} />
          </label>
          <Select label="Set" value={filtersOpen ? filterDraft.set : filters.set} options={options.sets} onChange={(value) => filtersOpen ? updateDraftFilter("set", value) : setFilter("set", value)} />
          <ColorFilter value={filtersOpen ? filterDraft.color : filters.color} options={options.colors} counts={colorCounts} onChange={(value) => filtersOpen ? updateDraftFilter("color", value) : setFilter("color", value)} />
          <Select label="Type" value={filtersOpen ? filterDraft.type : filters.type} options={options.types} onChange={(value) => filtersOpen ? updateDraftFilter("type", value) : setFilter("type", value)} />
          <Select label="Rarity" value={filtersOpen ? filterDraft.rarity : filters.rarity} options={options.rarities} onChange={(value) => filtersOpen ? updateDraftFilter("rarity", value) : setFilter("rarity", value)} />
          <label>
            <span>Cost</span>
            <input value={filtersOpen ? filterDraft.cost : filters.cost} placeholder="<=3" onChange={(event) => filtersOpen ? updateDraftFilter("cost", event.target.value) : setFilter("cost", event.target.value)} />
          </label>
          <label>
            <span>Trait / keyword</span>
            <input value={filtersOpen ? filterDraft.trait : filters.trait} placeholder="Blocker, Earth..." onChange={(event) => filtersOpen ? updateDraftFilter("trait", event.target.value) : setFilter("trait", event.target.value)} />
          </label>
        </div>
        <div className="v3-filter-sheet-actions">
          <button type="button" onClick={clearDraftFilters}>CLEAR ALL</button>
          <button type="button" className="is-primary" onClick={applyDraftFilters}>APPLY FILTERS</button>
        </div>
      </aside>

      <section className="panel react-card-results hud-primary-field" data-hud-zone="OBJECT FIELD">
        <span className="hud-field-reticle" aria-hidden="true"><i /><i /></span>
        <div className="panel-head">
          <h2>{visibleCards.length} units found</h2>
          <p>{printMode === "all" ? "All printings" : printMode === "base" ? "Base printings" : "Alternate printings"} · {pageCards.length} active in this scan.</p>
        </div>
        <div className="card-mobile-search">
          <label className="card-mobile-search__field">
            <span>QUICK ACQUISITION</span>
            <input value={filters.search} placeholder="Name, number, effect..." onChange={(event) => setFilter("search", event.target.value)} />
          </label>
          {filters.search ? <button className="card-mobile-search__clear" type="button" onClick={() => setFilter("search", "")} aria-label="Clear card search">CLEAR</button> : null}
          <button type="button" onClick={openFilters}>FILTERS {activeFilterCount ? `· ${activeFilterCount}` : ""}</button>
        </div>
        <div className="card-results-toolbar" role="toolbar" aria-label="Card result controls">
          <label className="card-results-toolbar__sort">
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
          <span className="card-print-switch" role="group" aria-label="Filter printings">
            <button type="button" onClick={() => setPrintMode("all")} className={printMode === "all" ? "is-active" : ""}>All</button>
            <button type="button" onClick={() => setPrintMode("base")} className={printMode === "base" ? "is-active" : ""}>Base</button>
            <button type="button" onClick={() => setPrintMode("alts")} className={printMode === "alts" ? "is-active" : ""}>Alt</button>
          </span>
          <span className="card-view-switch" role="group" aria-label="Results view">
            <button type="button" onClick={() => setViewMode("grid")} className={viewMode === "grid" ? "is-active" : ""}>Grid</button>
            <button type="button" onClick={() => setViewMode("table")} className={viewMode === "table" ? "is-active" : ""}>List</button>
          </span>
          <span className="card-results-toolbar__readout">{searchableCards.length} INDEXED // {pageCards.length} ONLINE</span>
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
        {pageCards.length < visibleCards.length ? (
          <div className="card-result-expander">
            <span><b>{pageCards.length}</b> / {visibleCards.length} ACQUIRED</span>
            <button type="button" onClick={() => setResultLimit((current) => Math.min(current + INITIAL_CARD_BATCH, visibleCards.length))}>
              LOAD NEXT {Math.min(INITIAL_CARD_BATCH, visibleCards.length - pageCards.length)}
            </button>
          </div>
        ) : null}
      </section>

      <button className={`v3-drawer-backdrop v3-drawer-backdrop--dossier${dossierOpen ? " is-open" : ""}`} type="button" aria-label="Close card dossier" onClick={() => setDossierOpen(false)} />
      <aside
        className={`cards-terminal-side-stack hud-dossier-stack${dossierOpen ? " is-open" : ""}`}
        data-hud-zone="ACTIVE DOSSIER"
        aria-label="Active card dossier"
        aria-hidden={dossierSheetIsHidden || undefined}
        aria-modal={isMobileLayout && dossierOpen ? true : undefined}
        inert={dossierSheetIsHidden ? "true" : undefined}
        ref={selectedPanelRef}
        role={isMobileLayout ? "dialog" : undefined}
      >
        <button className="v3-drawer-close v3-dossier-close" type="button" aria-label="Close card dossier" onClick={() => setDossierOpen(false)}>×</button>
        <CardDetail
          card={selectedCard}
          onOpenCard={onOpenCard}
          onOpenSynergyMap={onOpenSynergyMap}
          onPrevious={visibleCards.length > 1 ? () => selectRelativeCard(-1) : undefined}
          onNext={visibleCards.length > 1 ? () => selectRelativeCard(1) : undefined}
          positionLabel={selectedCardIndex >= 0 ? `${selectedCardIndex + 1} / ${visibleCards.length}` : ""}
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

function ColorFilter({ value, options, counts, onChange }) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return (
    <fieldset className="card-color-filter">
      <legend>Color spectrum</legend>
      <div>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? "is-active" : ""}
            data-card-color={colorToken(option)}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            <i aria-hidden="true" />
            <span>{option === "Any" ? "All" : option}</span>
            <small>{option === "Any" ? total : counts[option] || 0}</small>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function colorToken(value) {
  const token = String(value || "any").toLowerCase();
  if (token.includes("blue") || token.includes("azul")) return "blue";
  if (token.includes("red") || token.includes("vermelh")) return "red";
  if (token.includes("green") || token.includes("verde")) return "green";
  if (token.includes("white") || token.includes("branc")) return "white";
  if (token.includes("purple") || token.includes("rox") || token.includes("púrpura") || token.includes("purpura")) return "purple";
  if (token.includes("yellow") || token.includes("amarel")) return "yellow";
  if (token.includes("black") || token.includes("pret")) return "black";
  if (token.includes("neutral") || token.includes("neutr")) return "neutral";
  return "any";
}

function orderColors(colors) {
  const priority = { blue: 0, red: 1, green: 2, white: 3, purple: 4, yellow: 5, black: 6, neutral: 7, any: 8 };
  return colors.slice().sort((left, right) => {
    const leftRank = priority[colorToken(left)] ?? 99;
    const rightRank = priority[colorToken(right)] ?? 99;
    return leftRank - rightRank || String(left).localeCompare(String(right));
  });
}
