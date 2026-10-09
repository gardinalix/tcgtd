import { useEffect, useRef, useState } from "react";
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

export function SiteHeader({ view, theme, themeOptions = [], onThemeChange, user, data, metaWindows = [], selectedMetaId = "current", onMetaChange, onViewChange, onSignIn, search, onSearchChange }) {
  const { locale, setLocale } = useLocale();
  const [mobileUtilitiesOpen, setMobileUtilitiesOpen] = useState(false);
  const mobileUtilitiesToggleRef = useRef(null);
  const systemStatus = locale === "pt-BR" ? "REDE TÁTICA ONLINE" : "TACTICAL NETWORK ONLINE";
  const systemMode = locale === "pt-BR" ? "MÓDULO GUNDAM ATIVO" : "GUNDAM MODULE ACTIVE";
  const activeFormat = metaWindows.find((window) => window.id === selectedMetaId)?.shortLabel
    || data?.activeFormat
    || data?.gameModule?.activeFormat
    || "GD05";

  useEffect(() => {
    if (!mobileUtilitiesOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") closeMobileUtilities();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileUtilitiesOpen]);

  function closeMobileUtilities() {
    setMobileUtilitiesOpen(false);
    window.requestAnimationFrame(() => mobileUtilitiesToggleRef.current?.focus());
  }

  function changeLocale(nextLocale) {
    setLocale(nextLocale);
    setMobileUtilitiesOpen(false);
  }

  function changeTheme(nextThemeId) {
    onThemeChange?.(nextThemeId);
    setMobileUtilitiesOpen(false);
  }

  return (
    <header id="site-navigation" className="site-header panel cockpit-panel cockpit-topbar cockpit-shell-topbar">
      <button className="site-brand zero-brand" type="button" aria-label="TCG Tactical Database" onClick={() => onViewChange("home")}>
        <span className="site-brand__mark zero-brand__seal tcgtd-insignia" aria-hidden="true">
          <img src="/assets/brand/tcgtd-orbital-mark-v3.svg" alt="" />
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
          aria-label={locale === "pt-BR" ? "Buscar cartas" : "Search cards"}
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

      <div className={`site-header__actions cockpit-pilot-panel${mobileUtilitiesOpen ? " is-mobile-utility-open" : ""}`}>
        <button
          ref={mobileUtilitiesToggleRef}
          className="mobile-utility-toggle"
          type="button"
          aria-expanded={mobileUtilitiesOpen}
          aria-controls="mobile-utility-panel"
          onClick={() => setMobileUtilitiesOpen((isOpen) => !isOpen)}
        >
          <span>{locale === "pt-BR" ? "CONTROLES" : "CONTROLS"}</span>
          <i aria-hidden="true" />
        </button>
        {mobileUtilitiesOpen ? <button className="mobile-utility-backdrop" type="button" aria-label={locale === "pt-BR" ? "Fechar controles" : "Close controls"} onClick={closeMobileUtilities} /> : null}
        <div id="mobile-utility-panel" className="mobile-utility-panel" aria-label={locale === "pt-BR" ? "Controles do sistema" : "System controls"}>
          <label className="hud-theme-selector">
            <span>{locale === "pt-BR" ? "HUD" : "HUD"}</span>
            <select value={theme.id} onChange={(event) => changeTheme(event.target.value)} aria-label={locale === "pt-BR" ? "Selecionar tema da HUD" : "Select HUD theme"}>
              {themeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <div className="language-switch" role="group" aria-label={locale === "pt-BR" ? "Idioma" : "Language"}>
            <button type="button" className={locale === "pt-BR" ? "is-active" : ""} onClick={() => changeLocale("pt-BR")} aria-pressed={locale === "pt-BR"}>PT-BR</button>
            <button type="button" className={locale === "en" ? "is-active" : ""} onClick={() => changeLocale("en")} aria-pressed={locale === "en"}>ENG</button>
          </div>
          <span className="pilot-avatar" aria-hidden="true" />
          <button type="button" className="pilot-label pilot-label-button" onClick={() => user ? onViewChange("profile") : onSignIn?.()}>
            {user ? `${translate("PILOT")}: ${user.publicName.toUpperCase()}` : (locale === "pt-BR" ? "ENTRAR" : "SIGN IN")}
          </button>
          <label className="site-format-badge site-format-selector">
            <small>{locale === "pt-BR" ? "META / FORMATO" : "META / FORMAT"}</small>
            <select value={selectedMetaId} onChange={(event) => { onMetaChange?.(event.target.value); setMobileUtilitiesOpen(false); }} aria-label={locale === "pt-BR" ? "Selecionar meta ou formato" : "Select meta or format"}>
              {metaWindows.length
                ? metaWindows.map((window) => <option key={window.id} value={window.id}>{formatMetaWindowLabel(window, locale)}</option>)
                : <option value={selectedMetaId}>{activeFormat}</option>}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}

function formatMetaWindowLabel(window, locale) {
  if (locale !== "pt-BR") return window.label;
  if (window.id === "current") return `${window.shortLabel} · formato atual`;
  if (window.id === "rolling-30") return "Campo móvel · 30 dias";
  if (window.id === "all") return "Todo o histórico competitivo";
  return window.label;
}
