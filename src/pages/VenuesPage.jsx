import { useMemo, useState } from "react";
import { CommunityNav } from "../components/community/CommunityNav";
import {
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalStatusBadge,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";
import { buildCommunitySnapshot } from "../domain/community";

export function VenuesPage({ data, onNavigate }) {
  const snapshot = useMemo(() => buildCommunitySnapshot(data), [data]);
  const [query, setQuery] = useState("");
  const venues = snapshot.venues.filter((venue) => `${venue.name} ${venue.cities.join(" ")} ${venue.countries.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const mapped = venues.filter((venue) => venue.hasGeography);

  return (
    <TacticalPageShell className="venues-terminal-page">
      <CommunityNav active="venues" onNavigate={onNavigate} />
      <TacticalPageHeader
        eyebrow="Community / local scene"
        title="Stores & weekly finder"
        subtitle="Searchable venue and recurring-event structure with explicit geographic coverage. No inferred or fabricated markers."
        actions={<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Store, city, state or country..." />}
      />
      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Named organizers" value={snapshot.venues.length} tone="blue" />
        <TacticalSummaryCard label="Mapped venues" value={mapped.length} tone={mapped.length ? "green" : "gold"} />
        <TacticalSummaryCard label="Countries" value={new Set(mapped.flatMap((venue) => venue.countries)).size} />
        <TacticalSummaryCard label="Weekly schedules" value="0" detail="Recurring feed not connected yet." />
      </TacticalSummaryStrip>

      <div className="venue-finder-grid">
        <section className="venue-map-shell" aria-label="Store map coverage">
          <div className="venue-map-shell__grid" aria-hidden="true" />
          <div className="venue-map-shell__message">
            <TacticalStatusBadge tone={mapped.length ? "green" : "gold"}>{mapped.length ? "MAP DATA ONLINE" : "MAP DATA REQUIRED"}</TacticalStatusBadge>
            <strong>{mapped.length ? `${mapped.length} verified venue records ready for plotting.` : "Current event sources do not include addresses or coordinates."}</strong>
            <p>The map layer is intentionally empty until venue records include city, country, latitude, longitude, source URL and last verification date.</p>
            <a href="https://www.gundam-gcg.com/en/events/" target="_blank" rel="noreferrer">Check current official event information</a>
          </div>
        </section>

        <TacticalDataPanel title={`${venues.length} organizers`} subtitle="Names extracted from the event sources currently synchronized.">
          <div className="venue-directory-list">
            {venues.map((venue) => (
              <article key={venue.id}>
                <span>{venue.online ? "ONLINE" : venue.countries[0] || "LOCATION PENDING"}</span>
                <h2>{venue.name}</h2>
                <p>{venue.cities.join(", ") || "No verified city in the current snapshot."}</p>
                <dl>
                  <div><dt>Events</dt><dd>{venue.eventCount}</dd></div>
                  <div><dt>Results</dt><dd>{venue.resultCount}</dd></div>
                  <div><dt>Largest field</dt><dd>{venue.playerCapacityObserved || "-"}</dd></div>
                  <div><dt>Latest</dt><dd>{venue.latestEventDate || "-"}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </TacticalDataPanel>
      </div>
    </TacticalPageShell>
  );
}
