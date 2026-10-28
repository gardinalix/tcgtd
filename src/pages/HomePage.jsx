import { useMemo, useState } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { buildMetaWindows, buildScopedMetaSignal } from "../domain/meta";

export function HomePage({ data, theme, user, selectedMetaId = "current", setView }) {
  const { locale } = useLocale();
  const pt = locale === "pt-BR";
  const [activeMissionCode, setActiveMissionCode] = useState("01");
  const overview = useMemo(() => buildOverview(scopeHomeData(data, selectedMetaId)), [data, selectedMetaId]);
  const modules = [
    {
      code: "01",
      label: pt ? "RADAR DO META" : "META RADAR",
      title: pt ? "Leia o campo antes do confronto" : "Read the field before the match",
      description: pt
        ? "Arquétipos, desempenho recente e sinais competitivos consolidados em uma leitura prática."
        : "Archetypes, recent performance and competitive signals consolidated into a practical read.",
      metric: formatNumber(overview.decklists, locale),
      metricLabel: pt ? "listas competitivas" : "competitive lists",
      action: "meta",
      cta: pt ? "ABRIR RADAR" : "OPEN RADAR",
    },
    {
      code: "02",
      label: pt ? "BANCO DE CARTAS" : "CARD DATABASE",
      title: pt ? "Encontre a peça certa em segundos" : "Find the right piece in seconds",
      description: pt
        ? "Pesquisa por nome, número, efeito, coleção, cor e sinais de sinergia."
        : "Search by name, number, effect, set, color and synergy signals.",
      metric: formatNumber(overview.cards, locale),
      metricLabel: pt ? "cartas catalogadas" : "catalogued cards",
      action: "cards",
      cta: pt ? "EXPLORAR CARTAS" : "EXPLORE CARDS",
    },
    {
      code: "03",
      label: pt ? "INTEL DE TORNEIOS" : "TOURNAMENT INTEL",
      title: pt ? "Resultados com contexto verificável" : "Results with verifiable context",
      description: pt
        ? "Eventos, colocações e decklists conectados às fontes disponíveis."
        : "Events, placements and decklists connected to their available sources.",
      metric: formatNumber(overview.events, locale),
      metricLabel: pt ? "eventos monitorados" : "events monitored",
      action: "events",
      cta: pt ? "VER EVENTOS" : "VIEW EVENTS",
    },
    {
      code: "04",
      label: pt ? "FORJA TÁTICA" : "TACTICAL FORGE",
      title: pt ? "Construa, valide e refine" : "Build, validate and refine",
      description: pt
        ? "Monte uma lista legal, compare sua estrutura e receba diagnósticos baseados nos dados carregados."
        : "Build a legal list, compare its structure and get diagnostics grounded in loaded data.",
      metric: "50 + 10",
      metricLabel: pt ? "estrutura oficial do deck" : "official deck structure",
      action: "decks",
      cta: pt ? "ENTRAR NA FORJA" : "ENTER THE FORGE",
      featured: true,
    },
  ];
  const activeMission = modules.find((module) => module.code === activeMissionCode) || modules[0];

  function navigateMissionTabs(event, currentIndex) {
    const keyTargets = {
      ArrowLeft: (currentIndex - 1 + modules.length) % modules.length,
      ArrowUp: (currentIndex - 1 + modules.length) % modules.length,
      ArrowRight: (currentIndex + 1) % modules.length,
      ArrowDown: (currentIndex + 1) % modules.length,
      Home: 0,
      End: modules.length - 1,
    };
    const nextIndex = keyTargets[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    const tabList = event.currentTarget.parentElement;
    setActiveMissionCode(modules[nextIndex].code);
    requestAnimationFrame(() => tabList?.children[nextIndex]?.focus());
  }

  return (
    <div className="launch-home" data-view-panel="home">
      <section className="orbital-cockpit" aria-labelledby="orbital-title">
        <div className="orbital-flight-deck">
          <nav className="orbital-menu orbital-panel" aria-label={pt ? "Menu do cockpit" : "Cockpit menu"}>
            <div className="orbital-panel-title"><span>{pt ? "MENU PRINCIPAL" : "MAIN MENU"}</span><span aria-hidden="true">//</span></div>
            {[["home", pt ? "INÍCIO" : "HOME"], ["cards", pt ? "ARSENAL" : "ARSENAL"], ["decks", pt ? "FORJA TÁTICA" : "TACTICAL FORGE"], ["meta", pt ? "RADAR DO META" : "META RADAR"], ["events", pt ? "TORNEIOS" : "TOURNAMENTS"], ["community", pt ? "COMUNIDADE" : "COMMUNITY"], ["previews", pt ? "TRANSMISSÕES" : "TRANSMISSIONS"]].map(([view, label]) => <button key={view} type="button" className={view === "home" ? "is-active" : ""} aria-current={view === "home" ? "page" : undefined} onClick={() => setView(view)}><CockpitIcon kind={view} /><span>{label}</span><b aria-hidden="true">›</b></button>)}
            <div className="orbital-menu__signature"><img src={theme.factionLogo} alt="" /><span>{theme.gundamName}<small>{theme.unitId} // {theme.stateLabel}</small></span></div>
          </nav>
          <div className="orbital-window">
            <div className="orbital-window__coordinates"><span>GUNDAM CARD GAME<br />TCGTD / {pt ? "PONTE DE COMANDO" : "COMMAND BRIDGE"}</span><span>{overview.format}<br />{pt ? "ESCOPO SELECIONADO" : "SELECTED SCOPE"}</span></div>
            <div className="orbital-welcome">
              <span className="orbital-welcome__eyebrow">{theme.operation}</span>
              <h1 id="orbital-title">{pt ? "BEM-VINDO," : "WELCOME,"}<br /><span>{user?.publicName || (pt ? "PILOTO" : "PILOT")}</span></h1>
              <p>{pt ? "Dados do meta para" : "Meta intelligence for"}<span>{pt ? " decisões de deck." : " deck decisions."}</span></p>
              <img className="orbital-welcome__insignia" src={theme.factionLogo} alt="" />
              <button type="button" className="orbital-launch" onClick={() => setView("decks")}>{pt ? "INICIAR OPERAÇÃO NA FORJA" : "LAUNCH TACTICAL FORGE"}<span aria-hidden="true">›</span></button>
            </div>
          </div>
          <aside className="orbital-status orbital-panel" aria-label={pt ? "Unidade e piloto" : "Unit and pilot"}>
            <div className="orbital-panel-title"><span>{pt ? "UNIDADE" : "UNIT STATUS"}</span><img src={theme.factionLogo} alt="" /></div>
            <div className="orbital-status__unit"><img src={theme.cockpitUnitImage || theme.gundamImage} alt={theme.gundamName} /><span>{theme.unitId}</span></div>
            <h2>{theme.gundamName}</h2>
            <dl className="orbital-status__readouts"><div><dt>{pt ? "PILOTO" : "PILOT"}</dt><dd>{user?.publicName || (pt ? "VISITANTE" : "GUEST")}</dd></div><div><dt>{pt ? "SISTEMA" : "SYSTEM"}</dt><dd>{theme.stateLabel}</dd></div><div><dt>{pt ? "FORMATO" : "FORMAT"}</dt><dd>{overview.format}</dd></div></dl>
            <button type="button" onClick={() => setView(user ? "profile" : "login")}>{user ? (pt ? "ABRIR PERFIL" : "OPEN PROFILE") : (pt ? "IDENTIFICAR PILOTO" : "IDENTIFY PILOT")}<span aria-hidden="true">›</span></button>
          </aside>
        </div>
        <div className="orbital-instruments">
          <section className="orbital-radar orbital-panel" aria-labelledby="orbital-radar-title">
            <div className="orbital-panel-title"><h2 id="orbital-radar-title">{pt ? "MAPA TÁTICO" : "TACTICAL MAP"}</h2><span>SYNERGY / GCG</span></div>
            <div className="orbital-radar__body"><svg viewBox="0 0 300 220" fill="none" aria-hidden="true"><ellipse cx="150" cy="110" rx="126" ry="83" /><ellipse cx="150" cy="110" rx="100" ry="65" /><circle cx="150" cy="110" r="65" /><ellipse cx="150" cy="110" rx="30" ry="65" /><ellipse cx="150" cy="110" rx="65" ry="24" /><path d="M20 110H280 M150 12V208 M47 35L253 185 M48 183L252 37" /><path className="orbital-radar__orbit" d="M39 142Q160 4 264 94Q180 212 39 142Z" /><circle className="orbital-radar__node" cx="150" cy="110" r="5" /><circle className="orbital-radar__node" cx="82" cy="94" r="4" /><circle className="orbital-radar__node" cx="231" cy="115" r="4" /></svg><div><span>{pt ? "RELAÇÕES ENTRE CARTAS" : "CARD RELATIONSHIPS"}</span><strong>{formatNumber(overview.cards, locale)}</strong><small>{pt ? "cartas no arsenal" : "cards in the arsenal"}</small><button type="button" onClick={() => setView(overview.metaLeaders[0] ? "synergyMap" : "cards", overview.metaLeaders[0]?.cardNumber || "")}>{pt ? "ABRIR MAPA" : "OPEN MAP"} <span aria-hidden="true">›</span></button></div></div>
          </section>
          <section className="orbital-feed orbital-panel" aria-labelledby="orbital-feed-title">
            <div className="orbital-panel-title"><h2 id="orbital-feed-title">{pt ? "TRANSMISSÕES DO CAMPO" : "FIELD TRANSMISSIONS"}</h2><button type="button" onClick={() => setView("events")}>{pt ? "TODAS" : "ALL"} ›</button></div>
            {overview.latestDecks.slice(0, 3).map((deck, index) => <button className="orbital-feed__entry" type="button" key={`${deck.deckId}-${index}`} onClick={() => setView("deckView", deck.deckId)}><span>{deck.placingLabel || String(index + 1).padStart(2, "0")}</span><span><small>{formatDate(deck.eventDate, locale)} / {deck.formatName || overview.format}</small><strong>{deck.archetype || deck.eventName}</strong><em>{deck.eventName}</em></span><b aria-hidden="true">›</b></button>)}
            {!overview.latestDecks.length && <p>{pt ? "Nenhum resultado neste recorte." : "No results in this scope."}</p>}
          </section>
          <section className="orbital-signals orbital-panel" aria-labelledby="orbital-signals-title">
            <div className="orbital-panel-title"><h2 id="orbital-signals-title">{pt ? "SINAIS DO META" : "META SIGNALS"}</h2><span>{overview.format}</span></div>
            {overview.metaLeaders.slice(0, 3).map((card) => <button className="orbital-signals__entry" key={card.cardNumber} type="button" onClick={() => setView("card", card.cardNumber)}><img src={assetUrl(card.imageUrl)} alt="" /><span><strong>{card.cardName}</strong><small>{card.cardNumber}</small></span><span aria-hidden="true">›</span></button>)}
            <div className="orbital-signals__scope"><span>{formatNumber(overview.decklists, locale)} {pt ? "LISTAS" : "LISTS"}</span><span>{formatNumber(overview.events, locale)} {pt ? "EVENTOS" : "EVENTS"}</span></div>
          </section>
        </div>
      </section>

      <section className="launch-section launch-mission" aria-labelledby="mission-title">
        <div className="bridge-dock-heading"><h2 id="mission-title">{pt ? "SELECIONAR OPERAÇÃO" : "SELECT OPERATION"}</h2><span>04 / MISSION SELECT</span></div>
        <div className="bridge-mission">
          <div className="bridge-mission__tabs" role="tablist" aria-label={pt ? "Selecionar missão" : "Select mission"}>
            {modules.map((module, index) => (
              <button
                key={module.code}
                type="button"
                role="tab"
                aria-selected={module.code === activeMission.code}
                id={`mission-tab-${module.code}`}
                aria-controls="launch-mission-stage"
                tabIndex={module.code === activeMission.code ? 0 : -1}
                className={module.code === activeMission.code ? "is-active" : ""}
                onClick={() => setActiveMissionCode(module.code)}
                onKeyDown={(event) => navigateMissionTabs(event, index)}
              >
                <span>{module.code}</span>
                <strong>{module.label}</strong>
              </button>
            ))}
          </div>
          <article
            className={`bridge-mission__stage${activeMission.featured ? " is-primary" : ""}`}
            id="launch-mission-stage"
            role="tabpanel"
            aria-labelledby={`mission-tab-${activeMission.code}`}
            key={activeMission.code}
          >

            <div className="bridge-mission__copy">
              <small>{activeMission.label} // MISSION PATH</small>
              <h3>{activeMission.title}</h3>
              <p>{activeMission.description}</p>
            </div>
            <div className="bridge-mission__signal">
              <small>{activeMission.metricLabel}</small>
              <strong>{activeMission.metric}</strong>
              <span><i /> {pt ? "CANAL PRONTO" : "CHANNEL READY"}</span>
            </div>
            <button className="launch-button launch-button--primary" type="button" onClick={() => setView(activeMission.action)}>
              {activeMission.cta} →
            </button>
          </article>
        </div>
      </section>

      <section className="launch-section launch-onboarding" aria-labelledby="onboarding-title">
        <SectionHeading
          id="onboarding-title"
          index="03"
          eyebrow={pt ? "INICIAR OPERAÇÃO" : "START OPERATION"}
          title={pt ? "Seu próximo passo depende da missão" : "Your next step depends on the mission"}
          description={pt
            ? "A consulta pública permanece livre. Conta e recursos assistidos entram somente quando agregam valor real."
            : "Public research stays free. Accounts and assisted features enter only where they add real value."}
        />
        <div className="launch-paths">
          <button type="button" onClick={() => setView("cards")}>
            <small>01 // {pt ? "NOVO NO JOGO" : "NEW TO THE GAME"}</small>
            <strong>{pt ? "Conhecer cartas e coleções" : "Discover cards and sets"}</strong>
            <span>{pt ? "Comece pela base de cartas e use filtros táticos." : "Start with the card database and tactical filters."}</span>
          </button>
          <button type="button" onClick={() => setView("meta")}>
            <small>02 // {pt ? "JOGADOR COMPETITIVO" : "COMPETITIVE PLAYER"}</small>
            <strong>{pt ? "Ler o meta e os resultados" : "Read the meta and results"}</strong>
            <span>{pt ? "Compare arquétipos, listas e desempenho recente." : "Compare archetypes, lists and recent performance."}</span>
          </button>
          <button type="button" onClick={() => setView("decks")}>
            <small>03 // {pt ? "DECK EM EVOLUÇÃO" : "EVOLVING DECK"}</small>
            <strong>{pt ? "Levar a lista para a Forja" : "Take the list to the Forge"}</strong>
            <span>{pt ? "Valide, diagnostique e refine sem perder autoria." : "Validate, diagnose and refine without losing authorship."}</span>
          </button>
        </div>
      </section>

      <section className="launch-community-band" aria-label={pt ? "Comunidade" : "Community"}>
        <div>
          <small>COMMUNITY UPLINK // {pt ? "CANAL ABERTO" : "CHANNEL OPEN"}</small>
          <h2>{pt ? "Um sistema construído com a comunidade." : "A system built with the community."}</h2>
          <p>{pt
            ? "Acompanhe eventos, jogadores, lojas e as próximas expansões do banco tático."
            : "Follow events, players, stores and the next expansions of the tactical database."}</p>
        </div>
        <button className="launch-button launch-button--ghost" type="button" onClick={() => setView("community")}>
          {pt ? "ACESSAR COMUNIDADE" : "OPEN COMMUNITY"}
        </button>
      </section>
    </div>
  );
}

function CockpitIcon({ kind }) {
  const paths = {
    home: "M3 11L12 3L21 11M5 10V21H10V15H14V21H19V10",
    cards: "M5 3H19V21H5ZM8 7H16M8 11H16M8 15H13",
    decks: "M5 5H19V19H5ZM9 1V5M15 1V5M9 19V23M15 19V23M1 9H5M19 9H23M1 15H5M19 15H23M9 9H15V15H9Z",
    meta: "M3 20V13H7V20M10 20V8H14V20M17 20V3H21V20",
    events: "M7 3H17V8C17 15 7 15 7 8ZM7 5H3V8C3 11 7 11 7 11M17 5H21V8C21 11 17 11 17 11M12 13V20M7 21H17",
    community: "M8 11A4 4 0 1 0 8 3A4 4 0 0 0 8 11ZM1 21V18C1 12 15 12 15 18V21M17 4C22 4 22 11 17 11M18 14C22 14 23 17 23 21",
    previews: "M3 21L12 3L21 21M7 15H17M5 10C1 7 1 4 4 1M19 10C23 7 23 4 20 1",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind] || paths.cards} /></svg>;
}

