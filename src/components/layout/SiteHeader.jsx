import { useLocale } from "../../i18n/LocaleProvider";
import { translate } from "../../i18n/translations";

const NAV_ITEMS = [
  ["cards", "Archive", "01"],
  ["decks", "Forge", "02"],
  ["meta", "Battlefield", "03"],
  ["community", "Network", "04"],
  ["previews", "Signals", "05"],
];

const NAV_GROUPS = {
  cards: new Set(["cards", "card", "synergy", "synergyMap"]),
  decks: new Set(["decks", "builder", "deckView"]),
  meta: new Set(["meta"]),
  community: new Set(["community", "events", "eventDetail", "players", "venues"]),
  previews: new Set(["previews"]),
};

export function SiteHeader({ view, theme, themeOptions = [], onThemeChange, user, data, onViewChange, onSignIn, search, onSearchChange }) {
  const { locale, setLocale } = useLocale();
  const systemStatus = locale === "pt-BR" ? "REDE TÁTICA ONLINE" : "TACTICAL NETWORK ONLINE";
  const systemMode = locale === "pt-BR" ? "MÓDULO GUNDAM ATIVO" : "GUNDAM MODULE ACTIVE";
  const activeFormat = data?.activeFormat || data?.gameModule?.activeFormat || "GD05";

  return (
    <header className="site-header panel cockpit-panel cockpit-topbar cockpit-shell-topbar">
      <button className="site-brand zero-brand" type="button" onClick={() => onViewChange("home")}>
        <span className="site-brand__mark zero-brand__seal tcgtd-insignia" aria-hidden="true">
          <i className="tcgtd-insignia__orbit" />
          <i className="tcgtd-insignia__axis" />
          <b>TTD</b>
        </span>
        <span>
          <small>{translate(systemStatus)}</small>
          <strong>{translate("TCG TACTICAL DATABASE")}</strong>
          <em>{translate("TCG // TACTICAL DATABASE")} · {translate(systemMode)}</em>
        </span>
      </button>

      <label className="global-search command-input">
        <span>{translate("Command input")}</span>
        <input
          type="search"
          placeholder={translate("Name, number, set, text, trait...")}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <nav className="site-nav" aria-label={translate("Primary navigation")}>
        {NAV_ITEMS.map(([id, label, code]) => (
          <button
            key={id}
            type="button"
            className={NAV_GROUPS[id]?.has(view) ? "is-active" : ""}
            aria-current={NAV_GROUPS[id]?.has(view) ? "page" : undefined}
            onClick={() => onViewChange(id)}
          >
            <small>{code}</small>
            <span>{translate(label)}</span>
          </button>
        ))}
      </nav>

      <div className="site-header__actions cockpit-pilot-panel">
        <label className="hud-theme-selector">
          <span>{locale === "pt-BR" ? "HUD" : "HUD"}</span>
          <select value={theme.id} onChange={(event) => onThemeChange?.(event.target.value)} aria-label={locale === "pt-BR" ? "Selecionar tema da HUD" : "Select HUD theme"}>
            {themeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <div className="language-switch" role="group" aria-label={locale === "pt-BR" ? "Idioma" : "Language"}>
          <button type="button" className={locale === "pt-BR" ? "is-active" : ""} onClick={() => setLocale("pt-BR")} aria-pressed={locale === "pt-BR"}>PT-BR</button>
          <button type="button" className={locale === "en" ? "is-active" : ""} onClick={() => setLocale("en")} aria-pressed={locale === "en"}>ENG</button>
        </div>
        <span className="pilot-avatar" aria-hidden="true" />
        <button type="button" className="pilot-label pilot-label-button" onClick={() => user ? onViewChange("profile") : onSignIn?.()}>
          {user ? `${translate("PILOT")}: ${user.publicName.toUpperCase()}` : (locale === "pt-BR" ? "ENTRAR" : "SIGN IN")}
        </button>
        <span className="site-format-badge"><small>{locale === "pt-BR" ? "FORMATO" : "FORMAT"}</small><strong>{activeFormat}</strong></span>
      </div>
    </header>
  );
}
