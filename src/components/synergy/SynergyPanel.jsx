import { useMemo } from "react";
import { TacticalDataPanel, TacticalEmptyState } from "../tactical/TacticalPageShell";
import { getSynergiesForCard } from "../../services/synergyAnalyzer";
import { SynergyCard } from "./SynergyCard";

export function SynergyPanel({
  sourceCard,
  data,
  limit = 5,
  onOpenFull,
  onOpenCard,
  onAddToDeck,
  compact = false,
  title = "Synergy Analysis",
}) {
  const results = useMemo(() => getSynergiesForCard(sourceCard, data, { limit, minScore: 20 }), [sourceCard, data, limit]);

  return (
    <TacticalDataPanel
      title={title}
      subtitle={sourceCard ? `Tactical links generated for ${sourceCard.cardName}.` : "Select a card to run synergy analysis."}
      actions={sourceCard && onOpenFull ? <button type="button" onClick={() => onOpenFull(sourceCard.cardNumber)}>Full analysis</button> : null}
      className={`synergy-panel ${compact ? "synergy-panel--compact" : ""}`.trim()}
    >
      {results.length ? (
        <div className="synergy-list">
          {results.map((result) => (
            <SynergyCard
              key={result.id}
              result={result}
              onOpenCard={onOpenCard}
              onAddToDeck={onAddToDeck}
              compact={compact}
            />
          ))}
        </div>
      ) : (
        <TacticalEmptyState title="No synergy detected" detail="The current algorithm did not find a score above the visibility threshold." />
      )}
    </TacticalDataPanel>
  );
}
