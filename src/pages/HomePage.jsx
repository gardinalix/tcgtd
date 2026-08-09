import { useEffect, useMemo, useState } from "react";
import { CardArt } from "../components/cards/CardArt";
import { AnalysisParameters } from "../components/home/AnalysisParameters";
import { DataFilterFeed } from "../components/home/DataFilterFeed";
import { PilotPlatform } from "../components/home/PilotPlatform";
import { FactionCore } from "../components/hud/FactionCore";
import { HudPanel } from "../components/hud/HudPanel";
import { formatBrl, formatUsd } from "../domain/cards";
import { buildMetaSignal } from "../domain/meta";
import { filterCards, pickPilotCard, uniqueValues } from "../utils/cardFilters";

export function HomePage({ data, theme, filters, setFilter, resetFilters, setView }) {
  const [selectedMetaSignal, setSelectedMetaSignal] = useState(null);
  const [selectedFeedItem, setSelectedFeedItem] = useState(null);
  const [activeWinningIndex, setActiveWinningIndex] = useState(0);
  const cards = data.cards || [];
  const allCards = [...cards, ...(data.resourceCards || [])];
  const filteredCards = filterCards(allCards, filters);
  const pilotCard = pickPilotCard(cards, theme);
  const metaSignal = buildMetaSignal(cards, data.archetypes || []);
  const latestWinningLists = useMemo(() => buildLatestWinningLists(data, allCards), [data, allCards]);
  const latestLeakSignals = useMemo(() => buildLatestLeakSignals(data), [data]);
  const latestEvents = (data.metaEvents || []).slice().sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate))).slice(0, 8);
  const latestPreviews = (data.previews || []).filter(isFutureMainReleaseCardSignal).slice(0, 8);
  const options = {
    colors: ["Any", ...uniqueValues(allCards, (card) => card.color)],
    types: ["Any", ...uniqueValues(allCards, (card) => card.cardType)],
    rarities: ["Any", ...uniqueValues(allCards, (card) => card.rarity)],
    sets: ["Any", ...uniqueValues(allCards.flatMap((card) => card.packageCodes || []), (value) => value)],
  };
  const activeWinningList = latestWinningLists[activeWinningIndex % Math.max(1, latestWinningLists.length)] || null;

  useEffect(() => {
    if (latestWinningLists.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveWinningIndex((current) => (current + 1) % latestWinningLists.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [latestWinningLists.length]);

  return (
    <section className="zero-system-cockpit" data-view-panel="home">
      <div className="cockpit-scene-bg" aria-hidden="true">
        <span className="particle particle--one" />
        <span className="particle particle--two" />
        <span className="particle particle--three" />
        <span className="particle particle--four" />
        <span className="cockpit-beam cockpit-beam--one" />
        <span className="cockpit-beam cockpit-beam--two" />
        <span className="cockpit-beam cockpit-beam--three" />
      </div>

      <section className="home-battle-view" aria-label={`${theme.gundamName} battle view`}>
        <HudPanel as="aside" className="cockpit-side-panel cockpit-side-panel--left" title="System status">
          <strong>ACTIVE</strong>
          <div className="system-vitals">
            <div><span>Sync level</span><strong>98.7%</strong></div>
            <div><span>Link</span><strong>Stable</strong></div>
            <div><span>Prediction</span><strong>99.1%</strong></div>
            <div><span>Flow</span><strong>Optimal</strong></div>
          </div>
        </HudPanel>

        <div className="cockpit-viewport">
          <div className="cockpit-hero-copy">
            <span className="eyebrow">{theme.mode}</span>
            <h1>
              <span>{theme.gundamName}</span>
              <span>{theme.stateLabel}</span>
            </h1>
            <p>
              Advanced tactical interface connected. Analyzing prices, competitive meta, and card signals to generate tactical decisions.
            </p>
          </div>

          <FactionCore theme={theme} />

          <div className="gundam-hero-visual gundam-visual" aria-label={`${theme.gundamName} tactical visual`}>
            <div className="gundam-image-stage">
              <img src={theme.gundamImage} alt={theme.gundamName} data-gundam-image data-gundam={theme.id} />
            </div>
            <div className="cockpit-arc cockpit-arc--outer" aria-hidden="true" />
            <div className="cockpit-arc cockpit-arc--inner" aria-hidden="true" />
          </div>

        </div>

        <HudPanel as="aside" className="cockpit-side-panel cockpit-side-panel--right" title="Unit ID">
          <strong>{theme.unitId}</strong>
          <div className="system-vitals">
            <div><span>Pilot</span><strong>{theme.pilot}</strong></div>
            <div><span>Operation</span><strong>{theme.operation}</strong></div>
            <div><span>Link status</span><strong>Active</strong></div>
            <div><span>Battle probability</span><strong>99.1%</strong></div>
          </div>
        </HudPanel>
      </section>

      <section className="home-intel-strip" aria-label="Priority signals">
        <LatestWinningListsCarousel
          lists={latestWinningLists}
          active={activeWinningList}
          activeIndex={activeWinningIndex}
          onSelect={setActiveWinningIndex}
          onOpenDeck={(deckId) => setView("deckView", deckId)}
          onOpenEvent={(eventId) => setView("eventDetail", eventId)}
        />

        <LatestLeakSignalsPanel
          signals={latestLeakSignals}
          onOpenLeaks={() => setView("previews")}
          onSelect={(signal) => setSelectedFeedItem({
            kind: "preview",
            id: signal.previewId || signal.productCode,
            label: signal.cardNumberHint || signal.cardNameHint || signal.productCode || "Preview",
            value: signal.previewStatus || signal.releaseDate,
            payload: signal,
          })}
        />
      </section>

      <section className="cockpit-console home-operations-grid" aria-label="Cockpit console">
        <AnalysisParameters
          filters={filters}
          options={options}
          onFilterChange={setFilter}
          onReset={resetFilters}
          onRun={() => setView("cards")}
        />
        <DataFilterFeed cards={filteredCards} onPackageSelect={(setCode) => setCode !== "OTHERS" && setFilter("set", setCode)} />
        <PilotPlatform card={pilotCard} />
        <MetaMovementPanel
          movements={metaSignal.movements}
          cards={cards}
          onSelect={setSelectedMetaSignal}
          onClick={() => setView("meta")}
        />
        <QuickPanel
          className="cockpit-console-panel--feed"
          title="Event / Preview Feed"
          rows={[
            ...latestEvents.map((event) => ({
              kind: "event",
              id: event.eventId,
              label: event.eventName,
              value: event.formatName || event.eventDate,
              payload: event,
            })),
            ...latestPreviews.map((preview) => ({
              kind: "preview",
              id: preview.previewId || preview.cardNumberHint || preview.productCode,
              label: preview.cardNumberHint || preview.cardNameHint || preview.productCode || "Preview",
              value: preview.previewStatus,
              payload: preview,
            })),
          ]}
          action="Open events"
          onClick={() => setView("events")}
          rowAction={setSelectedFeedItem}
        />
      </section>
      {selectedMetaSignal ? (
        <MetaCardTransmission
          movement={selectedMetaSignal}
          card={cards.find((card) => card.cardNumber === selectedMetaSignal.cardNumber)}
          onClose={() => setSelectedMetaSignal(null)}
          onNavigate={(view, id) => {
            setSelectedMetaSignal(null);
            setView(view, id);
          }}
        />
      ) : null}
      {selectedFeedItem ? (
        <FeedTransmission
          item={selectedFeedItem}
          cards={allCards}
          onClose={() => setSelectedFeedItem(null)}
          onNavigate={(view, id) => {
            setSelectedFeedItem(null);
            setView(view, id);
          }}
        />
      ) : null}
    </section>
  );
}

function LatestLeakSignalsPanel({ signals = [], onOpenLeaks, onSelect }) {
  const hasSignals = signals.length > 0;
  const featured = signals[0];
  const tiles = signals.slice(0, 5);

  if (!hasSignals) {
    return (
      <section className="latest-leaks-panel latest-leaks-panel--empty" aria-label="Latest official preview signals">
        <div className="latest-leaks-panel__header">
          <span className="eyebrow">Preview Radar</span>
          <button type="button" onClick={onOpenLeaks}>Open</button>
        </div>
        <button type="button" className="latest-leaks-panel__standby" onClick={onOpenLeaks}>
          <strong>Standby</strong>
          <span>No future card preview loaded</span>
        </button>
      </section>
    );
  }

  return (
    <section className="latest-leaks-panel" aria-label="Latest official preview signals">
      <div className="latest-leaks-panel__header">
        <span className="eyebrow">Preview / Leak Radar</span>
        <button type="button" onClick={onOpenLeaks}>Open leaks</button>
      </div>
      <button type="button" className="latest-leaks-panel__featured" onClick={() => onSelect(featured)}>
        <div className="latest-leaks-panel__thumbs" aria-hidden="true">
          {tiles.slice(0, 3).map((signal, index) => (
            <span key={`${signal.previewId || signal.productCode}-${index}`} className={`latest-leaks-panel__thumb latest-leaks-panel__thumb--${index + 1}`}>
              {signal.imageUrl ? <img src={signal.imageUrl} alt="" loading="lazy" /> : <b>{signal.productCode || "TBD"}</b>}
            </span>
          ))}
        </div>
        <div className="latest-leaks-panel__copy">
          <strong>{featured.productCode || "Future"}</strong>
          <span>{featured.cardNumberHint || featured.cardNameHint || featured.productName || "Official preview signal"}</span>
          <em>{featured.previewStatus || featured.releaseDate || "Preview watch"}</em>
        </div>
      </button>
      <div className="latest-leaks-panel__strip">
        {tiles.map((signal, index) => (
          <button key={`${signal.previewId || signal.productCode}-${index}-strip`} type="button" onClick={() => onSelect(signal)}>
            {signal.imageUrl ? <img src={signal.imageUrl} alt="" loading="lazy" /> : <span>{signal.productCode || "?"}</span>}
            <b>{signal.productCode || "TBD"}</b>
          </button>
        ))}
      </div>
    </section>
  );
}

function LatestWinningListsCarousel({ lists = [], active, activeIndex, onSelect, onOpenDeck, onOpenEvent }) {
  if (!active) return null;
  const [leftCard, rightCard] = active.cards;

  return (
    <section className="latest-winning-carousel" aria-label="Latest winning lists">
      <div className="latest-winning-carousel__header">
        <span className="eyebrow">Latest winning lists</span>
        <div className="latest-winning-carousel__dots" aria-label="Winning list carousel controls">
          {lists.map((list, index) => (
            <button
              key={list.deckId}
              type="button"
              className={index === activeIndex % lists.length ? "is-active" : ""}
              aria-label={`Show ${list.archetype}`}
              onClick={() => onSelect(index)}
            />
          ))}
        </div>
      </div>
      <button type="button" className="latest-winning-carousel__stage" onClick={() => onOpenDeck(active.deckId)}>
        <div className="winning-card-stack" aria-hidden="true">
          {leftCard ? <CardArt card={leftCard} className="art-frame winning-card winning-card--left" compact /> : null}
          {rightCard ? <CardArt card={rightCard} className="art-frame winning-card winning-card--right" compact /> : null}
        </div>
        <div className="latest-winning-carousel__copy">
          <strong>{active.archetype}</strong>
          <span>{active.eventDate} / {active.playerName}</span>
          <em>{active.eventName}</em>
          <small>{active.sourceName} / {active.eventType}</small>
        </div>
      </button>
      <div className="latest-winning-carousel__actions">
        <button type="button" onClick={() => onOpenDeck(active.deckId)}>Open list</button>
        <button type="button" onClick={() => onOpenEvent(active.eventId)}>Event dossier</button>
      </div>
    </section>
  );
}

function MetaMovementPanel({ movements = [], cards = [], onSelect, onClick }) {
  const rows = movements.slice(0, 5);
  const cardMap = new Map(cards.map((card) => [card.cardNumber, card]));
  return (
    <aside className="cockpit-console-panel cockpit-console-panel--meta cockpit-floating-hud">
      <div className="cockpit-floating-hud__header">
        <span className="eyebrow">Meta Signal Monitoring</span>
        <HudSignalLoader label="Tracking" />
      </div>
      <div className="cockpit-list cockpit-list--scroll meta-movement-list">
        {rows.map((row) => (
          <button
            key={`${row.cardNumber}-${row.previousBand}-${row.band}`}
            type="button"
            className={`meta-movement-row is-${row.movementDirection}`}
            title={row.reason}
            onClick={() => onSelect({ ...row, card: cardMap.get(row.cardNumber) })}
          >
            <strong>{row.cardName}</strong>
            <span className="meta-movement-row__path">
              <em>{row.previousBand}</em>
              <b aria-hidden="true">{row.movementDirection === "down" ? "v" : "^"}</b>
              <em>{row.band}</em>
            </span>
          </button>
        ))}
        {!rows.length ? <span className="cockpit-list-row"><strong>No movement detected</strong><span>Stable</span></span> : null}
      </div>
      <button type="button" onClick={onClick}>Open meta</button>
    </aside>
  );
}

function MetaCardTransmission({ movement, card, onClose, onNavigate }) {
  const resolvedCard = card || movement.card;
  if (!resolvedCard) return null;

  const directionLabel = movement.movementDirection === "down" ? "Signal downgrade" : "Signal upgrade";
  const directionGlyph = movement.movementDirection === "down" ? "v" : "^";

  return (
    <div className={`meta-card-transmission is-${movement.movementDirection}`} role="dialog" aria-modal="true" aria-label={`${resolvedCard.cardName} meta signal`}>
      <button type="button" className="meta-card-transmission__backdrop" aria-label="Close meta signal" onClick={onClose} />
      <article className="meta-card-transmission__dialog">
        <button type="button" className="meta-card-transmission__close" onClick={onClose}>Close</button>
        <div className="meta-card-transmission__scan" aria-hidden="true" />
        <div className="meta-card-transmission__media">
          <CardArt card={resolvedCard} className="art-frame art-frame--detail" />
        </div>
        <div className="meta-card-transmission__content">
          <span className="eyebrow">Meta Signal Transmission</span>
          <h2>{resolvedCard.cardName}</h2>
          <p className="meta-card-transmission__subline">
            {resolvedCard.cardNumber} / {resolvedCard.color || "-"} / {resolvedCard.cardType || "-"} / {resolvedCard.rarity || "-"}
          </p>
          <div className="meta-card-transmission__movement">
            <strong>{movement.previousBand}</strong>
            <b aria-hidden="true">{directionGlyph}</b>
            <strong>{movement.band}</strong>
            <span>{directionLabel}</span>
          </div>
          <dl className="meta-card-transmission__stats">
            <div><dt>Cost</dt><dd>{resolvedCard.cost || "-"}</dd></div>
            <div><dt>Level</dt><dd>{resolvedCard.level || "-"}</dd></div>
            <div><dt>AP / HP</dt><dd>{resolvedCard.ap || "-"} / {resolvedCard.hp || "-"}</dd></div>
            <div><dt>Recent tops</dt><dd>{movement.recent || 0}</dd></div>
            <div><dt>All tops</dt><dd>{movement.all || 0}</dd></div>
            <div><dt>Recent score</dt><dd>{Number(movement.recentScore || 0).toFixed(1)}</dd></div>
            <div><dt>BRL price</dt><dd>{formatBrl(resolvedCard.marketPriceBrlX5)}</dd></div>
            <div><dt>USD price</dt><dd>{formatUsd(resolvedCard.marketPriceUsd)}</dd></div>
          </dl>
          <p className="meta-card-transmission__reason">{movement.reason}</p>
          <p className="meta-card-transmission__text">{resolvedCard.effectPreview || "No card text loaded."}</p>
          <div className="meta-card-transmission__actions">
            <button type="button" onClick={() => onNavigate("card", resolvedCard.cardNumber)}>Open card dossier</button>
            <button type="button" onClick={() => onNavigate("cards")}>Open tactical DB</button>
            <button type="button" onClick={() => onNavigate("meta")}>Open meta monitor</button>
          </div>
        </div>
      </article>
    </div>
  );
}

function QuickPanel({ className, title, rows = [], action, onClick, rowAction }) {
  const normalizedRows = rows.length ? rows : [{ label: "Ready", value: "0", id: "static", kind: "static" }];
  return (
    <aside className={`cockpit-console-panel cockpit-floating-hud ${className}`}>
      <div className="cockpit-floating-hud__header">
        <span className="eyebrow">{title}</span>
        <HudSignalLoader label="Live link" />
      </div>
      <div className="cockpit-list cockpit-list--scroll">
        {normalizedRows.map((row) => (
          <button
            key={`${row.kind}-${row.id || row.label}-${row.value || "static"}`}
            type="button"
            className={`cockpit-list-row cockpit-list-row--button event-feed-row${rowAction && row.kind !== "static" ? "" : " is-static"}`}
            onClick={() => rowAction?.(row)}
            disabled={!rowAction || row.kind === "static"}
          >
            <strong>{row.label}</strong><span>{row.value}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={onClick}>{action}</button>
    </aside>
  );
}

function HudSignalLoader({ label }) {
  return (
    <span className="military-hud-loader" aria-hidden="true">
      <span className="military-hud-loader__reticle" />
      <span className="military-hud-loader__track">
        <i />
        <i />
        <i />
        <i />
      </span>
      <em>{label}</em>
    </span>
  );
}

function buildLatestLeakSignals(data) {
  const productsByCode = new Map((data.products || []).map((product) => [String(product.productCode || "").toUpperCase(), product]));
  return (data.previews || [])
    .filter(isFutureMainReleaseCardSignal)
    .filter((preview) => preview.imageUrl || preview.cardNumberHint || preview.cardNameHint)
    .map((preview) => {
      const code = String(preview.productCode || "").toUpperCase();
      const product = productsByCode.get(code) || {};
      return {
        ...preview,
        productName: preview.productName || product.productName,
        releaseDate: preview.productReleaseDate || product.releaseDate,
        productUrl: preview.productUrl || product.productUrl,
        sortDate: parseLooseDate(preview.sourceDate || preview.productReleaseDate || product.releaseDate),
        signalKind: preview.matchedReleasedCard ? "released" : "preview",
      };
    })
    .sort((left, right) => {
      const leftPreviewOnly = left.matchedReleasedCard ? 1 : 0;
      const rightPreviewOnly = right.matchedReleasedCard ? 1 : 0;
      if (leftPreviewOnly !== rightPreviewOnly) return leftPreviewOnly - rightPreviewOnly;
      return right.sortDate - left.sortDate || String(right.productCode || "").localeCompare(String(left.productCode || ""));
    })
    .slice(0, 8);
}

function parseLooseDate(value) {
  const text = String(value || "").replace(/,/g, ", ").replace(/\s+/g, " ").trim();
  const match = text.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (!match) return 0;
  const parsed = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

const GD04_RELEASE_TIME = parseLooseDate("April 24, 2026");

function isPostGd04Signal(item) {
  const code = String(item?.productCode || item?.packageCode || item?.cardNumberHint || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const releaseTime = parseLooseDate(item?.releaseDate || item?.productReleaseDate);
  if (Number.isFinite(releaseTime) && releaseTime > GD04_RELEASE_TIME) return true;

  const codeMatch = code.match(/^([A-Z]+)(\d+)/);
  if (!codeMatch) return false;
  const family = codeMatch[1];
  const number = Number(codeMatch[2]);
  if (family === "GD") return number > 4;
  if (family === "ST") return number >= 10;
  if (family === "EB") return true;
  if (family === "SC") return true;
  if (family === "PC" || family === "EVX") return true;
  return false;
}

function isFutureMainReleaseCardSignal(item) {
  const cardHint = String(item?.cardNumberHint || "").trim().toUpperCase().replace(/\s+/g, "");
  const productCode = String(item?.productCode || item?.packageCode || "").trim().toUpperCase().replace(/\s+/g, "");
  const code = cardHint || productCode;
  if (!code) return false;
  if (/^(EXBP|EXRP|EXB|EXR|R-|T-)/.test(code)) return false;
  if (/^SC\d+/.test(productCode)) return false;
  if (/^PC\d+/.test(productCode)) return false;

  const codeMatch = code.match(/^([A-Z]+)(\d+)/);
  if (!codeMatch) return isPostGd04Signal(item);
  const family = codeMatch[1];
  const number = Number(codeMatch[2]);
  if (family === "GD") return number > 4;
  if (family === "ST") return number >= 10;
  if (family === "EB") return true;
  return false;
}

function buildLatestWinningLists(data, allCards) {
  const cardMap = new Map(allCards.map((card) => [card.cardNumber, card]));
  const deckCardsByDeck = new Map();
  for (const row of data.metaDeckCards || []) {
    if (!row.deckId) continue;
    if (!deckCardsByDeck.has(row.deckId)) deckCardsByDeck.set(row.deckId, []);
    deckCardsByDeck.get(row.deckId).push(row);
  }

  const winners = (data.metaResults || [])
    .filter((row) => String(row.placingRank || "").trim() === "1" && row.hasDecklist && row.deckId)
    .filter((row) => row.sourceUrl || row.sourceName)
    .sort((left, right) => String(right.eventDate || "").localeCompare(String(left.eventDate || "")));

  const selected = uniqueByDeck(winners).slice(0, 5);

  return selected.map((row) => ({
    ...row,
    archetype: row.archetype && row.archetype !== "Other" ? row.archetype : row.colorCombination || "Winning deck",
    cards: pickArchetypeCards(deckCardsByDeck.get(row.deckId) || [], cardMap),
  })).filter((row) => row.cards.length);
}

function pickArchetypeCards(deckRows, cardMap) {
  const merged = new Map();
  for (const row of deckRows) {
    const card = cardMap.get(row.cardNumber);
    if (!card || /resource/i.test(card.cardType || row.cardType || "")) continue;
    const current = merged.get(row.cardNumber) || { card, quantity: 0 };
    current.quantity += Number(row.quantity || 0);
    merged.set(row.cardNumber, current);
  }

  return [...merged.values()]
    .sort((left, right) => cardPickScore(right) - cardPickScore(left) || String(left.card.cardName).localeCompare(String(right.card.cardName)))
    .slice(0, 2)
    .map((item) => item.card);
}

function cardPickScore(item) {
  const typeScore = /unit/i.test(item.card.cardType || "") ? 70 : /pilot/i.test(item.card.cardType || "") ? 48 : /base/i.test(item.card.cardType || "") ? 28 : 16;
  const rarityScore = rarityRank(item.card.rarity) * 6;
  return typeScore + Number(item.quantity || 0) * 9 + rarityScore + Number(item.card.recentMetaScore || 0);
}

function rarityRank(value) {
  const rarity = String(value || "").toUpperCase();
  if (rarity.includes("LR")) return 7;
  if (rarity.includes("R+")) return 6;
  if (rarity.includes("R")) return 5;
  if (rarity.includes("U")) return 3;
  if (rarity.includes("C")) return 1;
  return 0;
}

function uniqueByDeck(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.deckId)) return false;
    seen.add(row.deckId);
    return true;
  });
}

function FeedTransmission({ item, cards, onClose, onNavigate }) {
  if (item.kind === "event") {
    const event = item.payload;
    return (
      <div className="meta-card-transmission feed-transmission is-up" role="dialog" aria-modal="true" aria-label={`${event.eventName} event feed`}>
        <button type="button" className="meta-card-transmission__backdrop" aria-label="Close event signal" onClick={onClose} />
        <article className="meta-card-transmission__dialog feed-transmission__dialog">
          <button type="button" className="meta-card-transmission__close" onClick={onClose}>Close</button>
          <div className="meta-card-transmission__scan" aria-hidden="true" />
          <div className="feed-transmission__glyph" aria-hidden="true">EVT</div>
          <div className="meta-card-transmission__content">
            <span className="eyebrow">Event Feed Transmission</span>
            <h2>{event.eventName}</h2>
            <p className="meta-card-transmission__subline">
              {event.eventDate || "Unknown date"} / {event.formatName || "Unknown format"} / {event.playerCount || "?"} players
            </p>
            <dl className="meta-card-transmission__stats">
              <div><dt>Type</dt><dd>{event.eventType || "-"}</dd></div>
              <div><dt>Status</dt><dd>{event.officialStatus || "-"}</dd></div>
              <div><dt>Source</dt><dd>{event.sourceName || "-"}</dd></div>
              <div><dt>Country</dt><dd>{event.country || event.region || "-"}</dd></div>
            </dl>
            <p className="meta-card-transmission__reason">Event detected in the synchronized competitive feed.</p>
            <div className="meta-card-transmission__actions">
              <button type="button" onClick={() => onNavigate("eventDetail", event.eventId)}>Open event dossier</button>
              <button type="button" onClick={() => onNavigate("events")}>Open event archive</button>
              {event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer">Source coverage</a> : null}
            </div>
          </div>
        </article>
      </div>
    );
  }

  const preview = item.payload;
  const matchedCard = cards.find((card) => (
    preview.cardNumberHint && String(card.cardNumber).toUpperCase() === String(preview.cardNumberHint).toUpperCase()
  ));

  return (
    <div className="meta-card-transmission feed-transmission is-preview" role="dialog" aria-modal="true" aria-label={`${item.label} preview feed`}>
      <button type="button" className="meta-card-transmission__backdrop" aria-label="Close preview signal" onClick={onClose} />
      <article className="meta-card-transmission__dialog feed-transmission__dialog">
        <button type="button" className="meta-card-transmission__close" onClick={onClose}>Close</button>
        <div className="meta-card-transmission__scan" aria-hidden="true" />
        {matchedCard ? (
          <div className="meta-card-transmission__media">
            <CardArt card={matchedCard} className="art-frame art-frame--detail" />
          </div>
        ) : (
          <div className="feed-transmission__glyph" aria-hidden="true">PRV</div>
        )}
        <div className="meta-card-transmission__content">
          <span className="eyebrow">Preview Radar Transmission</span>
          <h2>{preview.cardNameHint || preview.cardNumberHint || preview.productCode || "Official preview"}</h2>
          <p className="meta-card-transmission__subline">
            {preview.productCode || "Unknown set"} / {preview.previewStatus || "Unknown status"} / confidence {preview.confidence || "-"}
          </p>
          <dl className="meta-card-transmission__stats">
            <div><dt>Source</dt><dd>{preview.sourceType || "-"}</dd></div>
            <div><dt>Date</dt><dd>{preview.sourceDate || preview.productReleaseDate || "-"}</dd></div>
            <div><dt>Card hint</dt><dd>{preview.cardNumberHint || "-"}</dd></div>
            <div><dt>Match</dt><dd>{matchedCard ? "Released card found" : "Preview only"}</dd></div>
          </dl>
          <p className="meta-card-transmission__reason">Official preview row preserved with source/status tracking.</p>
          <div className="meta-card-transmission__actions">
            {matchedCard ? <button type="button" onClick={() => onNavigate("card", matchedCard.cardNumber)}>Open card dossier</button> : null}
            <button type="button" onClick={() => onNavigate("previews")}>Open preview radar</button>
            {preview.sourceUrl ? <a href={preview.sourceUrl} target="_blank" rel="noreferrer">Source page</a> : null}
          </div>
        </div>
      </article>
    </div>
  );
}
