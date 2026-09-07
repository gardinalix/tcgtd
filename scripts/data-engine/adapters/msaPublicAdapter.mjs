import { createHash } from "node:crypto";

export const MSA_PUBLIC_URL = "https://mobilesuitarena.com/";

// Parse the JSON table rendered in the public home page. Never execute source JS.
// Only the ended-game index is projected; account, session and chat fields are discarded.
export function parseMsaPublicHome(html, observedAt) {
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error("A valid observation timestamp is required.");
  const match = html.match(/streamController\.enqueue\(("(?:\\.|[^"\\])*")\)/);
  if (!match) throw new Error("MSA public page schema changed: data table not found.");
  const table = JSON.parse(JSON.parse(match[1]));
  if (!Array.isArray(table) || table.length > 100000) throw new Error("Invalid MSA data table.");
  const lookup = (object, name) => {
    const entry = Object.entries(object || {}).find(([key]) => table[Number(key.slice(1))] === name);
    return entry ? table[entry[1]] : undefined;
  };
  const root = lookup(table[0], "loaderData");
  const home = lookup(root, "routes/_index");
  const ended = lookup(home, "ended");
  if (!Array.isArray(ended) || !ended.length) throw new Error("No finished-game sample found; retain previous snapshot.");
  const rows = ended.map(index => table[index]);
  const ids = new Set();
  const items = rows.map(row => {
    const id = lookup(row, "gameUuid");
    const refs = lookup(row, "players");
    const mode = lookup(row, "matchMode");
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id) || !Array.isArray(refs) || refs.length !== 2 || lookup(row, "ended") !== true || typeof mode !== "string") throw new Error("Invalid public game row; retain previous snapshot.");
    if (ids.has(id)) throw new Error("Duplicate game identifier in public sample.");
    ids.add(id);
    const winners = refs.map((ref, seat) => lookup(table[ref], "winner") === true ? seat : -1).filter(seat => seat >= 0);
    return { id, sourceId: "msa-public", sourceUrl: `${MSA_PUBLIC_URL}game/${id}`, mode, ended: true,
      winnerSeat: winners.length === 1 ? winners[0] : null,
      // Collection time must never masquerade as a match date or season.
      playedAt: null, season: null, firstObservedAt: observedAt,
      players: [{ archetype: null, deckId: null }, { archetype: null, deckId: null }],
    };
  });
  return {
    schemaVersion: "tcgtd-msa-public-v1", sourceUrl: MSA_PUBLIC_URL, observedAt,
    status: "partial_public_index", coverage: "recent_homepage_sample",
    capabilities: { winners: items.some(row => row.winnerSeat !== null), matchDates: false, decklists: false, archetypes: false, completeHistory: false },
    contentHash: createHash("sha256").update(JSON.stringify(items.map(({ firstObservedAt, ...row }) => row))).digest("hex"),
    items,
  };
}

export async function fetchMsaPublicHome({ fetchImpl = fetch, observedAt = new Date().toISOString() } = {}) {
  const response = await fetchImpl(MSA_PUBLIC_URL, { signal: AbortSignal.timeout(20000), redirect: "error", headers: { Accept: "text/html", "User-Agent": "TCGTD-Research/1.0 (+https://tcgtd.com.br/about)" } });
  if (!response.ok) throw new Error(`MSA public home returned HTTP ${response.status}; previous data preserved.`);
  const html = await response.text();
  if (html.length > 4000000) throw new Error("Unexpected MSA response size.");
  return parseMsaPublicHome(html, observedAt);
}
