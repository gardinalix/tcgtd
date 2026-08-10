import { useEffect, useMemo, useState } from "react";
import { CommunityNav } from "../components/community/CommunityNav";
import {
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalStatusBadge,
  TacticalTable,
} from "../components/tactical/TacticalPageShell";
import { buildCommunitySnapshot } from "../domain/community";
import { eventBreakdown } from "../domain/meta";

const EVENT_PAGE_SIZE = 48;

export function EventsPage({ data, onOpenEvent, onNavigate }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("Any");
  const [status, setStatus] = useState("Any");
  const [type, setType] = useState("Any");
  const [visibleCount, setVisibleCount] = useState(EVENT_PAGE_SIZE);
  const snapshot = useMemo(() => buildCommunitySnapshot(data), [data]);
  const breakdown = useMemo(() => eventBreakdown(data.metaEvents || [], data.metaResults || []), [data]);
  const latestResults = useMemo(
    () => (data.metaResults || [])
      .slice()
      .sort((left, right) => String(right.eventDate).localeCompare(String(left.eventDate)))
      .slice(0, 8),
    [data],
  );
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
  const visibleEvents = events.slice(0, visibleCount);
  const latestEvent = events[0];
  const topColor = breakdown.colorBreakdown[0];
  const topArchetype = breakdown.archetypeBreakdown[0];

  useEffect(() => {
    setVisibleCount(EVENT_PAGE_SIZE);
  }, [query, source, status, type]);

  return (
    <TacticalPageShell className="events-terminal-page">
      <CommunityNav active="events" onNavigate={onNavigate} />
      <TacticalPageHeader
        eyebrow="SUBSYSTEM 04 // ENGAGEMENT ARCHIVE"
        title="Combat Records"
        subtitle="Searchable tournament history with standings, decklists and source provenance kept in one operational record."
        meta={(
          <div className="events-header-signal" aria-label="Archive status">
            <span><i /> LIVE INDEX</span>
            <strong>{snapshot.events.length} RECORDS SYNCHRONIZED</strong>
          </div>
        )}
      />

      <section className="events-filter-console" aria-label="Event archive filters">
        <header>
          <span>EVENT QUERY // INDEX</span>
          <strong>{events.length} ACQUIRED</strong>
        </header>
        <div>
          <label className="events-filter-console__search">
            <span>SEARCH</span>
            <input
              value={query}
              aria-label="Search event archive"
              placeholder="Event, organizer, format..."
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span>SOURCE</span>
            <select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Filter by source">
              {sources.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>STATUS</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">
              {statuses.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>EVENT TYPE</span>
            <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by event type">
              {types.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="events-signal-strip" role="list" aria-label="Event archive telemetry">
        <EventSignal label="Filtered archive" value={events.length} detail={`${snapshot.events.length} total records`} />
        <EventSignal label="Indexed results" value={(data.metaResults || []).length} detail="normalized competitive rows" />
        <EventSignal label="Dominant field" value={topColor?.label || "-"} detail={topArchetype?.label || "No archetype signal"} tone="green" />
        <EventSignal label="Latest sync" value={formatDate(latestEvent?.eventDate) || "-"} detail={latestEvent?.eventName || "No event detected"} tone="gold" />
      </div>

      <div className="events-operations-layout">
        <TacticalDataPanel
          title="Event transmission log"
          subtitle={`${visibleEvents.length} of ${events.length} matching records online.`}
          className="events-records-station"
          code="EVT/DB"
          mode="matrix"
          actions={<span className="events-sort-readout">DATE ↓ // NEWEST FIRST</span>}
        >
          <TacticalTable
            columns={["Date", "Event", "PL", "RES", "Source"]}
            rows={visibleEvents}
            renderRow={(event) => {
              const resultCount = snapshot.resultsByEvent.get(event.eventId) || 0;
              return (
                <tr key={event.eventId}>
                  <td className="event-date-cell">
                    <time className="event-date-cell__full">{formatDate(event.eventDate)}</time>
                    <time className="event-date-cell__short">{formatShortDate(event.eventDate)}</time>
                  </td>
                  <td className="event-name-cell">
                    <button type="button" className="inline-link-button" onClick={() => onOpenEvent(event.eventId)}>
                      {event.eventName}
                    </button>
                    <small className="event-row-source">{event.formatName || event.sourcePageTitle || "Format not sourced"}</small>
                    <small className="event-row-mobile-meta">{event.organizer || "Unknown organizer"} // {event.eventType || "Unclassified"}</small>
                  </td>
                  <td className="event-count-cell"><span>{event.playerCount || "-"}</span></td>
                  <td className="event-count-cell"><strong>{resultCount}</strong></td>
                  <td className="event-coverage-cell">
                    <TacticalStatusBadge tone={resultCount ? "green" : "neutral"}>{resultCount ? "STANDINGS" : "EVENT ONLY"}</TacticalStatusBadge>
                    {event.sourceUrl ? <a className="event-source-link" href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceName || "Source"}</a> : null}
                  </td>
                </tr>
              );
            }}
          />
          <footer className="events-records-footer">
            <span>SHOWING {visibleEvents.length} / {events.length}</span>
            {visibleEvents.length < events.length ? (
              <button type="button" onClick={() => setVisibleCount((current) => current + EVENT_PAGE_SIZE)}>
                LOAD {Math.min(EVENT_PAGE_SIZE, events.length - visibleEvents.length)} MORE RECORDS
              </button>
            ) : <strong>END OF TRANSMISSION</strong>}
          </footer>
        </TacticalDataPanel>

        <aside className="events-intel-station" aria-label="Event field intelligence">
          <header className="events-intel-station__header">
            <span>FIELD INTEL // DISTRIBUTION</span>
            <strong>LIVE</strong>
          </header>
          <IntelBreakdown title="Color spectrum" rows={breakdown.colorBreakdown} />
          <IntelBreakdown title="Archetype signals" rows={breakdown.archetypeBreakdown} />
          <section className="events-latest-feed">
            <header>
              <span>LATEST RESULTS</span>
              <small>{(data.metaResults || []).length} INDEXED</small>
            </header>
            <div>
              {latestResults.map((result) => (
                <span key={result.resultId} className="events-latest-feed__row">
                  <b>{result.placingLabel || "-"}</b>
                  <strong>{result.playerName || "Unknown player"}</strong>
                  <em>{result.archetype || "Unclassified"}</em>
                  <small>{result.eventName}</small>
                </span>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </TacticalPageShell>
  );
}

function EventSignal({ label, value, detail, tone = "blue" }) {
  return (
    <article className={`events-signal events-signal--${tone}`} role="listitem">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function IntelBreakdown({ title, rows = [], limit = 7 }) {
  const visibleRows = rows.slice(0, limit);
  const maxCount = Math.max(...visibleRows.map((row) => row.count), 1);
  return (
    <section className="events-intel-breakdown">
      <header>
        <span>{title}</span>
        <small>TOP {visibleRows.length}</small>
      </header>
      <div>
        {visibleRows.map((row) => (
          <span key={row.label} className="events-intel-breakdown__row">
            <strong>{row.label}</strong>
            <i aria-hidden="true"><b style={{ width: `${Math.max(4, (row.count / maxCount) * 100)}%` }} /></i>
            <em>{row.count}</em>
          </span>
        ))}
      </div>
    </section>
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

function formatShortDate(value) {
  const formatted = formatDate(value);
  return formatted.replace(/(\d{2}\/\d{2}\/)(\d{2})\d{2}$/, "$1$2");
}
