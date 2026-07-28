export function buildMetaSignal(cards = [], archetypes = []) {
  const ranked = cards
    .map((card) => {
      const recent = Number(card.recentTop8DecksUsing || 0);
      const all = Number(card.allTop8DecksUsing || 0);
      const recentScore = Number(card.recentMetaScore || 0);
      const overallScore = Number(card.overallMetaScore || 0);
      const delta = recentScore - overallScore / 4;
      const band = classifyCard({ recent, all, recentScore, card });
      const previousBand = classifyCard({
        recent: Math.max(0, all - recent),
        all,
        recentScore: overallScore / 4,
        card,
      });
      const movementDelta = bandWeight(band) - bandWeight(previousBand);
      return {
        cardNumber: card.cardNumber,
        cardName: card.cardName,
        color: card.color,
        cardType: card.cardType,
        recent,
        all,
        recentScore,
        overallScore,
        delta,
        band,
        previousBand,
        movementDelta,
        movementDirection: movementDelta > 0 ? "up" : movementDelta < 0 ? "down" : "flat",
        reason: buildReason(card, recent, delta),
      };
    })
    .sort((a, b) => b.recentScore - a.recentScore || b.delta - a.delta);

  const risers = ranked.filter((row) => row.delta > 3).slice(0, 12);
  const fallers = ranked.filter((row) => row.delta < -3).sort((a, b) => a.delta - b.delta).slice(0, 12);
  const watch = ranked.filter((row) => row.band === "Watch").slice(0, 12);
  const movements = ranked
    .filter((row) => row.previousBand !== row.band)
    .sort((a, b) => Math.abs(b.movementDelta) - Math.abs(a.movementDelta) || Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 12);
  const archetypeTrends = archetypes
    .slice()
    .sort((left, right) => Number(right.recentMetaScore || 0) - Number(left.recentMetaScore || 0))
    .slice(0, 12)
    .map((row) => ({
      archetype: row.archetype,
      colorCombination: row.commonColorCombination,
      recentDecklists: row.recentDecklists,
      recentTop8Decks: row.recentTop8Decks,
      recentWins: row.recentWins,
      recentMetaScore: row.recentMetaScore,
      bestFinish: row.bestFinish,
    }));

  return { ranked, risers, fallers, watch, movements, archetypeTrends };
}

export function eventBreakdown(events = [], results = []) {
  const recentEvents = events.slice().sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate))).slice(0, 50);
  const colorBreakdown = countBy(results, "colorCombination");
  const archetypeBreakdown = countBy(results, "archetype");
  return { recentEvents, colorBreakdown, archetypeBreakdown };
}

function classifyCard({ recent, all, recentScore, card }) {
  if (recent >= 30 || recentScore >= 25) return "Staple";
  if (recent >= 12 || recentScore >= 10) return "Meta relevante";
  if (recent >= 5) return "Sideboard/meta call";
  const brlReference = Number(card.marketPriceBrlFx || card.marketPriceBrlX5 || 0);
  if (brlReference <= 10 && recent >= 2) return "Low cost util";
  if (recent >= 1 || all >= 8) return "Watch";
  return "Bulk";
}

function buildReason(card, recent, delta) {
  if (recent > 0) {
    return `${recent} recent Top 16 appearance(s); movement score ${delta.toFixed(1)}.`;
  }
  if (card.hasAltArt) return "No recent Top 16 signal, but tracked as collectible/alt-art.";
  return "No recent competitive signal.";
}

function countBy(rows, key) {
  return Object.entries(rows.reduce((acc, row) => {
    const value = row[key] || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {}))
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function bandWeight(band) {
  return {
    Bulk: 0,
    Watch: 1,
    "Low cost util": 2,
    "Sideboard/meta call": 3,
    "Meta relevante": 4,
    Staple: 5,
  }[band] ?? 0;
}
