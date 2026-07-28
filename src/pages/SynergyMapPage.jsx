import { useMemo } from "react";
import { CardArt } from "../components/cards/CardArt";
import {
  TacticalActionButton,
  TacticalDataPanel,
  TacticalEmptyState,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";
import { SynergyRankBadge, SynergyTypeBadge } from "../components/synergy/SynergyBadges";
import { getMetaSignal } from "../domain/cards";
import { getSynergiesForCard } from "../services/synergyAnalyzer";

const NODE_POSITIONS = [
  { x: 50, y: 8 },
  { x: 72, y: 14 },
  { x: 86, y: 34 },
  { x: 82, y: 62 },
  { x: 64, y: 82 },
  { x: 37, y: 84 },
  { x: 17, y: 65 },
  { x: 13, y: 38 },
  { x: 26, y: 16 },
  { x: 50, y: 92 },
  { x: 91, y: 48 },
  { x: 9, y: 51 },
];

const RELATION_GROUPS = [
  { id: "direct", label: "LINK / PAIR", detail: "Explicit link, pair, pilot or unit compatibility." },
  { id: "mechanic", label: "Mechanic setup", detail: "Trigger, timing, command, protection, draw or removal bridge." },
  { id: "archetype", label: "Deck archetype", detail: "Shared archetype or competitive deck co-occurrence." },
  { id: "support", label: "Support shell", detail: "Trait, keyword, color or curve support." },
];

export function SynergyMapPage({ data, cardId, onBack, onOpenCard, onOpenSynergy }) {
  const allCards = [...(data.cards || []), ...(data.resourceCards || [])];
  const sourceCard = allCards.find((card) => card.cardNumber === cardId || card.detailSearchId === cardId);
  const results = useMemo(() => getSynergiesForCard(sourceCard, data, { minScore: 20 }), [sourceCard, data]);
  const mapResults = results.slice(0, NODE_POSITIONS.length);
  const groups = useMemo(() => buildRelationGroups(results), [results]);
  const archetypeFits = useMemo(() => buildArchetypeFits(sourceCard, results, data), [sourceCard, results, data]);
  const sourceSignal = sourceCard ? getMetaSignal(sourceCard) : null;

  return (
    <TacticalPageShell className="synergy-map-page">
      <TacticalPageHeader
        eyebrow="Synergy map"
        title={sourceCard ? `${sourceCard.cardName} relation schematic` : "Card not found"}
        subtitle={sourceCard ? `${sourceCard.cardNumber} / ${sourceCard.color} / ${sourceCard.cardType}` : "No source card matched this id."}
        onBack={onBack}
        backLabel="Back to card"
        actions={sourceCard ? (
          <div className="button-row">
            <TacticalActionButton onClick={() => onOpenSynergy?.(sourceCard.cardNumber)}>Full analysis</TacticalActionButton>
            <TacticalActionButton onClick={() => onOpenCard?.(sourceCard.cardNumber)}>Card dossier</TacticalActionButton>
          </div>
        ) : null}
      />

      {sourceCard ? (
        <TacticalSummaryStrip>
          <TacticalSummaryCard label="Relations" value={results.length} detail="Cards above visible threshold." tone="blue" />
          <TacticalSummaryCard label="High" value={results.filter((item) => item.rank === "high").length} detail="Highest confidence links." tone="green" />
          <TacticalSummaryCard label="Archetype fits" value={archetypeFits.length} detail="Observed deck shells." tone="gold" />
          <TacticalSummaryCard label="Meta signal" value={sourceSignal?.label || "-"} detail={sourceSignal?.reason || ""} tone={sourceSignal?.tone || "neutral"} />
        </TacticalSummaryStrip>
      ) : null}

      {sourceCard ? (
        <div className="synergy-map-layout">
          <TacticalDataPanel
            title="Visual schematic"
            subtitle="Central card signal with surrounding tactical relations."
            className="synergy-map-canvas-panel"
          >
            {mapResults.length ? (
              <div className="synergy-map-canvas" aria-label={`${sourceCard.cardName} synergy map`}>
                <svg className="synergy-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {mapResults.map((result, index) => {
                    const position = NODE_POSITIONS[index];
                    return (
                      <line
                        key={result.id}
                        x1="50"
                        y1="50"
                        x2={position.x}
                        y2={position.y}
                        className={`synergy-map-line synergy-map-line--${result.rank}`}
                      />
                    );
                  })}
                </svg>

                <div className="synergy-map-core">
                  <span className="synergy-map-core__ring" />
                  <CardArt card={sourceCard} className="art-frame synergy-map-core__art" compact />
                  <strong>{sourceCard.cardName}</strong>
                  <em>{sourceCard.cardNumber}</em>
                </div>

                {mapResults.map((result, index) => {
                  const position = NODE_POSITIONS[index];
                  return (
                    <button
                      type="button"
                      key={result.id}
                      className={`synergy-map-node synergy-map-node--${result.rank}`}
                      style={{ left: `${position.x}%`, top: `${position.y}%` }}
                      onClick={() => onOpenCard?.(result.targetCard.cardNumber)}
                    >
                      <CardArt card={result.targetCard} className="art-frame synergy-map-node__art" compact />
                      <span>
                        <strong>{result.targetCard.cardName}</strong>
                        <em>{result.targetCard.cardNumber}</em>
                      </span>
                      <SynergyRankBadge rank={result.rank} score={result.score} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <TacticalEmptyState title="No visible relations" detail="This card has no synergy score above the current threshold yet." />
            )}
          </TacticalDataPanel>

          <aside className="synergy-map-side">
            <TacticalDataPanel title="Relation clusters" subtitle="How the map is grouped.">
              <div className="synergy-map-cluster-list">
                {groups.map((group) => (
                  <button
                    type="button"
                    key={group.id}
                    className="synergy-map-cluster-row"
                    onClick={() => group.topCard && onOpenCard?.(group.topCard.cardNumber)}
                  >
                    <span>
                      <strong>{group.label}</strong>
                      <small>{group.detail}</small>
                    </span>
                    <em>{group.count}</em>
                  </button>
                ))}
              </div>
            </TacticalDataPanel>

            <TacticalDataPanel title="Deck archetype fit" subtitle="Observed shells from imported deck/event data.">
              {archetypeFits.length ? (
                <div className="synergy-map-archetypes">
                  {archetypeFits.map((item) => (
                    <article key={item.label}>
                      <strong>{item.label}</strong>
                      <span>{item.count} signal(s)</span>
                      <p>{item.reason}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <TacticalEmptyState title="No archetype lock" detail="No confirmed deck shell was found in normalized event data yet." />
              )}
            </TacticalDataPanel>

            <TacticalDataPanel title="Top relation evidence" subtitle="Most actionable explanations.">
              <div className="synergy-map-evidence">
                {results.slice(0, 5).map((result) => (
                  <article key={result.id}>
                    <div>
                      <strong>{result.targetCard.cardName}</strong>
                      <SynergyRankBadge rank={result.rank} score={result.score} />
                    </div>
                    <p>{result.explanation}</p>
                    <div className="synergy-card__types">
                      {result.synergyTypes.slice(0, 4).map((type) => <SynergyTypeBadge key={type}>{type}</SynergyTypeBadge>)}
                    </div>
                  </article>
                ))}
              </div>
            </TacticalDataPanel>
          </aside>
        </div>
      ) : null}
    </TacticalPageShell>
  );
}

function buildRelationGroups(results) {
  return RELATION_GROUPS.map((definition) => {
    const matches = results.filter((result) => relationGroupId(result) === definition.id);
    return {
      ...definition,
      count: matches.length,
      topCard: matches[0]?.targetCard,
    };
  });
}

function relationGroupId(result) {
  const rules = new Set(result.algorithmRules || []);
  const types = (result.synergyTypes || []).join(" ").toLowerCase();
  if (rules.has("direct_link_pair") || /pilot compatible|unit compatible|direct link/.test(types)) return "direct";
  if (rules.has("mechanic_setup") || /trigger|command|setup|protection|draw|removal|recursion|extension|meta call/.test(types)) return "mechanic";
  if (rules.has("shared_archetype") || rules.has("competitive_cooccurrence") || /deck core|side option/.test(types)) return "archetype";
  return "support";
}

function buildArchetypeFits(sourceCard, results, data) {
  if (!sourceCard) return [];
  const archetypes = new Map();

  function add(label, count = 1, reason = "Observed in normalized deck data.") {
    const normalized = String(label || "").trim();
    if (!normalized) return;
    const current = archetypes.get(normalized) || { label: normalized, count: 0, reasons: new Set() };
    current.count += Math.max(1, Math.round(Number(count || 1)));
    current.reasons.add(reason);
    archetypes.set(normalized, current);
  }

  for (const item of sourceCard.topArchetypes || []) {
    add(item.label, item.count, "Source card appears in this imported event/deck shell.");
  }

  for (const row of data?.metaDeckCards || []) {
    if (row.cardNumber !== sourceCard.cardNumber) continue;
    add(row.archetype || row.colorCombination || row.deckName, row.quantity || 1, "Exact card observed in normalized event decklists.");
  }

  for (const result of results) {
    for (const label of result.sharedArchetypes || []) {
      add(toTitleCase(label), Math.max(1, Math.round(result.score / 20)), "Shared archetype signal with a related card.");
    }
  }

  return [...archetypes.values()]
    .map((item) => ({
      label: item.label,
      count: item.count,
      reason: [...item.reasons][0],
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 6);
}

function toTitleCase(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
