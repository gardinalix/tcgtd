import { clamp, normalizeSearchText, round, tokenOverlap } from "./deckDesignerUtils.js";

// These rules are deliberately based on the catalog's structured mechanic tags.
// They describe deck-building pressure, not guaranteed in-game interactions.
const COUNTER_RULES = [
  {
    targetTags: ["blocker"],
    answerTags: ["removal", "bounce", "damage_push", "breach", "ap_mod"],
    objective: "keep pressure meaningful through a defensive board",
  },
  {
    targetTags: ["token"],
    answerTags: ["removal", "bounce", "damage_push"],
    objective: "avoid letting token boards buy too much time",
  },
  {
    targetTags: ["draw", "search"],
    answerTags: ["damage_push", "breach", "removal", "bounce"],
    objective: "pressure setup turns before card advantage compounds",
  },
  {
    targetTags: ["link", "pair"],
    answerTags: ["removal", "bounce", "damage_push", "ap_mod"],
    objective: "contest the board while linked pieces are being assembled",
  },
  {
    targetTags: ["trash", "repair", "recovery"],
    answerTags: ["damage_push", "breach", "removal", "bounce"],
    objective: "convert pressure before recurring value takes over",
  },
];

export function buildCounterPlan(data = {}, requestedArchetype = "") {
  const requested = String(requestedArchetype || "").trim();
  if (!requested) return inactiveCounterPlan();

  const profiles = resolveArchetypeProfiles(data.archetypes || [], requested);
  if (!profiles.length) {
    return {
      ...inactiveCounterPlan(),
      requestedArchetype: requested,
      unresolved: true,
    };
  }

  const targetTags = [...new Set(profiles.flatMap((profile) => profile.signatureTags || [])
    .map(normalizeSearchText)
    .filter(Boolean))];
  const activeRules = COUNTER_RULES.filter((rule) =>
    rule.targetTags.some((tag) => targetTags.includes(tag)));
  const answerTags = [...new Set(activeRules.flatMap((rule) => rule.answerTags))];

  return {
    active: true,
    unresolved: false,
    requestedArchetype: requested,
    targetArchetype: profiles.length > 1 ? requested : profiles[0].archetype,
    targetTags,
    targetTraits: [...new Set(profiles.flatMap((profile) => profile.signatureTraits || []).map(String).filter(Boolean))],
    answerTags,
    objectives: [...new Set(activeRules.map((rule) => rule.objective))],
    relevantRuleCount: activeRules.length,
    sampleDecklists: profiles.reduce((sum, profile) => sum + Number(profile.recentDecklists || 0), 0),
    evidenceType: "catalog_profile",
  };
}

export function scoreCounterFit(card = {}, counterPlan = {}) {
  if (!counterPlan.active || !counterPlan.relevantRuleCount) {
    return { score: 0, matchedTags: [], reasons: [] };
  }
  const cardTags = new Set((card.synergyTags || []).map(normalizeSearchText).filter(Boolean));
  const coveredRules = COUNTER_RULES.filter((rule) => {
    const targetPresent = rule.targetTags.some((tag) => counterPlan.targetTags.includes(tag));
    return targetPresent && rule.answerTags.some((tag) => cardTags.has(normalizeSearchText(tag)));
  });
  const matchedTags = [
    ...new Set(
      coveredRules.flatMap((rule) =>
        rule.answerTags.filter((tag) => cardTags.has(normalizeSearchText(tag)))),
    ),
  ];
  const score = clamp(coveredRules.length / counterPlan.relevantRuleCount);

  return {
    score: round(score, 3),
    matchedTags,
    reasons: [...new Set(coveredRules.map((rule) => rule.objective))],
  };
}

function inactiveCounterPlan() {
  return {
    active: false,
    unresolved: false,
    requestedArchetype: "",
    targetArchetype: "",
    targetTags: [],
    targetTraits: [],
    answerTags: [],
    objectives: [],
    relevantRuleCount: 0,
    sampleDecklists: 0,
    evidenceType: "",
  };
}

function resolveArchetypeProfiles(profiles, requested) {
  const normalized = normalizeSearchText(requested);
  const exact = profiles.find((profile) => normalizeSearchText(profile.archetype) === normalized);
  if (exact) return [exact];
  const family = profiles.filter((profile) =>
    normalizeSearchText(profile.archetype).startsWith(normalized));
  if (family.length > 1) return family;
  const best = profiles
    .map((profile) => ({ profile, score: tokenOverlap(requested, profile.archetype) }))
    .filter((item) => item.score >= 0.6)
    .sort((left, right) => right.score - left.score
      || Number(right.profile.recentDecklists || 0) - Number(left.profile.recentDecklists || 0))[0]?.profile;
  return best ? [best] : [];
}
