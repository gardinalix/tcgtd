import { useMemo, useState } from "react";
import { CardArt } from "../components/cards/CardArt";
import { PriceTag } from "../components/cards/PriceTag";
import {
  TacticalDataPanel,
  TacticalEmptyState,
  TacticalActionButton,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";
import { DEFAULT_SYNERGY_FILTERS, SynergyFilters } from "../components/synergy/SynergyFilters";
import { SynergyCard } from "../components/synergy/SynergyCard";
import { SynergyRankBadge, SynergyTypeBadge } from "../components/synergy/SynergyBadges";
import { getMetaSignal } from "../domain/cards";
import { getSynergiesForCard } from "../services/synergyAnalyzer";

export function SynergyPage({ data, cardId, onBack, onOpenCard, onOpenMap, onAddToDeck }) {
  const allCards = [...(data.cards || []), ...(data.resourceCards || [])];
  const sourceCard = allCards.find((card) => card.cardNumber === cardId || card.detailSearchId === cardId);
  const [filters, setFilters] = useState(DEFAULT_SYNERGY_FILTERS);
  const [compareResult, setCompareResult] = useState(null);
  const results = useMemo(() => getSynergiesForCard(sourceCard, data, { minScore: 20 }), [sourceCard, data]);
  const filteredResults = useMemo(() => filterSynergyResults(results, filters), [results, filters]);
  const options = useMemo(() => buildFilterOptions(results), [results]);
  const grouped = groupByRank(filteredResults);
  const typeRows = summarizeTypes(filteredResults);
  const metaSignal = sourceCard ? getMetaSignal(sourceCard) : null;

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <TacticalPageShell className="synergy-terminal-page">
      <TacticalPageHeader
        eyebrow="Synergy matrix"
        title={sourceCard ? `${sourceCard.cardName} synergy analysis` : "Card not found"}
        subtitle={sourceCard ? `${sourceCard.cardNumber} / ${sourceCard.color} / ${sourceCard.cardType}` : "No source card matched this id."}
        onBack={onBack}
        backLabel="Back to card"
        actions={sourceCard && onOpenMap ? <TacticalActionButton onClick={() => onOpenMap(sourceCard.cardNumber)}>Visual map</TacticalActionButton> : null}
      />

      {sourceCard ? (
        <TacticalSummaryStrip>
          <TacticalSummaryCard label="Detected links" value={results.length} detail="Above visible threshold." tone="blue" />
          <TacticalSummaryCard label="High synergy" value={results.filter((item) => item.rank === "high").length} detail="Direct/high confidence." tone="green" />
          <TacticalSummaryCard label="Good synergy" value={results.filter((item) => item.rank === "good").length} detail="Useful tactical bridge." tone="blue" />
          <TacticalSummaryCard label="Meta signal" value={metaSignal?.label || "-"} detail={metaSignal?.reason || ""} tone={metaSignal?.tone || "neutral"} />
        </TacticalSummaryStrip>
      ) : null}

      {sourceCard ? (
        <div className="synergy-terminal-grid">
          <SynergyFilters filters={filters} options={options} onChange={setFilter} onReset={() => setFilters(DEFAULT_SYNERGY_FILTERS)} />

          <section className="synergy-results-column">
            <TacticalDataPanel title="Selected card" subtitle="Source signal for this tactical scan." className="synergy-source-panel">
              <div className="synergy-source-card">
                <CardArt card={sourceCard} className="art-frame art-frame--mini" compact />
                <div>
                  <span className="eyebrow">{sourceCard.cardNumber}</span>
                  <h2>{sourceCard.cardName}</h2>
                  <p>{sourceCard.effectPreview || "No text loaded."}</p>
                  <div className="synergy-card__types">
                    {(sourceCard.traits || []).slice(0, 5).map((trait) => <SynergyTypeBadge key={trait}>{trait}</SynergyTypeBadge>)}
                  </div>
                  <PriceTag card={sourceCard} />
                </div>
              </div>
            </TacticalDataPanel>

            {["high", "good", "low"].map((rank) => (
              <TacticalDataPanel
                key={rank}
                title={`${rank} synergy`}
                subtitle={`${grouped[rank].length} compatible card(s) after current filters.`}
                className="synergy-rank-section"
              >
                {grouped[rank].length ? (
                  <div className="synergy-list synergy-list--full">
                    {grouped[rank].map((result) => (
                      <SynergyCard
                        key={result.id}
                        result={result}
                        onOpenCard={onOpenCard}
                        onAddToDeck={onAddToDeck}
                        onCompare={setCompareResult}
                      />
                    ))}
                  </div>
                ) : (
                  <TacticalEmptyState title="No cards in this rank" detail="Adjust filters to widen the scan." />
                )}
              </TacticalDataPanel>
            ))}
          </section>

          <aside className="synergy-side-terminal">
            <TacticalDataPanel title="Type breakdown" subtitle="Grouped tactical explanations.">
              <div className="synergy-breakdown-list">
                {typeRows.map((row) => (
                  <span key={row.label}>
                    <strong>{row.label}</strong>
                    <em>{row.count}</em>
                  </span>
                ))}
              </div>
            </TacticalDataPanel>

            <TacticalDataPanel title="Compare cards" subtitle="Select Compare in a result row.">
              {compareResult ? (
                <div className="synergy-compare-panel">
                  <div>
                    <strong>{sourceCard.cardName}</strong>
                    <span>{sourceCard.color} / {sourceCard.cardType}</span>
                  </div>
                  <div>
                    <strong>{compareResult.targetCard.cardName}</strong>
                    <span>{compareResult.targetCard.color} / {compareResult.targetCard.cardType}</span>
                  </div>
                  <SynergyRankBadge rank={compareResult.rank} score={compareResult.score} />
                  <p>{compareResult.explanation}</p>
                </div>
              ) : (
                <TacticalEmptyState title="No comparison loaded" detail="Use Compare on any synergy result." />
              )}
            </TacticalDataPanel>
          </aside>
        </div>
      ) : null}
    </TacticalPageShell>
  );
}

