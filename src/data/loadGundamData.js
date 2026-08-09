const EMPTY_DATA = {
  cards: [],
  resourceCards: [],
  previews: [],
  metaEvents: [],
  metaResults: [],
  metaDeckCards: [],
  marketListings: [],
  archetypes: [],
  templates: [],
  filters: {},
  counts: {},
};

export async function loadGundamData() {
  try {
    const response = await fetch("/app-data.json", { cache: "no-store" });
    if (response.ok) {
      return normalizePayload(await response.json());
    }
  } catch {
    // The static legacy payload remains a safe fallback during migration.
  }

  if (window.GUNDAM_DECK_BUILDER_DATA) {
    return normalizePayload(window.GUNDAM_DECK_BUILDER_DATA);
  }

  return EMPTY_DATA;
}

export async function loadHomeData() {
  try {
    const response = await fetch("/home-data.json?v=20260809-2", { cache: "default" });
    if (response.ok) return await response.json();
  } catch {
    // Fall through to the complete payload when the generated summary is absent.
  }
  return loadGundamData();
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return EMPTY_DATA;
  }

  return {
    ...EMPTY_DATA,
    ...payload,
    cards: Array.isArray(payload.cards) ? payload.cards : [],
    resourceCards: Array.isArray(payload.resourceCards) ? payload.resourceCards : [],
    previews: Array.isArray(payload.previews) ? payload.previews : [],
    metaEvents: Array.isArray(payload.metaEvents) ? payload.metaEvents : [],
    metaResults: Array.isArray(payload.metaResults) ? payload.metaResults : [],
    metaDeckCards: Array.isArray(payload.metaDeckCards) ? payload.metaDeckCards : [],
    marketListings: Array.isArray(payload.marketListings) ? payload.marketListings : [],
    archetypes: Array.isArray(payload.archetypes) ? payload.archetypes : [],
    templates: Array.isArray(payload.templates) ? payload.templates : [],
  };
}
