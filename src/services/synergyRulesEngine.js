export const SYNERGY_ALGORITHM_VERSION = "synergy-map-2026-07-30-trait-gates-v3";

export const DEFAULT_SYNERGY_RULES = [
  {
    id: "direct_link_pair",
    name: "Direct LINK/PAIR",
    description: "A card explicitly links, pairs, or names the selected card or one of its traits.",
    weight: 30,
    enabled: true,
  },
  {
    id: "shared_trait",
    name: "Shared trait",
    description: "Cards share at least one relevant printed trait.",
    weight: 25,
    enabled: true,
  },
  {
    id: "shared_archetype",
    name: "Shared archetype",
    description: "Cards are associated with the same archetype signal.",
    weight: 25,
    enabled: true,
  },
  {
    id: "competitive_cooccurrence",
    name: "Competitive co-occurrence",
    description: "Cards appear together in normalized event decklists.",
    weight: 25,
    enabled: true,
  },
  {
    id: "text_bridge",
    name: "Text bridge",
    description: "Card text references a type, trait, color, keyword, or condition from the selected card.",
    weight: 20,
    enabled: true,
  },
  {
    id: "mechanic_setup",
    name: "Mechanic setup",
    description: "One card can enable a trigger, damage state, activation window, or tactical line on the other card.",
    weight: 30,
    enabled: true,
  },
  {
    id: "same_color",
    name: "Color support",
    description: "Cards share color identity.",
    weight: 15,
    enabled: true,
  },
  {
    id: "curve_support",
    name: "Curve support",
    description: "Cards occupy complementary points of the cost curve.",
    weight: 15,
    enabled: true,
  },
  {
    id: "shared_keyword",
    name: "Shared keyword",
    description: "Cards share tactical keywords or synergy tags.",
    weight: 10,
    enabled: true,
  },
  {
    id: "color_conflict",
    name: "Color conflict",
    description: "Different colors without link, shared archetype, or deck co-occurrence.",
    weight: -10,
    enabled: true,
  },
];

export function ruleWeight(id, rules = DEFAULT_SYNERGY_RULES) {
  const rule = rules.find((item) => item.id === id);
  return rule?.enabled === false ? 0 : Number(rule?.weight || 0);
}

export function rankForScore(score) {
  if (score >= 80) return "high";
  if (score >= 50) return "good";
  if (score >= 20) return "low";
  return "none";
}

export function rankLabel(rank) {
  return {
    high: "High synergy",
    good: "Good synergy",
    low: "Low synergy",
    none: "No relevant signal",
  }[rank] || "No relevant signal";
}

export function rankTone(rank) {
  return {
    high: "green",
    good: "blue",
    low: "gold",
    none: "muted",
  }[rank] || "muted";
}

export function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

export function uniqueList(values) {
  return [...new Set(values.filter(Boolean))];
}
