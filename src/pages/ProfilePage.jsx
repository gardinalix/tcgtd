import {
  TacticalPageHeader,
  TacticalPageShell,
  TacticalSummaryCard,
  TacticalSummaryStrip,
} from "../components/tactical/TacticalPageShell";

export function ProfilePage({ user, decks, onLogout, onAccountSettings, onLogin }) {
  const userDecks = (decks || []).filter((deck) => deck.ownerId === user?.id);
  const publishedDecks = userDecks.filter((deck) => deck.visibility === "public");

  if (!user) {
    return (
      <TacticalPageShell>
        <TacticalPageHeader
          eyebrow="Pilot profile"
          title="Visitor session"
          subtitle="Login to synchronize private and published deck lists."
          actions={<button type="button" onClick={onLogin}>Open access terminal</button>}
        />
      </TacticalPageShell>
    );
  }

  return (
    <TacticalPageShell className="profile-terminal-page">
      <TacticalPageHeader
        eyebrow="Pilot profile"
        title={user.publicName || user.displayName}
        subtitle={`${user.email} :: ${user.provider || "email"}`}
        actions={(
          <div className="button-row">
          <button type="button" onClick={onAccountSettings}>Account settings</button>
          <button type="button" onClick={onLogout}>Logout</button>
          </div>
        )}
      />

      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Saved decks" value={userDecks.length} detail="Private and public lists." />
        <TacticalSummaryCard label="Published decks" value={publishedDecks.length} detail="Community visible." />
        <TacticalSummaryCard label="Created" value={formatDate(user.createdAt)} detail={`Last login: ${formatDate(user.lastLoginAt)}`} />
      </TacticalSummaryStrip>
    </TacticalPageShell>
  );
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}
