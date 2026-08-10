import { CardArt } from "./CardArt";
import { MarketPriceBadge } from "./PriceTag";

export function CardTile({ card, onSelect, onOpenSynergyMap }) {
  function selectCard() {
    onSelect?.(card.displayId || card.cardNumber);
  }

  return (
    <article className="library-card react-card-tile card-gallery-tile" onClick={selectCard}>
      <button
        type="button"
        className="library-card__select"
        onClick={(event) => {
          event.stopPropagation();
          selectCard();
        }}
      >
        <CardArt card={card} className="art-frame" compact />
        <span className="card-gallery-tile__badges">
          {card.hasAltArt ? <b>ALT</b> : card.rarity ? <b>{card.rarity}</b> : null}
        </span>
        <MarketPriceBadge card={card} />
      </button>
      <div className="library-card__body">
        <span className="card-gallery-tile__number">{card.displayCardNumber || card.cardNumber}</span>
        <h3>{card.cardName}</h3>
        <p>{[card.color, card.cardType, card.rarity].filter(Boolean).join(" / ")}</p>
        {onOpenSynergyMap ? (
          <button
            type="button"
            className="card-map-button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSynergyMap(card.cardNumber);
            }}
          >
            MAP
          </button>
        ) : null}
      </div>
    </article>
  );
}
