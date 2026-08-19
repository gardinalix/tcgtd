import { useMemo, useState } from "react";
import { CardArt } from "../components/cards/CardArt";
import { PriceTag } from "../components/cards/PriceTag";
import { DeckImageExportLayer } from "../components/decks/DeckImageExportLayer.jsx";
import {
  TacticalDataPanel,
  TacticalPageShell,
  TacticalTable,
} from "../components/tactical/TacticalPageShell";
import { buildDeckRows, buildPlainDeckList, getDeckIssues } from "../domain/deck";
import { deckStats, deckSummaryFromMetaResult, parseDeckUrlList, publicDecksFromMeta } from "../domain/deckLibrary";

export function DeckViewPage({ data, deckId, decks, onEditDeck, onSendToForge }) {
  const [inspectedCardNumber, setInspectedCardNumber] = useState("");
  const [imageExportOpen, setImageExportOpen] = useState(false);
  const mainCards = data.cards || [];
  const mainMap = useMemo(() => new Map(mainCards.map((card) => [card.cardNumber, card])), [mainCards]);
  const publicDeck = useMemo(() => {
    const fromList = publicDecksFromMeta(data).find((deck) => deck.id === deckId);
    if (fromList) return fromList;
    const result = (data.metaResults || []).find((row) => row.deckId === deckId);
    return result ? deckSummaryFromMetaResult(result) : null;
  }, [data, deckId]);
  const sourceResult = useMemo(
    () => (data.metaResults || []).find((row) => row.deckId === deckId) || null,
    [data.metaResults, deckId],
  );
  const savedDeck = decks.find((deck) => deck.id === deckId);
  const deck = savedDeck || hydratePublicDeck(publicDeck, data.metaDeckCards || []);
  const stats = deck ? deckStats(deck, mainMap) : null;
  const issues = deck ? getDeckIssues(deck, data.rules || {}, mainMap) : [];
  const mainRows = useMemo(() => deck ? buildDeckRows(deck, "main", mainMap) : [], [deck, mainMap]);
  const featuredRows = useMemo(
    () => selectDeckIdentityRows(mainRows, deck?.name),
    [deck?.name, mainRows],
  );
  const inspectedCard = mainRows.find((row) => row.card.cardNumber === inspectedCardNumber)?.card || mainRows[0]?.card || null;

  if (!deck) {
    return (
      <TacticalPageShell>
        <section className="deck-identity-hero deck-identity-hero--empty">
          <div className="deck-identity-hero__copy">
            <span className="eyebrow">Deck telemetry</span>
            <h1>Deck not found</h1>
            <p>No decklist matched this tactical id.</p>
          </div>
        </section>
      </TacticalPageShell>
    );
  }

  return (
    <TacticalPageShell className="deck-dossier-page">
      <DeckIdentityHero
        deck={deck}
        stats={stats}
        issues={issues}
        featuredRows={featuredRows}
        savedDeck={savedDeck}
        sourceResult={sourceResult}
        onInspect={(cardNumber) => setInspectedCardNumber(cardNumber)}
        onEditDeck={onEditDeck}
        onSendToForge={onSendToForge}
        onCopy={() => navigator.clipboard?.writeText(buildPlainDeckList(deck, mainMap, "main"))}
        onImageExport={() => setImageExportOpen(true)}
      />
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
      {imageExportOpen ? (
        <DeckImageExportLayer
          deck={deck}
          rows={mainRows}
          stats={stats}
          onClose={() => setImageExportOpen(false)}
        />
      ) : null}
    </TacticalPageShell>
  );
}

