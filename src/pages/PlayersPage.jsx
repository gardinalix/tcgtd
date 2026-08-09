import { useMemo, useState } from "react";
import { CommunityNav } from "../components/community/CommunityNav";
import {
  TacticalPageHeader,
  TacticalPageShell,
  TacticalStatusBadge,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";
import { buildCommunitySnapshot } from "../domain/community";

export function PlayersPage({ data, onNavigate }) {
  const snapshot = useMemo(() => buildCommunitySnapshot(data), [data]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("activity");
  const players = useMemo(() => snapshot.players
    .filter((player) => `${player.displayName} ${player.archetypes.map((item) => item.label).join(" ")}`.toLowerCase().includes(query.toLowerCase()))
    .sort((left, right) => {
      if (sort === "wins") return right.wins - left.wins || right.eventCount - left.eventCount;
      if (sort === "name") return left.displayName.localeCompare(right.displayName);
      if (sort === "recent") return String(right.latestEventDate).localeCompare(String(left.latestEventDate));
      return right.eventCount - left.eventCount || right.topCuts - left.topCuts;
    }), [snapshot.players, query, sort]);

  return (
    <TacticalPageShell className="players-terminal-page">
      <CommunityNav active="players" onNavigate={onNavigate} />
      <TacticalPageHeader
        eyebrow="Community / players"
        title="Players do Bandai"
        subtitle="Public handles observed in normalized tournament records. A checkmark will only appear after a player explicitly claims and verifies an account."
        actions={(
          <div className="community-filter-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player or archetype..." />
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort players">
              <option value="activity">Most active</option>
              <option value="wins">Most wins</option>
              <option value="recent">Recently seen</option>
              <option value="name">A–Z</option>
            </select>
          </div>
        )}
      />
      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Observed players" value={snapshot.players.length} tone="blue" />
        <TacticalSummaryCard label="Matching scan" value={players.length} tone="green" />
        <TacticalSummaryCard label="Linked Bandai IDs" value="0" detail="No verified identity source loaded." tone="gold" />
        <TacticalSummaryCard label="Event rows" value={snapshot.results.length} />
      </TacticalSummaryStrip>

      <section className="community-player-grid">
        {players.slice(0, 160).map((player) => (
          <article key={player.id} className="community-player-card">
            <span className="community-player-card__avatar" aria-hidden="true">{player.displayName.slice(0, 1).toUpperCase()}</span>
            <div>
              <span><TacticalStatusBadge tone={player.bandaiLinked ? "green" : "neutral"}>{player.bandaiLinked ? "VERIFIED" : "OBSERVED"}</TacticalStatusBadge></span>
              <h2>{player.displayName}</h2>
              <p>{player.archetypes.map((item) => item.label).join(" · ") || "No archetype loaded"}</p>
              <dl>
                <div><dt>Events</dt><dd>{player.eventCount}</dd></div>
                <div><dt>Wins</dt><dd>{player.wins}</dd></div>
                <div><dt>Top 8</dt><dd>{player.topCuts}</dd></div>
                <div><dt>Best</dt><dd>{player.bestFinish ? `#${player.bestFinish}` : "-"}</dd></div>
              </dl>
              <small>Last seen {formatDate(player.latestEventDate)} · {player.sources.join(" / ") || "source unknown"}</small>
            </div>
          </article>
        ))}
      </section>
    </TacticalPageShell>
  );
}

function formatDate(value) {
  return value ? String(value).slice(0, 10) : "-";
}
