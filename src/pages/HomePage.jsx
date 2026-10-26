import { useMemo, useState } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { buildMetaWindows, buildScopedMetaSignal } from "../domain/meta";

export function HomePage({ data, theme, selectedMetaId = "current", setView }) {
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
      <div className="bridge-heading">
        <div><span className="bridge-heading__index">00</span><h1 id="bridge-title">{pt ? "PONTE DE COMANDO" : "COMMAND BRIDGE"}</h1></div>
        <span>GUNDAM CARD GAME <i aria-hidden="true">//</i> {overview.format}</span>
      </div>
      <section className="cockpit-bridge" aria-labelledby="bridge-title">
        <div className="bridge-orders bridge-panel">
          <div className="bridge-panel__bar"><span>01 / {pt ? "CONTROLE DE MISSÃO" : "MISSION CONTROL"}</span><i aria-hidden="true" /></div>
          <div className="bridge-orders__body">
            <div className="bridge-unit-id"><img src={theme.factionLogo} alt="" /><span>{theme.unitId}<small>{theme.stateLabel}</small></span></div>
            <h2>{pt ? "Transforme dados do meta em" : "Turn meta data into"}<span>{pt ? " decisões de deck." : " deck decisions."}</span></h2>
            <p>{pt ? "Pesquise o arsenal. Leia o campo. Prepare sua próxima lista." : "Search the arsenal. Read the field. Prepare your next list."}</p>
            <div className="bridge-orders__actions">
              <button className="launch-button launch-button--primary" type="button" onClick={() => setView("decks")}>{pt ? "INICIAR FORJA" : "LAUNCH FORGE"}<span aria-hidden="true">→</span></button>
              <button className="launch-button launch-button--ghost" type="button" onClick={() => setView("cards")}>{pt ? "ACESSAR ARSENAL" : "OPEN ARSENAL"}<span aria-hidden="true">→</span></button>
            </div>
            <div className="bridge-scope"><span>{pt ? "ESCOPO COMPETITIVO" : "COMPETITIVE SCOPE"}</span><strong>{overview.format}</strong><small>{formatNumber(overview.decklists, locale)} {pt ? "listas no recorte selecionado" : "lists in the selected scope"}</small></div>
          </div>
        </div>
        <div className="bridge-viewport bridge-panel" aria-label={`${theme.gundamName} — ${theme.unitId}`}>
          <div className="bridge-panel__bar"><span>02 / {pt ? "MONITOR DA UNIDADE" : "UNIT MONITOR"}</span><span>{theme.unitId}</span></div>
          <div className="bridge-viewport__screen">
            <img className="bridge-viewport__unit" src={theme.gundamImage} alt={theme.gundamName} />
            <svg className="bridge-sight" viewBox="0 0 600 500" fill="none" aria-hidden="true">
              <path d="M90 95H50V145 M510 95H550V145 M90 405H50V355 M510 405H550V355" />
              <circle cx="300" cy="250" r="170" strokeDasharray="80 12 3 12" />
              <circle cx="300" cy="250" r="191" strokeDasharray="1 11" />
              <path d="M280 250H292 M308 250H320 M300 230V242 M300 258V270 M300 40V60 M300 440V460 M10 250H30 M570 250H590" />
              <path d="M28 175V325 M572 175V325" strokeDasharray="2 8" />
            </svg>
            <span className="bridge-viewport__mode">{theme.operation}</span>
            <div className="bridge-viewport__identity"><span>MOBILE SUIT / {theme.unitId}</span><strong>{theme.gundamName}</strong><small>{theme.stateLabel}</small></div>
          </div>
          <div className="bridge-viewport__footer"><span>{pt ? "UNIDADE SELECIONADA" : "SELECTED UNIT"}</span><span>{theme.pilot}</span></div>
        </div>
        <aside className="bridge-intel bridge-panel" aria-label={pt ? "Leitura do campo" : "Field readout"}>
          <div className="bridge-panel__bar"><span>03 / FIELD INTEL</span><i aria-hidden="true" /></div>
          <dl className="bridge-readouts">
            <Telemetry value={formatNumber(overview.cards, locale)} label={pt ? "CARTAS NO ARSENAL" : "CARDS IN ARSENAL"} />
            <Telemetry value={formatNumber(overview.decklists, locale)} label={pt ? "LISTAS NO ESCOPO" : "LISTS IN SCOPE"} />
            <Telemetry value={formatNumber(overview.events, locale)} label={pt ? "EVENTOS NO ESCOPO" : "EVENTS IN SCOPE"} />
          </dl>
          <div className="bridge-intel__signals"><h2>{pt ? "SINAIS DO META" : "META SIGNALS"}</h2>
            {overview.metaLeaders.slice(0, 3).map((card, index) => <button key={card.cardNumber} type="button" onClick={() => setView("card", card.cardNumber)}><span>{String(index + 1).padStart(2, "0")}</span><span><strong>{card.cardName}</strong><small>{card.cardNumber}</small></span><b aria-hidden="true">→</b></button>)}
            {!overview.metaLeaders.length && <p>{pt ? "Sem sinais para este recorte." : "No signals in this scope."}</p>}
          </div>
        </aside>
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

      <section className="launch-section launch-intel" aria-labelledby="intel-title">
        <SectionHeading
          index="02"
          eyebrow={pt ? "INTELIGÊNCIA ATUAL" : "CURRENT INTELLIGENCE"}
          id="intel-title"
          title={pt ? "Relatório do campo" : "Field report"}
          description={pt
            ? "Amostras do banco atual. Cada resultado mantém o evento, a colocação e a fonte de origem."
            : "Samples from the current database. Every result retains its event, placement and source."}
        />
        <div className="launch-intel__layout">
          <div className="launch-intel__events">
            <div className="launch-panel-title">
              <span>{pt ? "RESULTADOS RECENTES" : "RECENT RESULTS"}</span>
              <button type="button" onClick={() => setView("events")}>{pt ? "TODOS OS EVENTOS" : "ALL EVENTS"}</button>
            </div>
            <div className="launch-result-list">
              {overview.latestDecks.map((deck, index) => (
                <button className="launch-result" type="button" key={`${deck.deckId}-${index}`} onClick={() => setView("deckView", deck.deckId)}>
                  <span className="launch-result__rank">{deck.placingLabel || "—"}</span>
                  <span className="launch-result__main">
                    <strong>{deck.archetype || (pt ? "Arquétipo não informado" : "Archetype unavailable")}</strong>
                    <small>{deck.playerName || (pt ? "Piloto não informado" : "Pilot unavailable")}</small>
                  </span>
                  <span className="launch-result__event">
                    <strong>{deck.eventName || "Event"}</strong>
                    <small>{formatDate(deck.eventDate, locale)} // {deck.formatName || overview.format}</small>
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>

          <aside className="launch-intel__cards">
            <div className="launch-panel-title">
              <span>{pt ? "SINAIS DO META" : "META SIGNALS"}</span>
              <button type="button" onClick={() => setView("meta")}>{pt ? "RADAR COMPLETO" : "FULL RADAR"}</button>
            </div>
            <div className="launch-signal-list">
              {overview.metaLeaders.map((card, index) => (
                <button className="launch-signal" type="button" key={card.cardNumber} onClick={() => setView("card", card.cardNumber)}>
                  <span className="launch-signal__index">{String(index + 1).padStart(2, "0")}</span>
                  <img src={assetUrl(card.imageUrl)} alt="" loading="lazy" />
                  <span>
                    <strong>{card.cardName}</strong>
                    <small>{card.cardNumber} // {card.color || card.cardType}</small>
                  </span>
                  <b>{Number(card.recentMetaScore || 0).toFixed(1)}</b>
                </button>
              ))}
            </div>
          </aside>
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

function Telemetry({ value, label }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
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