function DeckIdentityHero({
  deck,
  stats,
  issues,
  featuredRows,
  savedDeck,
  sourceResult,
  onInspect,
  onEditDeck,
  onSendToForge,
  onCopy,
  onImageExport,
}) {
  const colors = Object.keys(stats.colors || {});
  return (
    <section className={`deck-identity-hero ${issues.length ? "is-warning" : "is-valid"}`.trim()}>
      <div className="deck-identity-hero__copy">
        <span className="eyebrow">07 // DECK IDENTITY</span>
        <h1>{deck.name}</h1>
        <div className="deck-identity-hero__status">
          <i aria-hidden="true" />
          <span>{issues.length ? issues.join(" ") : "Deck passes current size and color validation checks."}</span>
        </div>
        <div className="deck-identity-hero__tags" aria-label="Deck identity tags">
          <span>{colors.join(" / ") || "COLOR OPEN"}</span>
          <span>{deck.event || "NO EVENT LINKED"}</span>
          <span>{deck.author || deck.sourceName || "COMMUNITY DECK"}</span>
        </div>
        <div className="deck-identity-hero__actions">
          {savedDeck ? <button type="button" onClick={() => onEditDeck(deck.id)}>EDITAR NO BUILDER</button> : null}
          {sourceResult ? <button type="button" className="is-forge" onClick={() => onSendToForge?.(sourceResult, "current")}>ENVIAR PARA A FORJA</button> : null}
          <button type="button" onClick={onCopy}>COPIAR LISTA</button>
          <button type="button" className="is-image-export" onClick={onImageExport}>EXPORTAR IMAGEM</button>
          {deck.sourceUrl ? <a href={deck.sourceUrl} target="_blank" rel="noreferrer">FONTE</a> : null}
        </div>
      </div>

      <div className="deck-identity-hero__loadout" aria-label="Cartas principais do deck">
        <div className="deck-identity-hero__loadout-head">
          <span>PRIMARY LOADOUT</span>
          <b>{String(featuredRows.length).padStart(2, "0")} LOCKS</b>
        </div>
        <div className="deck-identity-hero__cards">
          {featuredRows.map((row, index) => (
            <button
              type="button"
              key={row.card.cardNumber}
              className="deck-identity-card"
              data-card-color={normalizeDeckColor(row.card.color)}
              onClick={() => onInspect?.(row.card.cardNumber)}
              aria-label={`Inspecionar ${row.card.cardName}`}
            >
              <span className="deck-identity-card__index">0{index + 1}</span>
              <CardArt card={row.card} className="deck-identity-card__art" compact />
              <span className="deck-identity-card__label">
                <small>{row.card.cardNumber} · {row.quantity}X</small>
                <strong>{row.card.cardName}</strong>
              </span>
            </button>
          ))}
        </div>
      </div>

      <dl className="deck-identity-hero__metrics">
        <DeckIdentityMetric label="MAIN DECK" value={stats.mainCount} detail="cartas registradas" />
        <DeckIdentityMetric label="RESULTADO" value={deck.result || "—"} detail={deck.event || "sem evento vinculado"} />
        <DeckIdentityMetric label="CORES" value={colors.length} detail={colors.join(" / ") || "sem identificação"} />
        <DeckIdentityMetric label="ORIGEM" value={savedDeck ? "SALVO" : "PÚBLICO"} detail={deck.author || deck.sourceName || "deck local"} />
      </dl>
    </section>
  );
}

function DeckIdentityMetric({ label, value, detail }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <small>{detail}</small>
    </div>
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
          <td className="deck-row__qty">{row.quantity}x</td>
          <td className="deck-row__number">{row.card.cardNumber}</td>
          <td className="deck-row__name">{row.card.cardName}</td>
          <td className="deck-row__color">{row.card.color}</td>
          <td className="deck-row__type">{row.card.cardType}</td>
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

function selectDeckIdentityRows(rows, deckName, limit = 3) {
  const normalizedDeckName = normalizeIdentityText(deckName);
  return [...rows]
    .map((row) => {
      const normalizedCardName = normalizeIdentityText(row.card.cardName);
      const namedArchetype = normalizedCardName.length >= 6 && normalizedDeckName.includes(normalizedCardName);
      const unitPriority = String(row.card.cardType || "").toUpperCase() === "UNIT";
      const score = (namedArchetype ? 10000 : 0)
        + (unitPriority ? 1000 : 0)
        + (Number(row.quantity || 0) * 100)
        + Number(row.card.recentMetaScore || 0);
      return { ...row, identityScore: score };
    })
    .sort((left, right) => right.identityScore - left.identityScore
      || String(left.card.cardName).localeCompare(String(right.card.cardName)))
    .slice(0, limit);
}

function normalizeIdentityText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function normalizeDeckColor(value) {
  const color = normalizeIdentityText(value);
  if (color.includes("blue") || color.includes("azul")) return "blue";
  if (color.includes("red") || color.includes("vermelh")) return "red";
  if (color.includes("green") || color.includes("verde")) return "green";
  if (color.includes("purple") || color.includes("rox")) return "purple";
  if (color.includes("white") || color.includes("branc")) return "white";
  return "neutral";
}
