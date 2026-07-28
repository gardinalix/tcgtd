import { authRequest } from "./authClient";

export async function fetchExBurstProfileDecks(profileTarget, { limit = 50 } = {}) {
  const params = new URLSearchParams({
    profile: profileTarget,
    limit: String(limit),
  });
  return authRequest(`/api/import/exburst/profile-decks?${params.toString()}`);
}

export async function fetchExBurstDeck(deckTarget) {
  const params = new URLSearchParams({ deck: deckTarget });
  return authRequest(`/api/import/exburst/deck?${params.toString()}`);
}

export function exburstDeckUrl(deckId) {
  return `https://exburst.dev/gundam/deck/${encodeURIComponent(deckId)}`;
}
