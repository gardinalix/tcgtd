import { useMemo } from "react";
import {
  TacticalEmptyState,
  TacticalPageHeader,
  TacticalPageShell,
} from "../components/tactical/TacticalPageShell";

const COLOR_TONES = {
  blue: "#00a8ff",
  white: "#dff7ff",
  purple: "#8f4dff",
  red: "#ff344d",
  green: "#27f0a3",
  yellow: "#ffd32a",
  other: "#14415f",
  unknown: "#14415f",
};

export function EventDetailPage({ data, eventId, onBack, onOpenDeck, onSendToForge }) {
  const event = (data.metaEvents || []).find((row) => row.eventId === eventId);
  const results = useMemo(
    () => (data.metaResults || [])
      .filter((row) => row.eventId === eventId)
      .sort((left, right) => Number(left.placingRank || 999) - Number(right.placingRank || 999)),
    [data.metaResults, eventId],
  );
  const winner = results[0];
  const display = event ? normalizeEventDisplay(event) : null;
  const colorBreakdown = useMemo(() => buildColorBreakdown(results), [results]);
  const archetypeBreakdown = useMemo(() => countBy(results, "archetype"), [results]);
  const topCut = event?.topCut || event?.topCutSize || (results.length ? `Top ${Math.min(results.length, 8)}` : "Not sourced");

  if (!event) {
    return (
      <TacticalPageShell>
        <TacticalPageHeader
          eyebrow="Event dossier"
          title="Event not found"
          subtitle="No event matched this tactical id."
          onBack={onBack}
          backLabel="Back to events"
        />
      </TacticalPageShell>
    );
  }

  return (
    <TacticalPageShell className="event-dossier-page event-dossier-v2">
      <section className="event-dossier-frame">
        <header className="event-dossier-hero">
          <div className="event-dossier-hero__copy">
            <span className="event-dossier-kicker">Event dossier</span>
            <h1>{event.eventName}</h1>
            <p>{display.date} / {display.format} / {display.playersLabel} / {event.officialStatus || "community"}.</p>
            <div className="event-dossier-actions">
              <button type="button" onClick={onBack}>Back to events</button>
              {event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer">Source coverage</a> : null}
            </div>
          </div>
          <span className="event-dossier-id">ID: {event.eventId}</span>
        </header>

        <div className="event-dossier-grid">
          <aside className="event-dossier-rail event-dossier-rail--left">
            <DossierInfoCard
              title="Winner"
              primary={winner?.playerName || "Not available"}
              secondary={winner?.archetype || "No winner row linked."}
              icon="crest"
            />
            <DossierInfoCard
              title="Format"
              primary={display.format}
              secondary={`${display.playersLabel} / ${event.officialStatus || "community"}`}
              icon="format"
            />
            <DossierInfoCard
              title="Type"
              primary={display.type}
              secondary={event.sourceName || "Source not recorded"}
              icon="globe"
            />
          </aside>

          <section className="event-dossier-results-panel">
            <div className="event-dossier-panel-head">
              <div>
                <span>Decklists & results</span>
                <p>{results.length} result row(s) associated with this event.</p>
              </div>
            </div>
            {results.length ? (
              <div className="event-dossier-table-wrap">
                <table className="event-dossier-table">
                  <thead>
                    <tr>
                      <th>Place</th>
                      <th>Player</th>
                      <th>Deck</th>
                      <th>Colors</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result) => (
                      <tr key={result.resultId}>
                        <td>{result.placingLabel || result.placingRank || "-"}</td>
                        <td>{result.playerName || "-"}</td>
                        <td>{result.archetype || "-"}</td>
                        <td><ColorDots value={result.colorCombination} /></td>
                        <td>
                          <div className="event-dossier-table-actions">
                            {result.deckId ? <button type="button" onClick={() => onOpenDeck(result.deckId)}>View</button> : null}
                            {result.deckId ? <button type="button" className="is-forge" onClick={() => onSendToForge?.(result, "current")}>Enviar para a FORJA</button> : null}
                            {result.deckUrl ? <a href={result.deckUrl} target="_blank" rel="noreferrer">External</a> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <TacticalEmptyState title="No decklists linked" detail="This event exists, but no normalized deck rows are linked yet." />
            )}
          </section>

          <aside className="event-dossier-rail event-dossier-rail--right">
            <DossierDonutPanel title="Color breakdown" subtitle="Automatic breakdown for this event." rows={colorBreakdown} />
            <DossierBarPanel title="Archetype breakdown" subtitle="Deck families detected from associated results." rows={archetypeBreakdown} />
          </aside>
        </div>

        <footer className="event-dossier-info-strip">
          <DossierInfoMetric label="Date" value={display.date} icon="calendar" />
          <DossierInfoMetric label="Location" value={display.location} icon="pin" />
          <DossierInfoMetric label="Region" value={display.region} icon="target" />
          <DossierInfoMetric label="Players" value={display.players} icon="users" />
          <DossierInfoMetric label="Top cut" value={topCut} icon="cut" />
          <DossierInfoMetric label="Source" value={event.sourceName || "Community"} icon="source" />
        </footer>
      </section>
    </TacticalPageShell>
  );
}

function DossierInfoCard({ title, primary, secondary, icon }) {
  return (
    <article className="event-dossier-info-card">
      <div>
        <span>{title}</span>
        <strong>{primary}</strong>
        <p>{secondary}</p>
      </div>
      <SystemIcon type={icon} />
    </article>
  );
}

function DossierDonutPanel({ title, subtitle, rows }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <section className="event-dossier-breakdown event-dossier-breakdown--donut">
      <div className="event-dossier-panel-head">
        <div>
          <span>{title}</span>
          <p>{subtitle}</p>
        </div>
      </div>
      {rows.length ? (
        <div className="event-dossier-donut-layout">
          <div className="event-dossier-donut" style={{ "--event-donut": buildDonutGradient(rows) }} aria-hidden="true" />
          <div className="event-dossier-legend">
            {rows.slice(0, 6).map((row) => (
              <span key={row.label}>
                <i className={`event-color-dot event-color-dot--${colorClass(row.label)}`} style={{ "--dot-color": row.color }} />
                <strong>{row.label}</strong>
                <em>{row.count} ({percent(row.count, total)}%)</em>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <TacticalEmptyState title="No color signal" detail="Deck colors appear after results are linked." />
      )}
    </section>
  );
}

function DossierBarPanel({ title, subtitle, rows }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <section className="event-dossier-breakdown">
      <div className="event-dossier-panel-head">
        <div>
          <span>{title}</span>
          <p>{subtitle}</p>
        </div>
      </div>
      {rows.length ? (
        <div className="event-dossier-bars">
          {rows.slice(0, 8).map((row) => (
            <span key={row.label}>
              <strong>{row.label}</strong>
              <i><b style={{ width: `${percent(row.count, total)}%` }} /></i>
              <em>{row.count} ({percent(row.count, total)}%)</em>
            </span>
          ))}
        </div>
      ) : (
        <TacticalEmptyState title="No archetype signal" detail="Archetypes appear after decklists are imported." />
      )}
    </section>
  );
}

function DossierInfoMetric({ label, value, icon }) {
  return (
    <span className="event-dossier-info-metric">
      <SystemIcon type={icon} />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </span>
  );
}

function ColorDots({ value }) {
  const colors = parseColors(value);
  return (
    <span className="event-color-dots" title={value || "Unknown"}>
      {colors.length ? colors.map((color) => (
        <i
          key={color}
          className={`event-color-dot event-color-dot--${colorClass(color)}`}
          style={{ "--dot-color": colorFor(color) }}
        />
      )) : null}
      <em>{value || "-"}</em>
    </span>
  );
}

function SystemIcon({ type }) {
  return <span className={`event-system-icon event-system-icon--${type || "default"}`} aria-hidden="true" />;
}

function buildColorBreakdown(rows) {
  const counts = rows.reduce((acc, row) => {
    const colors = parseColors(row.colorCombination);
    if (!colors.length) {
      acc.Other = (acc.Other || 0) + 1;
      return acc;
    }
    for (const color of colors) {
      acc[color] = (acc[color] || 0) + 1;
    }
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count, color: colorFor(label) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function normalizeEventDisplay(event) {
  const sourceTitleFormat = extractFormat(event.sourcePageTitle);
  const eventTypeFormat = extractFormat(event.eventType);
  const eventFormat = extractFormat(event.formatName);
  const format = eventFormat || sourceTitleFormat || eventTypeFormat || "Not sourced";
  const type = looksLikeEventType(event.eventType)
    ? event.eventType
    : looksLikeEventType(event.formatName)
      ? event.formatName
      : event.eventType || "Not sourced";
  const regionTag = extractRegion(event.eventType) || extractRegion(event.formatName);
  return {
    date: event.eventDate || "Not sourced",
    format,
    type,
    players: event.playerCount || "Not sourced",
    playersLabel: event.playerCount ? `${event.playerCount} players` : "players not sourced",
    location: event.location || event.city || event.organizer || "Not sourced",
    region: event.country || regionLabel(regionTag) || "Not sourced",
  };
}

function extractFormat(value = "") {
  return String(value).match(/\b(?:GD|ST|EX|PR)\d{2}\b/i)?.[0]?.toUpperCase() || "";
}

function extractRegion(value = "") {
  return String(value).match(/\b(?:JPN|ENG|NA|EU|LATAM|BR)\b/i)?.[0]?.toUpperCase() || "";
}

function looksLikeEventType(value = "") {
  return /\b(event|tournament|challenge|battle|qualifier|locals)\b/i.test(String(value));
}

function regionLabel(region = "") {
  return {
    JPN: "Japan",
    ENG: "English",
    NA: "North America",
    EU: "Europe",
    LATAM: "LATAM",
    BR: "Brazil",
  }[region] || "";
}

function countBy(rows, key) {
  return Object.entries(rows.reduce((acc, row) => {
    const value = row[key] || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {}))
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function parseColors(value = "") {
  const known = ["Blue", "White", "Purple", "Red", "Green", "Yellow"];
  const text = String(value).replace(/[+/,-]/g, " ");
  const found = known.filter((color) => new RegExp(`\\b${color}\\b`, "i").test(text));
  return [...new Set(found)];
}

function colorFor(label = "") {
  return COLOR_TONES[String(label).toLowerCase()] || COLOR_TONES.other;
}

function colorClass(label = "") {
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "other";
}

function percent(count, total) {
  return total ? Math.round((count / total) * 100) : 0;
}

function buildDonutGradient(rows) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return COLOR_TONES.other;
  let cursor = 0;
  return rows.map((row) => {
    const start = cursor;
    const size = (row.count / total) * 100;
    cursor += size;
    return `${row.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  }).join(", ");
}
