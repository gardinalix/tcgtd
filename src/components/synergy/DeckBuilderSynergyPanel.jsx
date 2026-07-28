import { SynergyPanel } from "./SynergyPanel";

export function DeckBuilderSynergyPanel({ selectedCard, data, onAddCard, onOpenSynergy }) {
  return (
    <SynergyPanel
      sourceCard={selectedCard}
      data={data}
      limit={5}
      compact
      title="Synergy Suggestions"
      onAddToDeck={onAddCard}
      onOpenFull={onOpenSynergy}
    />
  );
}
