import { useState } from "react";
import { createPortal } from "react-dom";
import { CardArt } from "../cards/CardArt";
import { PriceTag } from "../cards/PriceTag";
import { getMetaSignal } from "../../domain/cards";
import { SynergyExplanation } from "./SynergyExplanation";
import { SynergyRankBadge, SynergyTypeBadge } from "./SynergyBadges";

export function SynergyCard({
  result,
  onOpenCard,
  onAddToDeck,
  onCompare,
  compact = false,
}) {
  const card = result.targetCard;
  const metaSignal = getMetaSignal(card);
  const [previewPosition, setPreviewPosition] = useState(null);

  function updatePreviewPosition(event) {
    if (typeof window === "undefined") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const previewWidth = Math.min(compact ? 238 : 280, window.innerWidth - 28);
    const previewHeight = previewWidth * 1.45 + 66;
    const cursorX = Number.isFinite(event.clientX) && event.clientX > 0 ? event.clientX : rect.right;
    const cursorY = Number.isFinite(event.clientY) && event.clientY > 0 ? event.clientY : rect.top + rect.height / 2;
    const margin = 14;
    const placeRight = cursorX + previewWidth + 28 < window.innerWidth;
    const rawLeft = placeRight ? cursorX + 18 : cursorX - previewWidth - 18;
    const left = Math.min(window.innerWidth - previewWidth - margin, Math.max(margin, rawLeft));
    const top = Math.min(window.innerHeight - previewHeight - margin, Math.max(margin, cursorY - previewHeight / 2));
    setPreviewPosition({ left, top, width: previewWidth });
  }

  function hidePreview(event) {
    if (event?.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
    setPreviewPosition(null);
  }

  return (
    <article
      className={`synergy-card synergy-card--${result.rank} ${compact ? "synergy-card--compact" : ""}`.trim()}
      onMouseEnter={updatePreviewPosition}
      onMouseMove={updatePreviewPosition}
      onMouseLeave={() => setPreviewPosition(null)}
      onFocus={updatePreviewPosition}
      onBlur={hidePreview}
    >
      <CardArt card={card} className="art-frame art-frame--mini synergy-card__art" compact />
      <div className="synergy-card__body">
        <div className="synergy-card__title">
          <span>{card.cardNumber}</span>
          <button type="button" className="inline-link-button" onClick={() => onOpenCard?.(card.cardNumber)}>
            {card.cardName}
          </button>
        </div>
        <div className="synergy-card__badges">
          <SynergyRankBadge rank={result.rank} score={result.score} />
          <span className={`synergy-meta-badge synergy-meta-badge--${metaSignal.value}`}>{metaSignal.label}</span>
        </div>
        <div className="synergy-card__types">
          {result.synergyTypes.slice(0, compact ? 3 : 6).map((type) => (
            <SynergyTypeBadge key={type}>{type}</SynergyTypeBadge>
          ))}
        </div>
        {!compact ? <SynergyExplanation result={result} /> : null}
        <div className="synergy-card__footer">
          <PriceTag card={card} />
          <div className="button-row">
            {onAddToDeck ? <button type="button" onClick={() => onAddToDeck(card)}>Add</button> : null}
            {onCompare ? <button type="button" onClick={() => onCompare(result)}>Compare</button> : null}
          </div>
        </div>
      </div>
      {previewPosition && typeof document !== "undefined" ? createPortal(
        <div
          className={`synergy-card-hover-preview synergy-card-hover-preview--${result.rank}`.trim()}
          style={{ left: previewPosition.left, top: previewPosition.top, width: previewPosition.width }}
          aria-hidden="true"
        >
          <CardArt card={card} className="art-frame synergy-card-hover-preview__art" />
          <div className="synergy-card-hover-preview__meta">
            <span>{card.cardNumber}</span>
            <strong>{card.cardName}</strong>
            <em>{result.rank} synergy · {result.score}</em>
          </div>
        </div>,
        document.body,
      ) : null}
    </article>
  );
}
