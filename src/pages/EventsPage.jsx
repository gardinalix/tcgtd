import { useMemo, useState } from "react";
import { CommunityNav } from "../components/community/CommunityNav";
import {
  TacticalBreakdownPanel,
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalStatusBadge,
  TacticalSummaryCard,
  TacticalSummaryStrip,
  TacticalTable,
} from "../components/tactical/TacticalPageShell";
import { buildCommunitySnapshot } from "../domain/community";
import { eventBreakdown } from "../domain/meta";

export function EventsPage({ data, onOpenEvent, onNavigate }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("Any");
  const [status, setStatus] = useState("Any");
  const [type, setType] = useState("Any");
  const snapshot = useMemo(() => buildCommunitySnapshot(data), [data]);
  const breakdown = useMemo(() => eventBreakdown(data.metaEvents || [], data.metaResults || []), [data]);
  const sources = ["Any", ...uniqueValues(snapshot.events.map((event) => event.sourceName))];
  const statuses = ["Any", ...uniqueValues(snapshot.events.map((event) => event.officialStatus))];
  const types = ["Any", ...uniqueValues(snapshot.events.map((event) => event.eventType))];
  const events = snapshot.events.filter((event) => {
    const haystack = [event.eventName, event.formatName, event.eventType, event.sourceName, event.organizer].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase())
      && (source === "Any" || event.sourceName === source)
      && (status === "Any" || event.officialStatus === status)
      && (type === "Any" || event.eventType === type);
  });
  const latestEvent = events[0];
  const topColor = breakdown.colorBreakdown[0];
  const topArchetype = breakdown.archetypeBreakdown[0];

  return (
    <TacticalPageShell className="events-terminal-page">
      <CommunityNav active="events" onNavigate={onNavigate} />
      <TacticalPageHeader
        eyebrow="Community / events"
        title="Events & results"
        subtitle="Searchable tournament history with standings, decklists and source coverage kept together."
        actions={(
          <div className="community-filter-row community-filter-row--events">
            <input value={query} placeholder="Event, organizer, format..." onChange={(event) => setQuery(event.target.value)} />
            <select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Filter by source">
              {sources.map((value) => <option key={value}>{value}</option>)}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
              {statuses.map((value) => <option key={value}>{value}</option>)}
            </select>
            <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by event type">
              {types.map((value) => <option key={value}>{value}</option>)}
            </select>
          </div>
        )}
      />

      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Events" value={events.length} detail="Records matching current filters." tone="blue" />
        <TacticalSummaryCard label="Results" value={(data.metaResults || []).length} detail="Normalized competitive rows." />
        <TacticalSummaryCard label="Top color" value={topColor?.label || "-"} detail={topColor ? `${topColor.count} appearances` : "No color data."} tone="green" />
        <TacticalSummaryCard label="Top archetype" value={topArchetype?.label || "-"} detail={topArchetype ? `${topArchetype.count} appearances` : "No archetype data."} />
        <TacticalSummaryCard label="Latest" value={formatDate(latestEvent?.eventDate) || "-"} detail={latestEvent?.eventName || "No event detected."} tone="gold" />
      </TacticalSummaryStrip>

      <div className="tactical-main-grid tactical-main-grid--events community-events-layout">
        <TacticalDataPanel title={`${events.length} events`} subtitle="Imported and normalized event records." className="tactical-main-grid__wide">
          <TacticalTable
            columns={["Date", "Event", "Organizer", "Type", "Players", "Results", "Coverage"]}
            rows={events}
            renderRow={(event) => {
              const resultCount = snapshot.resultsByEvent.get(event.eventId) || 0;
              return (
                <tr key={event.eventId}>
                  <td><time>{formatDate(event.eventDate)}</time></td>
                  <td>
                    <button type="button" className="inline-link-button" onClick={() => onOpenEvent(event.eventId)}>
                      {event.eventName}
                    </button>
                    <small className="event-row-source">{event.formatName || event.sourcePageTitle || "Format not sourced"}</small>
                  </td>
                  <td>{event.organizer || "-"}</td>
                  <td>{event.eventType || "-"}</td>
                  <td>{event.playerCount || "-"}</td>
                  <td><strong>{resultCount}</strong></td>
                  <td>
                    <TacticalStatusBadge tone={resultCount ? "green" : "neutral"}>{resultCount ? "STANDINGS" : "EVENT ONLY"}</TacticalStatusBadge>
                    {event.sourceUrl ? <a className="event-source-link" href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceName || "Source"}</a> : null}
                  </td>
                </tr>
              );
            }}
          />
        </TacticalDataPanel>

        <div className="tactical-side-terminal">
          <TacticalBreakdownPanel title="Color breakdown" rows={breakdown.colorBreakdown} subtitle="Most represented color combinations." />
          <TacticalBreakdownPanel title="Archetype breakdown" rows={breakdown.archetypeBreakdown} subtitle="Deck families detected from results." />
          <TacticalDataPanel title="Latest results" subtitle={`${(data.metaResults || []).length} normalized result rows.`}>
            <div className="cockpit-list">
              {(data.metaResults || []).slice().sort((left, right) => String(right.eventDate).localeCompare(String(left.eventDate))).slice(0, 12).map((result) => (
                <span key={result.resultId} className="cockpit-list-row">
                  <strong>{result.placingLabel || "-"} · {result.playerName || "Unknown player"}</strong>
                  <span>{result.archetype || "Unclassified"} · {result.eventName}</span>
                </span>
              ))}
            </div>
          </TacticalDataPanel>
        </div>
      </div>
    </TacticalPageShell>
  );
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}
