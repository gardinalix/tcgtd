import { useMemo } from "react";
import {
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";
import { buildPlainDeckList, sectionCount } from "../domain/deck";

export function ImportExportPage({ data, deck }) {
  const mainMap = useMemo(() => new Map((data.cards || []).map((card) => [card.cardNumber, card])), [data.cards]);
  const resourceMap = useMemo(() => new Map((data.resourceCards || []).map((card) => [card.cardNumber, card])), [data.resourceCards]);
  const mainDeckList = buildPlainDeckList(deck, mainMap, "main");
  const resourceDeckList = buildPlainDeckList(deck, resourceMap, "resource");

  function download(filename, content, mimeType = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <TacticalPageShell className="io-terminal-page">
      <TacticalPageHeader
        eyebrow="I/O"
        title="Deck export"
        subtitle="Export the active deck for external deck tools and tabletop workflows."
      />
      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Main deck" value={sectionCount(deck.main)} />
        <TacticalSummaryCard label="Resource deck" value={sectionCount(deck.resource)} />
        <TacticalSummaryCard label="Export" value={mainDeckList ? "Ready" : "Empty"} tone={mainDeckList ? "green" : "neutral"} />
      </TacticalSummaryStrip>
      <div className="io-terminal-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Main deck list</h2>
            <p>{deck.name || "Active deck"} in plain-text format.</p>
          </div>
          <textarea readOnly value={mainDeckList} />
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Exports</h2>
            <p>Download the active deck sections independently.</p>
          </div>
          <div className="button-row">
            <button type="button" onClick={() => download("main-deck.txt", mainDeckList)}>Main deck</button>
            <button type="button" onClick={() => download("resource-deck.txt", resourceDeckList)}>Resource deck</button>
          </div>
          <textarea readOnly value={resourceDeckList} />
        </section>
      </div>
    </TacticalPageShell>
  );
}
