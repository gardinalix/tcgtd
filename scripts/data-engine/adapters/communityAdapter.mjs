import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { validateContribution } from "../../../src/domain/communityContribution.js";

const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function contributionId(value) {
  const event = value.event;
  return `community-${hash([event.name.toLowerCase(), event.date, event.organizer.toLowerCase(), event.country, event.city.toLowerCase()]).slice(0, 20)}`;
}

export function contributionToLegacy(input, reviewedAt) {
  const validation = validateContribution(input);
  if (!validation.valid || !Number.isFinite(Date.parse(reviewedAt))) throw new Error(`Invalid community contribution: ${validation.errors.join(" ")}`);
  const value = validation.value;
  const eventId = contributionId(value);
  const common = { event_id: eventId, event_name: value.event.name, event_date: value.event.date,
    format_name: value.event.format, source_name: "Community stores", source_url: value.event.sourceUrl,
    player_count: value.event.playerCount ?? "",
    community_provenance: { retrieved_at: reviewedAt, content_hash: hash(value) },
  };
  return {
    events: [{ ...common, organizer: value.event.organizer, country: value.event.country, city: value.event.city }],
    results: value.results.map(row => ({ ...common, result_id: `${eventId}-${hash(row.playerName.toLowerCase()).slice(0, 12)}`,
      player_name: row.playerName, placing_rank: row.placement, placing_label: String(row.placement), archetype: row.archetype,
      deck_id: "", deck_url: row.deckUrl, has_decklist: "FALSE", // A URL is not an indexed card list.
    })),
  };
}

export async function readReviewedContributions(directory) {
  let entries;
  try { entries = await fs.readdir(directory); } catch (error) { if (error.code === "ENOENT") return { events: [], results: [] }; throw error; }
  const combined = { events: [], results: [] };
  for (const name of entries.filter(name => name.endsWith(".json")).sort()) {
    const record = JSON.parse(await fs.readFile(path.join(directory, name), "utf8"));
    if (record.status !== "reviewed" || !record.reviewedAt) throw new Error(`Unreviewed contribution in accepted source directory: ${name}`);
    const rows = contributionToLegacy(record, record.reviewedAt);
    combined.events.push(...rows.events);
    combined.results.push(...rows.results);
  }
  return combined;
}
