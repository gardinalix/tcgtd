import { CardDetail } from "../components/cards/CardDetail";
import { SynergyPanel } from "../components/synergy/SynergyPanel";
import {
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";

export function CardPage({ data, cardId, onBack, onOpenCard, onOpenSynergy, onOpenSynergyMap }) {
  const cards = [...(data.cards || []), ...(data.resourceCards || [])];
  const card = cards.find((row) => row.cardNumber === cardId || row.detailSearchId === cardId);

  return (
    <TacticalPageShell className="card-dossier-page">
      <TacticalPageHeader
        eyebrow="Card dossier"
        title={card?.cardName || "Card not found"}
        subtitle={card ? `${card.cardNumber} / ${card.color} / ${card.cardType}` : "No card matched this id."}
        onBack={onBack}
        backLabel="Back to cards"
      />
      {card ? (
        <TacticalSummaryStrip>
          <TacticalSummaryCard label="Number" value={card.cardNumber} />
          <TacticalSummaryCard label="Color" value={card.color || "-"} />
          <TacticalSummaryCard label="Type" value={card.cardType || "-"} />
          <TacticalSummaryCard label="Rarity" value={card.rarity || "-"} tone="gold" />
        </TacticalSummaryStrip>
      ) : null}
      {card ? (
        <CardDetail
          card={card}
          onOpenCard={onOpenCard}
          onOpenSynergyMap={onOpenSynergyMap}
        />
      ) : null}
      {card ? (
        <SynergyPanel
          sourceCard={card}
          data={data}
          limit={5}
          onOpenCard={onOpenCard}
          onOpenFull={onOpenSynergy}
        />
      ) : null}
    </TacticalPageShell>
  );
}
