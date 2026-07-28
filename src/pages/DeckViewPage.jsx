import { useMemo, useState } from "react";
import { CardArt } from "../components/cards/CardArt";
import { PriceTag } from "../components/cards/PriceTag";
import {
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
  TacticalTable,
} from "../components/tactical/TacticalPageShell";
import { buildDeckRows, buildPlainDeckList, getDeckIssues } from "../domain/deck";
import { deckStats, deckSummaryFromMetaResult, parseDeckUrlList, publicDecksFromMeta } from "../domain/deckLibrary";

export function DeckViewPage({ data, deckId, decks, onEditDeck }) {
  const [inspectedCardNumber, setInspectedCardNumber] = useState("");
  const mainCards = data.cards || [];
  const mainMap = useMemo(() => new Map(mainCards.map((card) => [card.cardNumber, card])), [mainCards]);
  const publicDeck = useMemo(() => {
    const fromList = publicDecksFromMeta(data).find((deck) => deck.id === deckId);
    if (fromList) return fromList;
    const result = (data.metaResults || []).find((row) => row.deckId === deckId);
    return result ? deckSummaryFromMetaResult(result) : null;
  }, [data, deckId]);
  const savedDeck = decks.find((deck) => deck.id === deckId);
  const deck = savedDeck || hydratePublicDeck(publicDeck, data.metaDeckCards || []);
  const stats = deck ? deckStats(deck, mainMap) : null;
  const issues = deck ? getDeckIssues(deck, data.rules || {}, mainMap) : [];
  const mainRows = useMemo(() => deck ? buildDeckRows(deck, "main", mainMap) : [], [deck, mainMap]);
  const inspectedCard = mainRows.find((row) => row.card.cardNumber === inspectedCardNumber)?.card || mainRows[0]?.card || null;

  if (!deck) {
    return (
      <TacticalPageShell>
        <TacticalPageHeader title="Deck not found" subtitle="No decklist matched this tactical id." eyebrow="Deck telemetry" />
      </TacticalPageShell>
    );
  }

  return (
    <TacticalPageShell className="deck-dossier-page">
      <TacticalPageHeader
        eyebrow="Deck telemetry"
        title={deck.name}
        subtitle={issues.length ? issues.join(" ") : "Deck passes current size/color validation checks."}
        actions={(
          <div className="button-row">
          {savedDeck ? <button type="button" onClick={() => onEditDeck(deck.id)}>Edit in builder</button> : null}
          <button type="button" onClick={() => navigator.clipboard?.writeText(buildPlainDeckList(deck, mainMap, "main"))}>Copy list</button>
          {deck.sourceUrl ? <a href={deck.sourceUrl} target="_blank" rel="noreferrer">Source</a> : null}
          </div>
        )}
      />
      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Main deck" value={stats.mainCount} detail="Primary card shell." tone="blue" />
        <TacticalSummaryCard label="Event result" value={deck.result || "-"} detail={deck.event || "No event linked."} tone="gold" />
        <TacticalSummaryCard label="Colors" value={Object.keys(stats.colors || {}).length} detail={Object.keys(stats.colors || {}).join(" / ") || "No color tags."} tone="green" />
        <TacticalSummaryCard label="Source" value={savedDeck ? "Saved" : "Public"} detail={deck.author || deck.sourceName || "Local deck."} />
      </TacticalSummaryStrip>
      <div className="deck-terminal-grid">
        <TacticalDataPanel title="Main deck" subtitle={`${stats.mainCount} cards`} className="deck-terminal-grid__main">
          <DeckRows
            rows={mainRows}
            activeCardNumber={inspectedCard?.cardNumber}
            onInspect={(card) => setInspectedCardNumber(card.cardNumber)}
          />
        </TacticalDataPanel>
        <TacticalDataPanel title="Card scanner" subtitle="Hover or focus a deck row to inspect card telemetry." className="deck-card-scanner">
          <CardScanner card={inspectedCard} quantity={mainRows.find((row) => row.card.cardNumber === inspectedCard?.cardNumber)?.quantity} />
        </TacticalDataPanel>
        <TacticalDataPanel title="Stats" subtitle="Curve, colors, types and rarity spread.">
          <StatsBlock title="Colors" values={stats.colors} />
          <StatsBlock title="Types" values={stats.types} />
          <StatsBlock title="Curve" values={stats.curve} />
          <StatsBlock title="Rarities" values={stats.rarities} />
        </TacticalDataPanel>
      </div>
    </TacticalPageShell>
  );
}

function DeckRows({ rows, activeCardNumber, onInspect }) {
  return (
    <TacticalTable
      columns={["Qty", "Number", "Name", "Color", "Type"]}
      rows={rows}
      renderRow={(row) => (
        <tr
          key={row.card.cardNumber}
          className={row.card.cardNumber === activeCardNumber ? "is-inspected" : ""}
          tabIndex={0}
          onMouseEnter={() => onInspect?.(row.card)}
          onFocus={() => onInspect?.(row.card)}
        >
          <td>{row.quantity}x</td>
          <td>{row.card.cardNumber}</td>
          <td>{row.card.cardName}</td>
          <td>{row.card.color}</td>
          <td>{row.card.cardType}</td>
        </tr>
      )}
      emptyTitle="No cards"
      emptyDetail="This section has no cards yet."
    />
  );
}

function CardScanner({ card, quantity }) {
  if (!card) {
    return (
      <div className="deck-card-scanner__empty">
        <strong>No card locked</strong>
        <span>Move over a deck row to load tactical data.</span>
      </div>
    );
  }

  return (
    <article className="deck-card-scanner__layout">
      <CardArt card={card} className="art-frame art-frame--scanner" />
      <div className="deck-card-scanner__body">
        <span className="eyebrow">Card lock / {quantity || 0}x</span>
        <h3>{card.cardName}</h3>
        <p className="deck-card-scanner__code">{card.cardNumber}</p>
        <dl className="deck-card-scanner__stats">
          <div><dt>Color</dt><dd>{card.color || "-"}</dd></div>
          <div><dt>Type</dt><dd>{card.cardType || "-"}</dd></div>
          <div><dt>Rarity</dt><dd>{card.rarity || "-"}</dd></div>
          <div><dt>Cost</dt><dd>{card.cost || "-"}</dd></div>
          <div><dt>Level</dt><dd>{card.level || "-"}</dd></div>
          <div><dt>AP / HP</dt><dd>{[card.ap, card.hp].filter(Boolean).join(" / ") || "-"}</dd></div>
        </dl>
        <p className="deck-card-scanner__text">{card.effectPreview || card.cardText || "No effect text loaded."}</p>
        <div className="deck-card-scanner__footer">
          <PriceTag card={card} />
          <span>
            Meta {Number(card.recentMetaScore || 0).toFixed(1)}
          </span>
        </div>
      </div>
    </article>
  );
}

function StatsBlock({ title, values }) {
  return (
    <section className="react-stat-block">
      <h3>{title}</h3>
      {Object.entries(values || {}).map(([label, count]) => (
        <span key={label}><b>{label}</b><em>{count}</em></span>
      ))}
    </section>
  );
}

function hydratePublicDeck(deck, deckCards) {
  if (!deck) return null;
  const main = {};
  for (const row of deckCards.filter((card) => card.deckId === deck.id)) {
    main[row.cardNumber] = (main[row.cardNumber] || 0) + Number(row.quantity || 0);
  }
  if (!Object.keys(main).length) {
    Object.assign(main, parseDeckUrlList(deck.deckUrl));
  }
  return { ...deck, main, resource: {} };
}
