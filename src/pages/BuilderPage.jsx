import { useMemo, useState } from "react";
import { CardArt } from "../components/cards/CardArt";
import { PriceTag } from "../components/cards/PriceTag";
import { DeckBuilderSynergyPanel } from "../components/synergy/DeckBuilderSynergyPanel";
import {
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";
import { changeDeckQuantity, getDeckIssues, sectionCount, buildDeckRows, buildPlainDeckList } from "../domain/deck";
import { parseDeckList } from "../domain/deckLibrary";
import { filterCards } from "../utils/cardFilters";

export function BuilderPage({ data, deck, setDeck, onOpenSynergy }) {
  const [libraryMode, setLibraryMode] = useState("main");
  const [search, setSearch] = useState("");
  const [importText, setImportText] = useState("");
  const [selectedCardNumber, setSelectedCardNumber] = useState("");
  const mainCards = data.cards || [];
  const resourceCards = data.resourceCards || [];
  const cards = libraryMode === "resource" ? resourceCards : mainCards;
  const visibleCards = useMemo(() => filterCards(cards, { search, color: "Any", type: "Any", rarity: "Any", set: "Any", cost: "", trait: "" }).slice(0, 80), [cards, search]);
  const mainMap = useMemo(() => new Map(mainCards.map((card) => [card.cardNumber, card])), [mainCards]);
  const resourceMap = useMemo(() => new Map(resourceCards.map((card) => [card.cardNumber, card])), [resourceCards]);
  const issues = getDeckIssues(deck, data.rules || {}, mainMap);
  const selectedCard = [...mainCards, ...resourceCards].find((card) => card.cardNumber === selectedCardNumber) || visibleCards[0] || null;

  function add(card) {
    setSelectedCardNumber(card.cardNumber);
    const section = libraryMode === "resource" ? "resource" : "main";
    const max = section === "resource" ? 99 : Number(card.copyLimit || data.rules?.defaultCopyLimit || 4);
    setDeck((current) => changeDeckQuantity(current, section, card.cardNumber, 1, max));
  }

  function addMainCard(card) {
    setSelectedCardNumber(card.cardNumber);
    const max = Number(card.copyLimit || data.rules?.defaultCopyLimit || 4);
    setDeck((current) => changeDeckQuantity(current, "main", card.cardNumber, 1, max));
  }

  function remove(section, cardNumber) {
    setDeck((current) => changeDeckQuantity(current, section, cardNumber, -1, 99));
  }

  function updateDeckMeta(patch) {
    setDeck((current) => ({ ...current, ...patch }));
  }

  function importDeckList() {
    const parsed = parseDeckList(importText);
    setDeck((current) => ({ ...current, main: parsed.main, resource: parsed.resource }));
  }

  return (
    <TacticalPageShell className="react-builder-page builder-terminal-page">
      <TacticalPageHeader
        eyebrow="Deck ops"
        title="Deck builder"
        subtitle="Assemble, validate, import and export deck shells from the tactical database."
        actions={(
          <div className="button-row">
          <input value={deck.name} onChange={(event) => updateDeckMeta({ name: event.target.value })} aria-label="Deck name" />
          <select value={deck.visibility || "private"} onChange={(event) => updateDeckMeta({ visibility: event.target.value })}>
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
          <input value={deck.archetype || ""} placeholder="Archetype" onChange={(event) => updateDeckMeta({ archetype: event.target.value })} />
          </div>
        )}
      />
      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Main deck" value={`${sectionCount(deck.main)} / ${data.rules?.mainDeckSize || 50}`} detail={issues.length ? "Validation warnings active." : "Size check ready."} tone={issues.length ? "red" : "green"} />
        <TacticalSummaryCard label="Resource" value={`${sectionCount(deck.resource)} / ${data.rules?.resourceDeckSize || 10}`} detail="Resource deck counter." />
        <TacticalSummaryCard label="Library mode" value={libraryMode} detail={`${visibleCards.length} candidates visible.`} tone="blue" />
      </TacticalSummaryStrip>
      <div className="builder-terminal-grid">
        <aside className="panel filter-panel">
          <div className="panel-head">
            <h2>Library</h2>
            <p>Add units into the active deck shell.</p>
          </div>
          <div className="button-row">
            <button type="button" className={libraryMode === "main" ? "is-active" : ""} onClick={() => setLibraryMode("main")}>Main</button>
            <button type="button" className={libraryMode === "resource" ? "is-active" : ""} onClick={() => setLibraryMode("resource")}>Resource</button>
          </div>
          <input value={search} placeholder="Search library..." onChange={(event) => setSearch(event.target.value)} />
          <div className="react-builder-library">
            {visibleCards.map((card) => (
              <button
                key={card.cardNumber}
                type="button"
                className={`react-builder-card ${selectedCard?.cardNumber === card.cardNumber ? "is-selected" : ""}`.trim()}
                onMouseEnter={() => setSelectedCardNumber(card.cardNumber)}
                onFocus={() => setSelectedCardNumber(card.cardNumber)}
                onClick={() => add(card)}
              >
                <CardArt card={card} className="art-frame art-frame--mini" compact />
                <span>{card.cardNumber}</span>
                <strong>{card.cardName}</strong>
                <PriceTag card={card} />
              </button>
            ))}
          </div>
        </aside>
        <section className="panel react-deck-panel">
          <div className="panel-head">
            <h2>{deck.name}</h2>
            <p>{issues.length ? issues.join(" ") : "Deck shell is legal by current size/color checks."}</p>
          </div>
          <DeckSection title="Main deck" rows={buildDeckRows(deck, "main", mainMap)} onInspect={setSelectedCardNumber} onRemove={(cardNumber) => remove("main", cardNumber)} />
          <DeckSection title="Resource deck" rows={buildDeckRows(deck, "resource", resourceMap)} onInspect={setSelectedCardNumber} onRemove={(cardNumber) => remove("resource", cardNumber)} />
          <textarea readOnly value={buildPlainDeckList(deck, mainMap, "main")} />
          <div className="panel-subsection">
            <h3>Import list</h3>
            <p>Accepts formats like 4x GD01-086 or 4xGD01-086. Add a RESOURCE line before resource cards.</p>
            <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={"4x GD01-086\n3xST04-010"} />
            <button type="button" onClick={importDeckList}>Import into current deck</button>
          </div>
        </section>
        <DeckBuilderSynergyPanel
          selectedCard={selectedCard}
          data={data}
          onAddCard={addMainCard}
          onOpenSynergy={onOpenSynergy}
        />
      </div>
    </TacticalPageShell>
  );
}

function DeckSection({ title, rows, onInspect, onRemove }) {
  return (
    <section className="deck-section">
      <h3>{title}</h3>
      {rows.map((row) => (
        <div
          key={row.card.cardNumber}
          className="deck-row"
          tabIndex={0}
          onMouseEnter={() => onInspect?.(row.card.cardNumber)}
          onFocus={() => onInspect?.(row.card.cardNumber)}
        >
          <span>{row.quantity}x</span>
          <strong>{row.card.cardNumber}</strong>
          <span>{row.card.cardName}</span>
          <button type="button" onClick={() => onRemove(row.card.cardNumber)}>-</button>
        </div>
      ))}
    </section>
  );
}
