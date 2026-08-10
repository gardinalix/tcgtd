import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CardArt } from "../components/cards/CardArt";
import {
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
  TacticalTable,
} from "../components/tactical/TacticalPageShell";
import { buildMetaWindows, buildScopedMetaSignal } from "../domain/meta";

export function MetaPage({ data, selectedMetaId = "current", onMetaChange, onOpenForge }) {
  const metaWindows = useMemo(() => buildMetaWindows(data), [data]);
  const selectedWindow = metaWindows.find((window) => window.id === selectedMetaId) || metaWindows[0];
  const signal = useMemo(() => buildScopedMetaSignal(data, selectedWindow), [data, selectedWindow]);
  const cardMap = useMemo(() => new Map((data.cards || []).map((card) => [card.cardNumber, card])), [data.cards]);

  return (
    <TacticalPageShell className="meta-terminal-page">
      <TacticalPageHeader
        eyebrow="SUBSYSTEM 03 // FIELD MONITORING"
        title="Battlefield Intelligence"
        subtitle={`Movement calculated only from ${selectedWindow?.label || "the selected competitive window"}. Cards without an indexed list in this scope are excluded.`}
        actions={(
          <label className="meta-window-selector">
            <span>Meta / format</span>
            <select value={selectedWindow?.id || selectedMetaId} onChange={(event) => onMetaChange?.(event.target.value)}>
              {metaWindows.map((window) => <option key={window.id} value={window.id}>{window.label}</option>)}
            </select>
          </label>
        )}
      />

      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Meta window" value={selectedWindow?.shortLabel || "-"} detail={`${signal.context.deckCount} indexed decklists · ${signal.context.eventCount} events.`} tone="blue" />
        <TacticalSummaryCard label="Used cards" value={signal.ranked.length} detail="Cards present in this exact scope." />
        <TacticalSummaryCard label="Risers" value={signal.risers.length} detail="Positive tactical movement." tone="green" />
        <TacticalSummaryCard label="Fallers" value={signal.fallers.length} detail="Negative tactical movement." tone="red" />
        <TacticalSummaryCard label="Watch list" value={signal.watch.length} detail="Cards under observation." tone="gold" />
      </TacticalSummaryStrip>

      <div className="tactical-card-grid meta-field-matrix">
        <TacticalDataPanel className="meta-archetype-station" title="Trending archetypes" subtitle={`${signal.context.deckCount} lists inside ${selectedWindow?.label || "the selected window"}.`} code="ARC/RAD" mode="radar">
          <div className="cockpit-list meta-archetype-links">
            {signal.archetypeTrends.map((row) => (
              <button
                key={row.archetype}
                type="button"
                className="cockpit-list-row meta-archetype-link"
                onClick={() => onOpenForge?.({ ...row, selectedMetaId: selectedWindow?.id, metaLabel: selectedWindow?.label })}
              >
                <span><strong>{row.archetype}</strong><small>{row.recentDecklists} lists · {row.commonColorCombination || "colors unclassified"}</small></span>
                <b>{row.recentMetaScore.toFixed(1)}%</b>
                <em>FORGE →</em>
              </button>
            ))}
          </div>
        </TacticalDataPanel>
        <MetaPanel className="meta-signal-station meta-signal-station--risers" title="Recent movements" rows={signal.risers} valueKey="band" cardMap={cardMap} />
        <MetaPanel className="meta-signal-station meta-signal-station--fallers" title="Largest drops" rows={signal.fallers} valueKey="delta" cardMap={cardMap} />
        <MetaPanel className="meta-signal-station meta-signal-station--watch" title="Cards under watch" rows={signal.watch} valueKey="recent" cardMap={cardMap} />
      </div>

      <TacticalDataPanel title={`Meta signal · ${selectedWindow?.shortLabel || "scope"}`} subtitle={`${signal.ranked.length} cards actually used in ${signal.context.deckCount} indexed lists.`} code="SIG/DB" mode="matrix">
        <TacticalTable
          columns={["Card", "Color", "Band", "Recent tops", "Movement", "Reason"]}
          rows={signal.ranked.slice(0, 80)}
          renderRow={(row) => (
            <MetaSignalTableRow key={row.cardNumber} row={row} card={cardMap.get(row.cardNumber)} />
          )}
        />
      </TacticalDataPanel>
    </TacticalPageShell>
  );
}

