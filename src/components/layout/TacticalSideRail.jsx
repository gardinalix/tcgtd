const RAIL_GROUPS = [
  {
    label: "ARCHIVE",
    items: [
      { view: "cards", code: "AR", label: "Cards", match: ["cards", "card", "synergy", "synergyMap"] },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { view: "decks", code: "FG", label: "Forge", match: ["decks", "builder", "deckView", "importExport"] },
      { view: "meta", code: "FI", label: "Field Intel", match: ["meta", "prices"] },
      { view: "previews", code: "SG", label: "Signals", match: ["previews"] },
    ],
  },
  {
    label: "NETWORK",
    items: [
      { view: "community", code: "NW", label: "Overview", match: ["community", "contribute"] },
      { view: "events", code: "EV", label: "Events", match: ["events", "eventDetail"] },
      { view: "players", code: "PL", label: "Players", match: ["players"] },
      { view: "venues", code: "VN", label: "Venues", match: ["venues"] },
    ],
  },
];

export function TacticalSideRail({ view, activeFormat = "CURRENT", onViewChange }) {
  return (
    <aside className="tactical-side-rail" aria-label="Tactical subsystems">
      <div className="tactical-side-rail__status">
        <span><i /> OPS CORE</span>
        <strong>ONLINE</strong>
      </div>
      <nav>
        {RAIL_GROUPS.map((group) => (
          <section key={group.label} className="tactical-side-rail__group">
            <h2>{group.label}</h2>
            {group.items.map((item) => {
              const isActive = item.match.includes(view);
              return (
                <button
                  key={item.view}
                  type="button"
                  className={isActive ? "is-active" : ""}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onViewChange(item.view)}
                >
                  <span>{item.code}</span>
                  <strong>{item.label}</strong>
                  <i aria-hidden="true" />
                </button>
              );
            })}
          </section>
        ))}
      </nav>
      <div className="tactical-side-rail__scope">
        <small>ACTIVE SCOPE</small>
        <strong>{activeFormat}</strong>
        <span>DATA LINK // SECURE</span>
      </div>
    </aside>
  );
}
