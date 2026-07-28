import { THEME_OPTIONS } from "../../data/themeConfig";

const NAV_ITEMS = [
  ["cards", "Cards"],
  ["decks", "Decks"],
  ["builder", "Build"],
  ["meta", "Meta"],
  ["events", "Events"],
  ["previews", "Previews"],
];

export function SiteHeader({ view, theme, user, onViewChange, onThemeChange, search, onSearchChange }) {
  const systemStatus = (theme.headerSystem || `${theme.operation || theme.mode || "Tactical System"} Active`).toUpperCase();
  const systemMode = (theme.mode || theme.stateLabel || "Tactical interface").toUpperCase();
  const logoFallback = (theme.label || "G").slice(0, 1).toUpperCase();

  return (
    <header className="site-header panel cockpit-panel cockpit-topbar cockpit-shell-topbar">
      <button className="site-brand zero-brand" type="button" onClick={() => onViewChange("home")}>
        <span className="site-brand__mark zero-brand__seal" data-faction={theme.factionId} aria-label={`${theme.label} emblem`}>
          {theme.factionLogo ? (
            <img
              src={theme.factionLogo}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = "none";
                event.currentTarget.nextElementSibling?.removeAttribute("hidden");
              }}
            />
          ) : null}
          <span className="zero-brand__fallback" hidden={Boolean(theme.factionLogo)}>{logoFallback}</span>
        </span>
        <span>
          <small>{systemStatus}</small>
          <strong>GUNDAM TACTICAL DATABASE</strong>
          <em>{systemMode}</em>
        </span>
      </button>

      <label className="global-search command-input">
        <span>Command input</span>
        <input
          type="search"
          placeholder="Name, number, set, text, trait..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <nav className="site-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "is-active" : ""}
            onClick={() => onViewChange(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="site-header__actions cockpit-pilot-panel">
        <span className="pilot-avatar" aria-hidden="true" />
        <button type="button" className="pilot-label pilot-label-button" onClick={() => onViewChange("profile")}>
          PILOT: {(user?.publicName || theme.pilot).toUpperCase()}
        </button>
        <select className="react-theme-select" value={theme.id} onChange={(event) => onThemeChange(event.target.value)}>
          {THEME_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