function MetaPanel({ className, title, rows, valueKey, cardMap }) {
  const visibleRows = rows.slice(0, 6);

  return (
    <TacticalDataPanel className={className} title={title} subtitle={`${visibleRows.length} priority signals · complete readout below.`}>
      <div className="cockpit-list">
        {visibleRows.map((row) => (
          <MetaSignalListRow
            key={row.cardNumber}
            row={row}
            card={cardMap.get(row.cardNumber)}
            value={valueKey === "delta" ? row.delta.toFixed(1) : row[valueKey]}
          />
        ))}
      </div>
    </TacticalDataPanel>
  );
}

function MetaSignalTableRow({ row, card }) {
  const hover = useCardHoverPreview(card, row);

  return (
    <tr
      className="meta-signal-hover-row"
      tabIndex={card ? 0 : undefined}
      onMouseEnter={hover.update}
      onMouseMove={hover.update}
      onMouseLeave={hover.hide}
      onFocus={hover.update}
      onBlur={hover.hide}
    >
      <td>{row.cardNumber} {row.cardName}</td>
      <td>{row.color}</td>
      <td>{row.band}</td>
      <td>{row.recent}</td>
      <td>{row.delta.toFixed(1)}</td>
      <td>{row.reason}</td>
      <MetaSignalHoverPreview card={card} row={row} position={hover.position} />
    </tr>
  );
}

function MetaSignalListRow({ row, card, value }) {
  const hover = useCardHoverPreview(card, row, true);

  return (
    <span
      className="cockpit-list-row meta-signal-hover-row meta-signal-hover-row--compact"
      tabIndex={card ? 0 : undefined}
      onMouseEnter={hover.update}
      onMouseMove={hover.update}
      onMouseLeave={hover.hide}
      onFocus={hover.update}
      onBlur={hover.hide}
    >
      <strong>{row.cardName}</strong>
      <span>{value}</span>
      <MetaSignalHoverPreview card={card} row={row} position={hover.position} compact />
    </span>
  );
}

function useCardHoverPreview(card, row, compact = false) {
  const [position, setPosition] = useState(null);

  function update(event) {
    if (!card || typeof window === "undefined") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const previewWidth = Math.min(compact ? 224 : 270, window.innerWidth - 28);
    const previewHeight = previewWidth * 1.45 + 74;
    const cursorX = Number.isFinite(event.clientX) && event.clientX > 0 ? event.clientX : rect.right;
    const cursorY = Number.isFinite(event.clientY) && event.clientY > 0 ? event.clientY : rect.top + rect.height / 2;
    const margin = 14;
    const placeRight = cursorX + previewWidth + 24 < window.innerWidth;
    const rawLeft = placeRight ? cursorX + 16 : cursorX - previewWidth - 16;
    const left = Math.min(window.innerWidth - previewWidth - margin, Math.max(margin, rawLeft));
    const top = Math.min(window.innerHeight - previewHeight - margin, Math.max(margin, cursorY - previewHeight / 2));
    const direction = row.movementDirection || (Number(row.delta) >= 0 ? "up" : "down");
    setPosition({ left, top, width: previewWidth, direction });
  }

  function hide() {
    setPosition(null);
  }

  return { position, update, hide };
}

function MetaSignalHoverPreview({ card, row, position, compact = false }) {
  if (!card || !position || typeof document === "undefined") return null;
  const direction = position.direction === "down" ? "down" : position.direction === "flat" ? "flat" : "up";

  return createPortal(
    <div
      className={`meta-signal-card-preview meta-signal-card-preview--${direction} ${compact ? "meta-signal-card-preview--compact" : ""}`.trim()}
      style={{ left: position.left, top: position.top, width: position.width }}
      aria-hidden="true"
    >
      <CardArt card={card} className="art-frame meta-signal-card-preview__art" />
      <div className="meta-signal-card-preview__meta">
        <span>{card.cardNumber}</span>
        <strong>{card.cardName}</strong>
        <em>{row.previousBand || "Untracked"} → {row.band}</em>
      </div>
    </div>,
    document.body,
  );
}
