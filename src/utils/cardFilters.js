export const DEFAULT_FILTERS = {
  search: "",
  color: "Any",
  type: "Any",
  rarity: "Any",
  set: "Any",
  cost: "",
  trait: "",
};

export function uniqueValues(cards, selector) {
  return [...new Set(cards.map(selector).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

export function filterCards(cards, filters) {
  const query = normalize(filters.search);
  const traitQuery = normalize(filters.trait);
  const costQuery = normalize(filters.cost);

  return cards.filter((card) => {
    if (filters.color !== "Any" && card.color !== filters.color) {
      return false;
    }
    if (filters.type !== "Any" && card.cardType !== filters.type) {
      return false;
    }
    if (filters.rarity !== "Any" && card.rarity !== filters.rarity) {
      return false;
    }
    if (filters.set !== "Any" && !(card.packageCodes || []).includes(filters.set)) {
      return false;
    }
    if (costQuery && !matchesNumericFilter(card.cost, costQuery)) {
      return false;
    }
    if (traitQuery && !normalize([...(card.traits || []), ...(card.synergyTags || []), ...(card.linkTargets || [])].join(" ")).includes(traitQuery)) {
      return false;
    }
    if (!query) {
      return true;
    }

    return normalize(
      [
        card.cardNumber,
        card.cardName,
        card.color,
        card.cardType,
        card.rarity,
        card.effectPreview,
        card.whereToGetIt,
        card.searchText,
        card.displayCardNumber,
        card.variantCode,
        ...(card.traits || []),
        ...(card.synergyTags || []),
      ].join(" "),
    ).includes(query);
  });
}

export function pickPilotCard(cards, themeConfig) {
  const queries = themeConfig.pilotQuery || [];
  const matches = cards
    .filter((card) => String(card.cardType || "").toUpperCase() === "PILOT")
    .filter((card) => queries.some((query) => normalize(card.cardName).includes(normalize(query))))
    .sort((left, right) => pilotNameMatchScore(right, queries) - pilotNameMatchScore(left, queries));
  const pilotCard = sortByRarityAndArt(matches)[0];
  if (pilotCard) {
    return withBestPrintingArt(pilotCard, themeConfig.preferredPilotPrinting);
  }

  const fallback = cards.find((card) => card.imageUrl);
  return fallback ? withBestPrintingArt(fallback) : null;
}

export function summarizePackages(cards) {
  const counts = new Map();
  for (const card of cards) {
    const packageCode = packageCodeForCard(card);
    counts.set(packageCode, (counts.get(packageCode) || 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || compareSetCode(right.label, left.label));
  const visible = rows.slice(0, 7);
  const hidden = rows.slice(7).reduce((sum, row) => sum + row.count, 0);
  if (hidden) {
    visible.push({ label: "OTHERS", count: hidden });
  }
  return visible;
}

export function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function sortByRarityAndArt(cards) {
  return cards.slice().sort((left, right) => {
    const leftScore = cardDisplayScore(left);
    const rightScore = cardDisplayScore(right);
    return rightScore - leftScore || String(left.cardNumber).localeCompare(String(right.cardNumber));
  });
}

function withBestPrintingArt(card, preferredPrintingId = "") {
  const bestPrinting = bestPrintingForDisplay(card, preferredPrintingId);
  if (!bestPrinting) {
    return card;
  }

  return {
    ...card,
    imageUrl: bestPrinting.imageUrl || card.imageUrl,
    detailUrl: bestPrinting.detailUrl || card.detailUrl,
    detailSearchId: bestPrinting.detailSearchId || card.detailSearchId,
    displayCardNumber: bestPrinting.detailSearchId || card.cardNumber,
    variantCode: bestPrinting.variantCode || card.variantCode,
    isParallelVariant: Boolean(bestPrinting.isParallelVariant),
    rarity: bestPrinting.rarity || card.rarity,
    whereToGetIt: bestPrinting.whereToGetIt || card.whereToGetIt,
    synchronizedPrinting: bestPrinting,
  };
}

function bestPrintingForDisplay(card, preferredPrintingId = "") {
  const printings = Array.isArray(card.printings) ? card.printings : [];
  const preferred = printings.find((printing) => normalizeUpper(printing.detailSearchId) === normalizeUpper(preferredPrintingId));
  if (preferred?.imageUrl) {
    return preferred;
  }

  return printings
    .filter((printing) => printing.imageUrl)
    .sort((left, right) => printingDisplayScore(right) - printingDisplayScore(left) || compareVariantId(right, left))[0];
}

function cardDisplayScore(card) {
  const printings = Array.isArray(card.printings) ? card.printings : [];
  const bestPrintingScore = printings.length
    ? Math.max(...printings.map(printingDisplayScore))
    : 0;
  return Math.max(bestPrintingScore, rarityScore(card.rarity) + Number(card.hasAltArt) * 100);
}

function printingDisplayScore(printing) {
  return rarityScore(printing.rarity)
    + sourcePrestigeScore(printing.whereToGetIt)
    + Number(printing.isParallelVariant) * 90
    + Number(Boolean(printing.imageUrl)) * 10;
}

function rarityScore(value) {
  const rarity = String(value || "").toUpperCase().replace(/\s+/g, "");
  const base = rarity.replace(/\+/g, "");
  const plusCount = (rarity.match(/\+/g) || []).length;
  const baseRank = {
    SEC: 900,
    SCR: 880,
    SP: 860,
    AA: 840,
    PARALLEL: 820,
    LR: 700,
    M: 660,
    R: 600,
    P: 560,
    U: 500,
    C: 400,
  }[base] || 0;
  return baseRank + plusCount * 50;
}

function pilotNameMatchScore(card, queries) {
  const cardName = normalize(card.cardName);
  return queries.reduce((best, query, index) => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return best;
    const exactScore = cardName === normalizedQuery ? 1000 : 0;
    const startsScore = cardName.startsWith(normalizedQuery) ? 500 : 0;
    const includesScore = cardName.includes(normalizedQuery) ? 100 : 0;
    return Math.max(best, exactScore + startsScore + includesScore - index);
  }, 0);
}

function sourcePrestigeScore(value) {
  const source = normalize(value);
  if (/world championships|upper ranks|finalist/.test(source)) return 180;
  if (/newtype challenge/.test(source)) return 150;
  if (/championship/.test(source)) return 140;
  if (/premium accessory|premium card collection/.test(source)) return 135;
  if (/\bevents?\b/.test(source)) return 115;
  if (/launch event|release event|participation/.test(source)) return 95;
  if (/edition beta/.test(source)) return 85;
  if (/bonus pack/.test(source)) return 70;
  return 0;
}

function normalizeUpper(value) {
  return String(value || "").toUpperCase().trim();
}

function compareVariantId(left, right) {
  return variantNumber(left.detailSearchId || left.variantCode) - variantNumber(right.detailSearchId || right.variantCode);
}

function variantNumber(value) {
  const match = String(value || "").match(/_p(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function packageCodeForCard(card) {
  const packageCode = (card.packageCodes || []).find((code) => /^(GD|ST|EX|PR)\d+/i.test(code)) || (card.packageCodes || [])[0];
  if (packageCode) {
    return String(packageCode).toUpperCase();
  }
  const cardPrefix = String(card.cardNumber || "").match(/^([A-Z]+\d+)/i);
  if (cardPrefix) {
    return cardPrefix[1].toUpperCase();
  }
  return String(card.cardType || "").toUpperCase() === "RESOURCE" ? "RESOURCE" : "OTHERS";
}

function compareSetCode(left, right) {
  const leftRank = setRank(left);
  const rightRank = setRank(right);
  return leftRank - rightRank || String(left).localeCompare(String(right));
}

function setRank(value) {
  const match = String(value || "").match(/([A-Z]+)(\d+)/i);
  if (!match) return 0;
  const prefixRank = { GD: 900, ST: 700, EX: 600, RP: 500, PR: 400 }[match[1].toUpperCase()] || 100;
  return prefixRank + Number(match[2] || 0);
}

function matchesNumericFilter(value, filter) {
  const numeric = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) {
    return false;
  }

  const match = filter.match(/^(<=|>=|<|>|=)?\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    return String(value || "").includes(filter);
  }

  const operator = match[1] || "=";
  const target = Number(match[2]);
  if (operator === "<=") return numeric <= target;
  if (operator === ">=") return numeric >= target;
  if (operator === "<") return numeric < target;
  if (operator === ">") return numeric > target;
  return numeric === target;
}
