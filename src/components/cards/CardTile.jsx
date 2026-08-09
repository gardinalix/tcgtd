import { effectiveBrlPrice, formatBrl, formatUsd, getMetaSignal } from "../../domain/cards";
import { Badge } from "./Badge";
import { CardArt } from "./CardArt";
import { PriceTag } from "./PriceTag";

export function CardTile({ card, onSelect, onOpenSynergyMap }) {
  const signal = getMetaSignal(card);
  const priceBrl = effectiveBrlPrice(card);
  const priceLabel = Number.isFinite(Number(priceBrl)) ? formatBrl(priceBrl) : formatUsd(card.marketPriceUsd);
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
          <strong>{priceLabel}</strong>
        </span>
      </button>
      <div className="library-card__body">
        <span className="card-gallery-tile__number">{card.displayCardNumber || card.cardNumber}</span>
        <h3>{card.cardName}</h3>
        <p>{[card.color, card.cardType, card.rarity].filter(Boolean).join(" / ")}</p>
        <div className="badge-row card-gallery-tile__signals">
          <Badge tone={signal.tone}>{signal.label}</Badge>
          {card.hasAltArt ? <Badge tone="purple">Alt art</Badge> : null}
        </div>
        <div className="card-gallery-tile__market-detail"><PriceTag card={card} /></div>
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
