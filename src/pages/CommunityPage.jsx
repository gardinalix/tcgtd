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

export function CommunityPage({ data, onNavigate, onOpenEvent }) {
  const snapshot = buildCommunitySnapshot(data);
  const recentEvents = snapshot.events.slice(0, 10);
  const activePlayers = snapshot.players.slice(0, 10);
  const coverageReady = snapshot.coverage.geographicEvents > 0;

  return (
    <TacticalPageShell className="community-terminal-page">
      <CommunityNav active="community" onNavigate={onNavigate} />
      <TacticalPageHeader
        eyebrow="SUBSYSTEM 04 // TACTICAL NETWORK"
        title="Community Operations Network"
        subtitle="Events, observed pilots and local scenes connected by normalized records with visible provenance."
      />

      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Events" value={snapshot.coverage.events} detail="Normalized event records." tone="blue" />
        <TacticalSummaryCard label="Results" value={snapshot.coverage.results} detail="Imported standings and deck rows." tone="green" />
        <TacticalSummaryCard label="Players" value={snapshot.coverage.players} detail="Unique observed handles." />
        <TacticalSummaryCard label="Organizers" value={snapshot.coverage.venues} detail="Named in current sources." tone="gold" />
        <TacticalSummaryCard label="Geographic coverage" value={snapshot.coverage.geographicEvents} detail="Events with verified location fields." />
      </TacticalSummaryStrip>

      <section className="community-module-grid">
        <CommunityModule
          code="01"
          title="Events & results"
          detail="Search the competitive archive, open standings and inspect decklists without losing source provenance."
          action="Open event archive"
          onClick={() => onNavigate("events")}
        />
        <CommunityModule
          code="02"
          title="Players do Bandai"
          detail="Aggregate public handles observed in event results; verified account linking remains a separate future step."
          action="Browse players"
          onClick={() => onNavigate("players")}
        />
        <CommunityModule
          code="03"
          title="Stores & weekly finder"
          detail="The finder is ready for venue, address and recurring-schedule data, without inventing missing locations."
          action="Open store finder"
          onClick={() => onNavigate("venues")}
        />
      </section>

      <div className="community-main-grid">
        <TacticalDataPanel title="Latest indexed events" subtitle="Most recent normalized records." className="community-main-grid__events">
          <div className="community-event-list">
            {recentEvents.map((event) => (
              <button key={event.eventId} type="button" onClick={() => onOpenEvent(event.eventId)}>
                <time>{formatDate(event.eventDate)}</time>
                <span><strong>{event.eventName}</strong><small>{event.organizer || event.sourceName || "Source not named"}</small></span>
                <em>{snapshot.resultsByEvent.get(event.eventId) || 0} results</em>
              </button>
            ))}
          </div>
        </TacticalDataPanel>

        <TacticalDataPanel title="Most active observed players" subtitle="Activity reflects imported event rows, not an official Bandai rating.">
          <div className="community-player-compact-list">
            {activePlayers.map((player, index) => (
              <span key={player.id}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span><strong>{player.displayName}</strong><small>{player.eventCount} events · {player.topCuts} Top 8</small></span>
                <em>{player.wins} wins</em>
              </span>
            ))}
          </div>
        </TacticalDataPanel>
      </div>

      <aside className={`community-coverage-callout${coverageReady ? " is-ready" : ""}`}>
        <div>
          <TacticalStatusBadge tone={coverageReady ? "green" : "gold"}>{coverageReady ? "GEOGRAPHY ONLINE" : "GEOGRAPHY PENDING"}</TacticalStatusBadge>
          <strong>{coverageReady ? "Verified map records are available." : "The current snapshot has no city, country, address or coordinates."}</strong>
          <p>The store map will only publish markers backed by a declared source and last-verified date.</p>
        </div>
        <a href="https://www.gundam-gcg.com/en/events/" target="_blank" rel="noreferrer">Open official event information</a>
      </aside>
    </TacticalPageShell>
  );
}

function CommunityModule({ code, title, detail, action, onClick }) {
  return (
    <article className="community-module-card">
      <span>{code}</span>
      <h2>{title}</h2>
      <p>{detail}</p>
      <button type="button" onClick={onClick}>{action}</button>
    </article>
  );
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}
