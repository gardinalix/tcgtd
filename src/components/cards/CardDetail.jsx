import { getMetaSignal } from "../../domain/cards";
import { Badge } from "./Badge";
import { CardArt } from "./CardArt";
import { PartnerOffer } from "./PartnerOffer";
import { PriceTag } from "./PriceTag";

export function CardDetail({ card, onOpenCard, onOpenSynergyMap }) {
  if (!card) {
    return (
      <aside className="panel react-card-detail">
        <p>Select a card to inspect tactical data.</p>
      </aside>
    );
  }

  const signal = getMetaSignal(card);
  const cardText = card.effectPreview || card.effectText || card.cardText || card.text || "";

  return (
    <aside className="panel react-card-detail">
      <div className="react-card-detail__media">
        <CardArt card={card} className="art-frame art-frame--detail" />
      </div>
      <div className="react-card-detail__body">
        <span className="eyebrow">{card.displayCardNumber || card.cardNumber}</span>
        <h2>{card.cardName}</h2>
        <div className="button-row card-detail-actions">
          {onOpenCard ? <button type="button" onClick={() => onOpenCard(card.cardNumber)}>Open dossier page</button> : null}
          {onOpenSynergyMap ? <button type="button" onClick={() => onOpenSynergyMap(card.cardNumber)}>Synergy map</button> : null}
        </div>
        <div className="badge-row">
          <Badge tone={signal.tone}>{signal.label}</Badge>
          <Badge tone="blue">{card.cardType}</Badge>
          {card.hasAltArt ? <Badge tone="purple">Alt art</Badge> : null}
        </div>
        <PriceTag card={card} compact />
        <PartnerOffer card={card} />
        <dl className="detail-grid">
          <div><dt>Color</dt><dd>{card.color}</dd></div>
          <div><dt>Rarity</dt><dd>{card.rarity || "-"}</dd></div>
          <div><dt>Cost</dt><dd>{card.cost || "-"}</dd></div>
          <div><dt>Level</dt><dd>{card.level || "-"}</dd></div>
          <div><dt>AP / HP</dt><dd>{card.ap || "-"} / {card.hp || "-"}</dd></div>
        </dl>
        <DetailTagList label="LINK / PAIR" values={card.linkTargets || []} empty="No printed link loaded." />
        <DetailTagList label="Traits" values={card.traits || []} empty="No traits loaded." />
        <section className="card-text-panel">
          <span>Card text</span>
          <p>{cardText && cardText !== "-" ? cardText : "No text loaded."}</p>
        </section>
        <small>{signal.reason}</small>
      </div>
    </aside>
  );
}

function DetailTagList({ label, values = [], empty }) {
  return (
    <section className="card-detail-tags">
      <span>{label}</span>
      {values.length ? (
        <div className="card-detail-tags__list">
          {values.map((value) => <Badge key={value} tone="blue">{value}</Badge>)}
        </div>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}
