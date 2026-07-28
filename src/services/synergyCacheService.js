import { SYNERGY_ALGORITHM_VERSION } from "./synergyRulesEngine.js";

const memoryCache = new Map();

export function synergyCacheKey(sourceCard, data) {
  return [
    SYNERGY_ALGORITHM_VERSION,
    data?.generatedAt || data?.cardSnapshotGeneratedAt || "local",
    sourceCard?.cardNumber || sourceCard?.detailSearchId || "unknown",
  ].join("::");
}

export function getCachedSynergy(key) {
  return memoryCache.get(key) || null;
}

export function setCachedSynergy(key, payload) {
  memoryCache.set(key, {
    ...payload,
    calculatedAt: new Date().toISOString(),
    algorithmVersion: SYNERGY_ALGORITHM_VERSION,
  });
}

export function clearSynergyCache() {
  memoryCache.clear();
}

export function synergyCacheSize() {
  return memoryCache.size;
}
