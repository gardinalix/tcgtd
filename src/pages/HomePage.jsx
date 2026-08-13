import { useMemo } from "react";
import { useLocale } from "../i18n/LocaleProvider";
import { buildMetaWindows, buildScopedMetaSignal } from "../domain/meta";

export function HomePage({ data, theme, selectedMetaId = "current", setView }) {
  const { locale } = useLocale();
  const pt = locale === "pt-BR";
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

  return (
    <div className="launch-home" data-view-panel="home">
      <section className="launch-hero" aria-labelledby="launch-title">
        <div className="launch-hero__grid" aria-hidden="true" />
        <div className="launch-hero__copy">
          <p className="launch-kicker">
            <span className="launch-live-dot" />
            TCG TACTICAL DATABASE // GUNDAM CARD GAME
          </p>
          <h1 id="launch-title">
            {pt ? "Transforme dados do meta em" : "Turn meta data into"}
            <span aria-label={pt ? " decisões de deck." : undefined}>
              {pt ? <> decis<span className="launch-hero__nasal-o" aria-hidden="true">o</span>es de deck.</> : " deck decisions."}
            </span>
          </h1>
          <p className="launch-hero__summary">
            {pt
              ? "Um cockpit tático para pesquisar cartas, acompanhar o cenário competitivo e evoluir listas com evidências — não com palpites."
              : "A tactical cockpit to research cards, track the competitive field and evolve lists with evidence — not guesswork."}
          </p>
          <div className="launch-hero__actions">
            <button className="launch-button launch-button--primary" type="button" onClick={() => setView("decks")}>
              {pt ? "ABRIR A FORJA" : "OPEN THE FORGE"}
            </button>
            <button className="launch-button launch-button--ghost" type="button" onClick={() => setView("cards")}>
              {pt ? "EXPLORAR DATABASE" : "EXPLORE DATABASE"}
            </button>
          </div>
          <dl className="launch-hero__telemetry" aria-label={pt ? "Resumo do sistema" : "System overview"}>
            <Telemetry value={formatNumber(overview.cards, locale)} label={pt ? "cartas" : "cards"} />
            <Telemetry value={formatNumber(overview.decklists, locale)} label={pt ? "decklists" : "decklists"} />
            <Telemetry value={overview.format} label={pt ? "formato em foco" : "focus format"} />
          </dl>
        </div>

        <div className="launch-hero__visual" aria-label={`${theme.gundamName} tactical system`}>
          <div className="launch-reticle launch-reticle--outer" />
          <div className="launch-reticle launch-reticle--inner" />
          <img src={theme.gundamImage} alt={theme.gundamName} />
          <div className="launch-unit-label">
            <small>{theme.unitId}</small>
            <strong>{theme.gundamName}</strong>
            <span>{theme.stateLabel}</span>
          </div>
        </div>

      </section>

      <section className="launch-section launch-mission" aria-labelledby="mission-title">
        <SectionHeading
          index="01"
          eyebrow={pt ? "CAPACIDADES DO SISTEMA" : "SYSTEM CAPABILITIES"}
          title={pt ? "Da pesquisa à decisão tática" : "From research to tactical decision"}
          description={pt
            ? "Quatro módulos conectados para responder o que jogar, por que jogar e como melhorar."
            : "Four connected modules to answer what to play, why to play it and how to improve."}
        />
        <ol className="launch-operation-map" aria-label={pt ? "Mapa de subsistemas" : "Subsystem map"}>
          {modules.map((module) => (
            <li className={`launch-operation-node${module.featured ? " is-primary" : ""}`} key={module.code}>
              <button type="button" onClick={() => setView(module.action)}>
                <span className="launch-operation-node__target" aria-hidden="true"><i />{module.code}</span>
                <span className="launch-operation-node__copy">
                  <small>{module.label}</small>
                  <strong>{module.title}</strong>
                  <span>{module.description}</span>
                </span>
                <span className="launch-operation-node__signal">
                  <b>{module.metric}</b>
                  <small>{module.metricLabel}</small>
                  <em>{module.cta} →</em>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="launch-section launch-intel" aria-labelledby="intel-title">
        <SectionHeading
          index="02"
          eyebrow={pt ? "INTELIGÊNCIA ATUAL" : "CURRENT INTELLIGENCE"}
          title={pt ? "O campo competitivo, condensado" : "The competitive field, condensed"}
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
                  <span aria-hidden="true">↗</span>
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

function SectionHeading({ index, eyebrow, title, description }) {
  return (
    <header className="launch-section-heading">
      <span>{index}</span>
      <div><small>{eyebrow}</small><h2>{title}</h2></div>
      <p>{description}</p>
    </header>
  );
}

function buildOverview(data = {}) {
  const counts = data.counts || {};
  const latestDecks = (data.latestDecks || data.metaResults || [])
    .filter((deck) => deck?.deckId)
    .slice(0, 6);
  const metaLeaders = (data.metaLeaders || data.cards || [])
    .filter((card) => card?.cardNumber)
    .slice(0, 5);
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