function SectionHeading({ id, index, eyebrow, title, description }) {
  return (
    <header className="launch-section-heading">
      <span>{index}</span>
      <div><small>{eyebrow}</small><h2 id={id}>{title}</h2></div>
      <p>{description}</p>
    </header>
  );
}

function buildOverview(data = {}) {
  const counts = data.counts || {};
  const latestDecks = (data.latestDecks || data.metaResults || [])
    .filter((deck) => deck?.deckId)
    .slice(0, 4);
  const metaLeaders = (data.metaLeaders || data.cards || [])
    .filter((card) => card?.cardNumber)
    .slice(0, 4);
  return {
    cards: Number(counts.cards || counts.main_deck_cards || 0) + Number(counts.resource_cards || 0),
    decklists: Number(counts.decklists || 0),
    events: Number(counts.events || data.metaEvents?.length || 0),
    format: data.activeFormat || data.gameModule?.activeFormat || "GD05",
    generatedAt: data.generatedAt || data.cardSnapshotGeneratedAt || "",
    latestDecks,
    metaLeaders,
  };
}

function scopeHomeData(data = {}, selectedMetaId = "current") {
  const snapshot = data.metaSnapshots?.[selectedMetaId];
  if (snapshot) {
    return {
      ...data,
      ...snapshot,
      counts: { ...data.counts, ...snapshot.counts },
    };
  }
  if (!data.metaResults?.length) return data;

  const metaWindows = buildMetaWindows(data);
  const selectedWindow = metaWindows.find((window) => window.id === selectedMetaId) || metaWindows[0];
  const signal = buildScopedMetaSignal(data, selectedWindow);
  const cardMap = new Map((data.cards || []).map((card) => [card.cardNumber, card]));
  const latestDecks = (data.metaResults || [])
    .filter((result) => dateInsideWindow(result.eventDate, selectedWindow))
    .filter((result) => result.deckId && result.hasDecklist !== false)
    .sort((left, right) => String(right.eventDate || "").localeCompare(String(left.eventDate || "")))
    .slice(0, 6);
  return {
    ...data,
    activeFormat: selectedWindow?.shortLabel || selectedWindow?.formatCode || data.activeFormat,
    counts: {
      ...data.counts,
      decklists: signal.context.deckCount,
      events: signal.context.eventCount,
    },
    latestDecks,
    metaLeaders: signal.ranked.slice(0, 5).map((row) => ({
      ...row,
      recentMetaScore: row.recentScore,
      recentTop8DecksUsing: row.recent,
      imageUrl: cardMap.get(row.cardNumber)?.imageUrl || "",
    })),
  };
}

function dateInsideWindow(value, window) {
  const date = String(value || "").slice(0, 10);
  return Boolean(date && window) && date >= window.startDate && date <= window.endDate;
}

function formatNumber(value, locale) {
  return new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US").format(Number(value || 0));
}

function formatDate(value, locale) {
  if (!value) return "—";
  const date = new Date(value.includes?.("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "pt-BR" ? "pt-BR" : "en-US", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function assetUrl(value) {
  return String(value || "").replace(/^\.\//, "/");
}
