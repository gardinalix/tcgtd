export function createDeckDiff(original = {}, current = {}) {
  const cardNumbers = [...new Set([...Object.keys(original), ...Object.keys(current)])].sort();
  const changes = cardNumbers
    .map((cardNumber) => {
      const before = Number(original[cardNumber] || 0);
      const after = Number(current[cardNumber] || 0);
      return {
        cardNumber,
        before,
        after,
        delta: after - before,
        type: before === 0 ? "added" : after === 0 ? "removed" : "changed",
      };
    })
    .filter((change) => change.delta !== 0);
  return {
    changes,
    added: changes.filter((change) => change.delta > 0),
    removed: changes.filter((change) => change.delta < 0),
    totalDelta: changes.reduce((sum, change) => sum + change.delta, 0),
    changedCards: changes.length,
  };
}

export function applyDeckChangeSuggestion(main = {}, suggestion = {}, options = {}) {
  if (!options.confirmed) {
    return { applied: false, main: { ...main }, diff: createDeckDiff(main, main), reason: "confirmation_required" };
  }
  const allowedOperationIds = options.operationIds ? new Set(options.operationIds) : null;
  const next = { ...main };
  const operations = [
    ...(suggestion.remove || []).map((item, index) => ({ ...item, kind: "remove", id: item.id || `remove:${item.cardId}:${index}` })),
    ...(suggestion.add || []).map((item, index) => ({ ...item, kind: "add", id: item.id || `add:${item.cardId}:${index}` })),
  ].filter((operation) => !allowedOperationIds || allowedOperationIds.has(operation.id));

  for (const operation of operations) {
    const quantity = Math.max(0, Number(operation.quantity || 0));
    const current = Number(next[operation.cardId] || 0);
    const after = operation.kind === "remove"
      ? Math.max(0, current - quantity)
      : current + quantity;
    if (after) next[operation.cardId] = after;
    else delete next[operation.cardId];
  }
  return { applied: true, main: next, diff: createDeckDiff(main, next), operations };
}

export function createHistoryEntry(before = {}, after = {}, metadata = {}) {
  return {
    id: metadata.id || `change-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: metadata.createdAt || new Date().toISOString(),
    label: metadata.label || "Alteração do deck",
    origin: metadata.origin || "pilot",
    before: { ...before },
    after: { ...after },
    diff: createDeckDiff(before, after),
  };
}
