export function getCardCopyLimit(card = {}, rules = {}) {
  const restriction = getCardRestriction(card.cardNumber, rules);
  if (restriction && Object.hasOwn(restriction, "maxCopies")) {
    return Math.max(0, Number(restriction.maxCopies));
  }
  if (card.copyLimit !== undefined && card.copyLimit !== null && card.copyLimit !== "") {
    return Math.max(0, Number(card.copyLimit));
  }
  return Math.max(0, Number(rules.defaultCopyLimit ?? 4));
}

export function isCardBanned(card = {}, rules = {}) {
  return getCardCopyLimit(card, rules) === 0;
}

export function quantitiesFromRows(rows = []) {
  const quantities = {};
  for (const row of rows) {
    const cardNumber = row.cardNumber || row.card?.cardNumber;
    if (!cardNumber) continue;
    quantities[cardNumber] = Number(quantities[cardNumber] || 0) + Number(row.quantity || 0);
  }
  return quantities;
}

export function evaluateMainDeckLegality(main = {}, cardMap = new Map(), rules = {}) {
  const issues = [];
  const violations = [];

  for (const [cardNumber, rawQuantity] of Object.entries(main || {})) {
    const quantity = Number(rawQuantity || 0);
    if (quantity <= 0) continue;
    const card = cardMap.get(cardNumber) || { cardNumber, cardName: cardNumber };
    const restriction = getCardRestriction(cardNumber, rules);
    const maxCopies = getCardCopyLimit(card, rules);
    if (quantity <= maxCopies) continue;

    const restrictionType = String(restriction?.restrictionType || "").toLowerCase();
    const isBanned = maxCopies === 0 || restrictionType === "banned";
    const message = isBanned
      ? `${card.cardName || cardNumber} (${cardNumber}) is banned under the current official rules.`
      : `${card.cardName || cardNumber} (${cardNumber}) is limited to ${maxCopies} copies; current: ${quantity}.`;
    issues.push(message);
    violations.push({
      type: isBanned ? "banned_card" : "copy_limit",
      cardNumbers: [cardNumber],
      quantity,
      maxCopies,
      message,
      sourceUrl: restriction?.sourceUrl || rules.legalitySourceUrl || "",
    });
  }

  for (const pair of rules.bannedPairs || []) {
    const cardNumbers = pair.cardNumbers || pair.cards || [];
    const active = cardNumbers.filter((cardNumber) => Number(main?.[cardNumber] || 0) > 0);
    if (active.length < 2) continue;
    const names = active.map((cardNumber) =>
      `${cardMap.get(cardNumber)?.cardName || cardNumber} (${cardNumber})`);
    const message = `${names.join(" + ")} are a banned pair and cannot be used in the same deck.`;
    issues.push(message);
    violations.push({
      type: "banned_pair",
      cardNumbers: active,
      message,
      sourceUrl: pair.sourceUrl || rules.legalitySourceUrl || "",
    });
  }

  for (const group of rules.exclusiveCardGroups || []) {
    const active = Object.keys(main || {}).filter((cardNumber) => {
      if (Number(main[cardNumber] || 0) <= 0) return false;
      const card = cardMap.get(cardNumber);
      return (group.cardNumbers || []).includes(cardNumber)
        || matchesExclusiveGroup(card, group.matcher);
    });
    const maxDistinct = Number(group.maxDistinct ?? 1);
    if (active.length <= maxDistinct) continue;
    const names = active.map((cardNumber) =>
      `${cardMap.get(cardNumber)?.cardName || cardNumber} (${cardNumber})`);
    const message = `${group.name || "Restricted card group"} allows at most ${maxDistinct} distinct option; found ${names.join(", ")}.`;
    issues.push(message);
    violations.push({
      type: "exclusive_group",
      cardNumbers: active,
      maxDistinct,
      message,
      sourceUrl: group.sourceUrl || rules.legalitySourceUrl || "",
    });
  }

  return {
    legal: issues.length === 0,
    issues,
    violations,
    rulesEffectiveDate: rules.legalityEffectiveDate || "",
    sourceUrl: rules.legalitySourceUrl || "",
  };
}

export function canAddCardToMain(main, card, cardMap, rules, amount = 1) {
  if (!card?.cardNumber || amount <= 0) return false;
  const next = {
    ...(main || {}),
    [card.cardNumber]: Number(main?.[card.cardNumber] || 0) + Number(amount),
  };
  return evaluateMainDeckLegality(next, cardMap, rules).legal;
}

function getCardRestriction(cardNumber, rules) {
  return (rules.currentRestrictions || [])
    .find((item) => item.cardNumber === cardNumber);
}

function matchesExclusiveGroup(card, matcher) {
  if (!card || !matcher) return false;
  if (matcher !== "level2-cost1-ap2-hp2-effectless-unit") return false;
  const effect = String(card.effectPreview || "")
    .replace(/[—–-]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  return card.cardType === "UNIT"
    && Number(card.level) === 2
    && Number(card.cost) === 1
    && Number(card.ap) === 2
    && Number(card.hp) === 2
    && (!effect || effect === "none");
}
