import { useLocale } from "../../i18n/LocaleProvider";

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
      { view: "decks", code: "FG", label: "Forge", match: ["decks", "builder", "deckView"] },
      { view: "meta", code: "FI", label: "Field Intel", match: ["meta"] },
      { view: "prices", code: "MK", label: "Market", match: ["prices"] },
      { view: "previews", code: "SG", label: "Signals", match: ["previews"] },
    ],
  },
  {
    label: "NETWORK",
    items: [
      { view: "community", code: "NW", label: "Overview", match: ["community", "contribute"] },
      { view: "events", code: "EV", label: "Events", match: ["events", "eventDetail"] },
      { view: "players", code: "PL", label: "Players", match: ["players"] },
      { view: "venues", code: "VN", label: "Venues", match: ["venues", "scheduleManager"] },
    ],
  },
  { label: "SYSTEM", items: [
    { view: "importExport", code: "IO", label: "Import / Export", match: ["importExport"] },
    { view: "settings", code: "SY", label: "Settings", match: ["settings", "accountSettings", "profile"] },
  ] },
];

const PT_LABELS = { Cards: "Cartas", Forge: "Forja", "Field Intel": "Intel do campo", Signals: "Sinais", Overview: "Visão geral", Events: "Eventos", Players: "Jogadores", Venues: "Lojas / Agenda", Market: "Mercado", Settings: "Sistema", "Import / Export": "Import / Export" };

export function TacticalSideRail({ view, activeFormat = "CURRENT", onViewChange }) {
  const { locale } = useLocale();
  const pt = locale === "pt-BR";
  return (
    <aside className="hud-sidebar" aria-label="Tactical subsystems">
      <div className="hud-sidebar__status">
        <span><i /> OPS CORE</span>
        <strong>GCG</strong>
      </div>
      <nav>
        {RAIL_GROUPS.map((group) => (
          <section key={group.label} className="hud-sidebar__group">
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
                  <strong>{pt ? PT_LABELS[item.label] || item.label : item.label}</strong>
                  <i aria-hidden="true" />
                </button>
              );
            })}
          </section>
        ))}
      </nav>
      <div className="hud-sidebar__scope">
        <small>ACTIVE SCOPE</small>
        <strong>{activeFormat}</strong>
        <span>GUNDAM CARD GAME</span>
      </div>
    </aside>
  );
}
