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
import { buildMetaSignal } from "../domain/meta";

export function MetaPage({ data }) {
  const signal = useMemo(() => buildMetaSignal(data.cards || [], data.archetypes || []), [data]);
  const cardMap = useMemo(() => new Map((data.cards || []).map((card) => [card.cardNumber, card])), [data.cards]);

  return (
    <TacticalPageShell className="meta-terminal-page">
      <TacticalPageHeader
        eyebrow="Meta Signal Monitoring"
        title="Meta signal"
        subtitle="Movement bands calculated from recent Top 16 appearances, recurrence and archetype momentum."
      />

      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Ranked cards" value={signal.ranked.length} detail="Cards with calculated signal." tone="blue" />
        <TacticalSummaryCard label="Risers" value={signal.risers.length} detail="Positive tactical movement." tone="green" />
        <TacticalSummaryCard label="Fallers" value={signal.fallers.length} detail="Negative tactical movement." tone="red" />
        <TacticalSummaryCard label="Watch list" value={signal.watch.length} detail="Cards under observation." tone="gold" />
      </TacticalSummaryStrip>

      <div className="tactical-card-grid">
        <MetaPanel title="Recent movements" rows={signal.risers} valueKey="band" cardMap={cardMap} />
        <MetaPanel title="Largest drops" rows={signal.fallers} valueKey="delta" cardMap={cardMap} />
        <MetaPanel title="Cards under watch" rows={signal.watch} valueKey="recent" cardMap={cardMap} />
        <TacticalDataPanel title="Trending archetypes" subtitle="Recent meta score by archetype.">
          <div className="cockpit-list">
            {signal.archetypeTrends.map((row) => (
              <span key={row.archetype} className="cockpit-list-row">
                <strong>{row.archetype}</strong>
                <span>{row.recentMetaScore}</span>
              </span>
            ))}
          </div>
        </TacticalDataPanel>
      </div>

      <TacticalDataPanel title="Meta signal current" subtitle={`${signal.ranked.length} cards classified.`}>
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

function MetaPanel({ title, rows, valueKey, cardMap }) {
  return (
    <TacticalDataPanel title={title} subtitle="Latest tactical signal.">
      <div className="cockpit-list">
        {rows.map((row) => (
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
