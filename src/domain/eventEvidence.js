export function resolveEventWinner(results = []) {
  const winners = results.filter(result => Number(result.placingRank) === 1);
  return { winner: winners.length === 1 ? winners[0] : null, status: winners.length > 1 ? "conflicting" : winners.length === 1 ? "reported" : "missing" };
}