function filterSynergyResults(results, filters) {
  return results.filter((result) => {
    const card = result.targetCard;
    const metaSignal = getMetaSignal(card);
    if (filters.rank !== "Any" && result.rank !== filters.rank.toLowerCase()) return false;
    if (filters.type !== "Any" && !result.synergyTypes.includes(filters.type)) return false;
    if (filters.color !== "Any" && card.color !== filters.color) return false;
    if (filters.cardType !== "Any" && card.cardType !== filters.cardType) return false;
    if (filters.set !== "Any" && !(card.packageCodes || []).includes(filters.set)) return false;
    if (filters.trait !== "Any" && !(card.traits || []).includes(filters.trait)) return false;
    if (filters.competitiveOnly && !["keep", "watch"].includes(metaSignal.value)) return false;
    if (filters.lowCostOnly && !(Number(card.marketPriceBrlX5 || 0) > 0 && Number(card.marketPriceBrlX5 || 0) <= 5)) return false;
    if (filters.pricedOnly && !Number.isFinite(Number(card.marketPriceUsd))) return false;
    if (filters.sameDeckOnly && !result.coDeckCount) return false;
    return true;
  });
}

function buildFilterOptions(results) {
  const cards = results.map((result) => result.targetCard);
  return {
    types: ["Any", ...unique(results.flatMap((result) => result.synergyTypes))],
    colors: ["Any", ...unique(cards.map((card) => card.color))],
    cardTypes: ["Any", ...unique(cards.map((card) => card.cardType))],
    sets: ["Any", ...unique(cards.flatMap((card) => card.packageCodes || []))],
    traits: ["Any", ...unique(cards.flatMap((card) => card.traits || []))],
  };
}

function groupByRank(results) {
  return {
    high: results.filter((result) => result.rank === "high"),
    good: results.filter((result) => result.rank === "good"),
    low: results.filter((result) => result.rank === "low"),
  };
}

function summarizeTypes(results) {
  const counts = new Map();
  for (const result of results) {
    for (const type of result.synergyTypes) {
      counts.set(type, (counts.get(type) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 14);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right)));
}
