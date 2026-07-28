import { getMetaSignal } from "../../domain/cards";
import { Badge } from "./Badge";
import { CardArt } from "./CardArt";
import { PriceTag } from "./PriceTag";

export function CardTile({ card, onSelect, onOpenSynergyMap }) {
  const signal = getMetaSignal(card);
  function selectCard() {
    onSelect?.(card.displayId || card.cardNumber);
  }

  return (
    <article className="library-card react-card-tile" onClick={selectCard}>
      <button
        type="button"
        className="library-card__select"
        onClick={(event) => {
          event.stopPropagation();
          selectCard();
        }}
      >
        <CardArt card={card} className="art-frame" compact />
      </button>
      <div className="library-card__body">
        <span>{card.displayCardNumber || card.cardNumber}</span>
        <h3>{card.cardName}</h3>
        <p>{[card.color, card.cardType, card.rarity].filter(Boolean).join(" / ")}</p>
        <div className="badge-row">
          <Badge tone={signal.tone}>{signal.label}</Badge>
          {card.hasAltArt ? <Badge tone="purple">Alt art</Badge> : null}
        </div>
        <PriceTag card={card} />
        {onOpenSynergyMap ? (
          <button
            type="button"
            className="card-map-button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSynergyMap(card.cardNumber);
            }}
          >
            Synergy map
          </button>
        ) : null}
      </div>
    </article>
  );
}
