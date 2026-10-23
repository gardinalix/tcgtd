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
  cards: ["cards", "card", "synergy", "synergyMap"],
  decks: ["decks", "builder", "deckView", "importExport"],
  meta: ["meta", "prices"],
  community: ["community", "contribute", "events", "eventDetail", "players", "venues", "scheduleManager"],
  previews: ["previews"],
};

export function SiteHeader({ view, theme, themeOptions = [], onThemeChange, user, data, metaWindows = [], selectedMetaId = "current", onMetaChange, onViewChange, onSignIn, search, onSearchChange }) {
  const { locale, setLocale } = useLocale();
  const pt = locale === "pt-BR";
  const [utilitiesOpen, setUtilitiesOpen] = useState(false);
  const toggleRef = useRef(null);
  const headerRef = useRef(null);
  const activeFormat = metaWindows.find((window) => window.id === selectedMetaId)?.shortLabel || data?.activeFormat || "GD05";

  useEffect(() => { setUtilitiesOpen(false); }, [view]);
  useEffect(() => {
    if (!utilitiesOpen) return;
    function onKey(event) {
      if (event.key === "Escape") {
        setUtilitiesOpen(false);
        toggleRef.current?.focus();
      }
    }
    function onOutside(event) {
      if (!headerRef.current?.contains(event.target)) setUtilitiesOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onOutside);
    };
  }, [utilitiesOpen]);

  return (
    <header id="site-navigation" className="hud-header" ref={headerRef}>
      <a className="hud-skip" href="#main-content">{pt ? "Pular para o conteúdo" : "Skip to content"}</a>
      <div className="hud-header__command">
        <button className="hud-brand" type="button" onClick={() => onViewChange("home")} aria-label="TCG Tactical Database — Home">
          <img src="/assets/brand/tcgtd-orbital-mark-v3.svg" alt="" width="40" height="40" />
          <span><small>TCGTD // TACTICAL SYSTEMS</small><strong>TCG TACTICAL DATABASE</strong></span>
        </button>
        <label className="hud-search">
          <span aria-hidden="true">⌕</span>
          <input type="search" aria-label={pt ? "Buscar cartas" : "Search cards"} placeholder={pt ? "Buscar nome, código, efeito…" : "Search name, code, effect…"} value={search} onKeyDown={(event) => { if (event.key === "Enter") onViewChange("cards"); }} onChange={(event) => onSearchChange(event.target.value)} />
          <small>DATABASE</small>
        </label>
        <button ref={toggleRef} className="hud-controls-toggle" type="button" aria-expanded={utilitiesOpen} aria-controls="hud-system-controls" onClick={() => setUtilitiesOpen((open) => !open)}>
          <span aria-hidden="true">☷</span>{pt ? "CONTROLES" : "CONTROLS"}
        </button>
        <div id="hud-system-controls" className={`hud-controls${utilitiesOpen ? " is-open" : ""}`}>
          <label><span>HUD / UNIT</span><select value={theme.id} onChange={(event) => onThemeChange?.(event.target.value)} aria-label={pt ? "Selecionar tema da HUD" : "Select HUD theme"}>{themeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label><span>{pt ? "META / FORMATO" : "META / FORMAT"}</span><select value={selectedMetaId} onChange={(event) => onMetaChange?.(event.target.value)} aria-label={pt ? "Selecionar meta ou formato" : "Select meta or format"}>{metaWindows.length ? metaWindows.map((window) => <option key={window.id} value={window.id}>{formatMetaWindowLabel(window, locale)}</option>) : <option value={selectedMetaId}>{activeFormat}</option>}</select></label>
          <div className="hud-language" role="group" aria-label={pt ? "Idioma" : "Language"}>
            <button type="button" aria-pressed={pt} onClick={() => setLocale("pt-BR")}>PT</button><button type="button" aria-pressed={!pt} onClick={() => setLocale("en")}>EN</button>
          </div>
          <button type="button" className="hud-session" onClick={() => { setUtilitiesOpen(false); user ? onViewChange("profile") : onSignIn?.(); }}>{user ? user.publicName : pt ? "ENTRAR" : "SIGN IN"}</button>
          <nav className="hud-controls__links" aria-label={pt ? "Mais módulos" : "More modules"}>
            {[["events", pt ? "Eventos" : "Events"], ["prices", pt ? "Mercado" : "Market"], ["players", pt ? "Jogadores" : "Players"], ["venues", pt ? "Lojas e agenda" : "Venues & schedule"], ["importExport", "Import / Export"], ["settings", pt ? "Configurações" : "Settings"]].map(([id, label]) => <button type="button" key={id} onClick={() => { setUtilitiesOpen(false); onViewChange(id); }}>{label} →</button>)}
          </nav>
        </div>
      </div>
      <div className="hud-header__bus">
        <span className="hud-header__module"><i /> GUNDAM CARD GAME <b>{activeFormat}</b></span>
        <nav className="hud-primary-nav" aria-label={translate("Primary navigation")}>
          {NAV_ITEMS.map(([id, label, code]) => {
            const active = NAV_GROUPS[id].includes(view);
            return <button key={id} type="button" className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={() => onViewChange(id)}><small>{code}</small><span>{translate(label)}</span><i aria-hidden="true" /></button>;
          })}
        </nav>
        <span className="hud-header__edition">PUBLIC ALPHA <b>01</b></span>
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
