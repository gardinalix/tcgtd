import { useMemo, useState } from "react";
import {
  TacticalBreakdownPanel,
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
  TacticalTable,
} from "../components/tactical/TacticalPageShell";
import { eventBreakdown } from "../domain/meta";

export function EventsPage({ data, onOpenEvent }) {
  const [query, setQuery] = useState("");
  const breakdown = useMemo(() => eventBreakdown(data.metaEvents || [], data.metaResults || []), [data]);
  const events = breakdown.recentEvents.filter((event) => [event.eventName, event.formatName, event.eventType, event.sourceName].join(" ").toLowerCase().includes(query.toLowerCase()));
  const latestEvent = events[0];
  const topColor = breakdown.colorBreakdown[0];
  const topArchetype = breakdown.archetypeBreakdown[0];

  return (
    <TacticalPageShell className="events-terminal-page">
      <TacticalPageHeader
        eyebrow="Event Feed"
        title="Competitive event archive"
        subtitle="Coverage, decklists, result history and automatic breakdowns by color and archetype."
        actions={<input value={query} placeholder="Filter event, format, type..." onChange={(event) => setQuery(event.target.value)} />}
      />

      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Events" value={events.length} detail="Records matching current scan." tone="blue" />
        <TacticalSummaryCard label="Decklists" value={(data.metaResults || []).length} detail="Normalized competitive rows." />
        <TacticalSummaryCard label="Top color" value={topColor?.label || "-"} detail={topColor ? `${topColor.count} appearances` : "No color data."} tone="green" />
        <TacticalSummaryCard label="Top archetype" value={topArchetype?.label || "-"} detail={topArchetype ? `${topArchetype.count} appearances` : "No archetype data."} />
        <TacticalSummaryCard label="Latest" value={latestEvent?.eventDate || "-"} detail={latestEvent?.eventName || "No event detected."} tone="gold" />
      </TacticalSummaryStrip>

      <div className="tactical-main-grid tactical-main-grid--events">
        <TacticalDataPanel title={`${events.length} events`} subtitle="Imported and normalized event records." className="tactical-main-grid__wide">
          <TacticalTable
            columns={["Date", "Event", "Type", "Format", "Players", "Source"]}
            rows={events}
            renderRow={(event) => (
              <tr key={event.eventId}>
                <td>{event.eventDate}</td>
                <td>
                  <button type="button" className="inline-link-button" onClick={() => onOpenEvent(event.eventId)}>
                    {event.eventName}
                  </button>
                </td>
                <td>{event.eventType}</td>
                <td>{event.formatName}</td>
                <td>{event.playerCount}</td>
                <td>{event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceName}</a> : event.sourceName}</td>
              </tr>
            )}
          />
        </TacticalDataPanel>

        <div className="tactical-side-terminal">
          <TacticalBreakdownPanel title="Color breakdown" rows={breakdown.colorBreakdown} subtitle="Most represented color combinations." />
          <TacticalBreakdownPanel title="Archetype breakdown" rows={breakdown.archetypeBreakdown} subtitle="Deck families detected from results." />
          <TacticalDataPanel title="Latest decklists" subtitle={`${(data.metaResults || []).length} normalized results.`}>
            <div className="cockpit-list">
              {(data.metaResults || []).slice(0, 12).map((result) => (
                <span key={result.resultId} className="cockpit-list-row">
                  <strong>{result.placingLabel} {result.archetype}</strong>
                  <span>{result.colorCombination}</span>
                </span>
              ))}
            </div>
          </TacticalDataPanel>
        </div>
      </div>
    </TacticalPageShell>
  );
}
