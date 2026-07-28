import {
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";

export function SettingsPage({ theme, data }) {
  return (
    <TacticalPageShell className="settings-terminal-page">
      <TacticalPageHeader
        eyebrow="Settings"
        title="Cockpit settings"
        subtitle="User preferences, data status and production-readiness checks."
      />
      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Theme" value={theme.label} detail={theme.mode} tone="blue" />
        <TacticalSummaryCard label="Cards snapshot" value={data.cardSnapshotGeneratedAt || "-"} detail="Official Bandai data snapshot." />
        <TacticalSummaryCard label="Meta snapshot" value={data.metaSnapshotGeneratedAt || "-"} detail="Event/decklist data snapshot." />
        <TacticalSummaryCard label="Data mode" value="Static JSON + SQLite seed" detail="Ready for backend/API connection." />
      </TacticalSummaryStrip>
    </TacticalPageShell>
  );
}
