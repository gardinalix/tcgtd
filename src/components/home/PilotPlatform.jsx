import { CardArt } from "../cards/CardArt";

export function PilotPlatform({ card }) {
  return (
    <div className="cockpit-card-platform">
      <div className="platform-ring" aria-hidden="true" />
      <div className="hero-feature">
        {card ? (
          <article className="feature-card cockpit-feature-card">
            <span className="cockpit-feature-card__halo" aria-hidden="true" />
            <div className="cockpit-feature-card__art">
              <CardArt card={card} className="art-frame art-frame--detail" />
            </div>
            <div className="cockpit-feature-card__body">
              <span className="eyebrow">Synchronized pilot</span>
              <h2>{card.cardName}</h2>
              <p>
                {card.displayCardNumber || card.cardNumber} / {card.color} / {card.cardType}
              </p>
            </div>
          </article>
        ) : (
          <div className="empty-state">No pilot card loaded.</div>
        )}
      </div>
    </div>
  );
}
