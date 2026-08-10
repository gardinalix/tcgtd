export function TacticalPageShell({ children, className = "", moduleName }) {
  const resolvedModuleName = moduleName || inferModuleName(className);
  const activeModule = resolveActiveModule(className);
  return (
    <section
      className={`react-page tactical-page-shell forge-unified-page tactical-compute-viewport ${className}`.trim()}
      data-system-module={resolvedModuleName}
      data-active-subsystem={activeModule}
    >
      <div className="tactical-hud-grid" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="tactical-page-linkbar tactical-system-rail" aria-label="Current tactical subsystem">
        <span className="tactical-page-linkbar__system"><i /> TCGTD // OPERATIONS CORE</span>
        <strong>{resolvedModuleName}</strong>
        <span className="tactical-page-linkbar__network">SECURE CHANNEL // ONLINE</span>
      </div>
      <nav className="tactical-subsystem-bus" aria-label="Tactical subsystems">
        {SYSTEM_MODULES.map((module) => (
          <a
            key={module.id}
            href={module.href}
            className={activeModule === module.id ? "is-active" : ""}
            aria-current={activeModule === module.id ? "page" : undefined}
            onClick={navigateSubsystem}
          >
            <span>{module.code}</span>
            <strong>{module.label}</strong>
            <i aria-hidden="true" />
          </a>
        ))}
      </nav>
      <div className="tactical-viewport-rail tactical-viewport-rail--left" aria-hidden="true">
        <span>DAT/LINK</span><i /><i /><i /><b>SYNC</b>
      </div>
      <div className="tactical-viewport-rail tactical-viewport-rail--right" aria-hidden="true">
        <span>TTD CORE</span><i /><i /><i /><b>99.6</b>
      </div>
      <span className="tactical-page-coordinate tactical-page-coordinate--top" aria-hidden="true">GRID 00.318 // NODE 05.120</span>
      {children}
      <div className="tactical-bottom-bus" aria-hidden="true">
        <span><i /> DATA PIPELINE STABLE</span>
        <b>TACTICAL COMPUTE ENVIRONMENT</b>
        <span>LATENCY 12MS // ENCRYPTED</span>
      </div>
    </section>
  );
}

export function TacticalPageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
  onBack,
  backLabel = "Back",
}) {
  return (
    <header className="tactical-page-header">
      <div className="tactical-page-header__radar" aria-hidden="true">
        <i className="tactical-radar__ring tactical-radar__ring--outer" />
        <i className="tactical-radar__ring tactical-radar__ring--inner" />
        <i className="tactical-radar__sweep" />
        <i className="tactical-radar__axis" />
        <span>FIELD ACQUISITION</span>
        <b>LOCK</b>
      </div>
      <div className="tactical-page-header__main">
        <div className="tactical-page-header__kicker">
          {onBack ? <button type="button" className="tactical-back-button" onClick={onBack}>{backLabel}</button> : null}
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        </div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {meta ? <div className="tactical-page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="tactical-page-header__actions tactical-header-utility">{actions}</div> : null}
      <div className="tactical-header-readout" aria-hidden="true">
        <span>SIGNAL</span><strong>ACTIVE</strong><i />
      </div>
    </header>
  );
}

export function TacticalSummaryStrip({ children, className = "" }) {
  return (
    <div className={`tactical-summary-strip tactical-instrument-strip tactical-telemetry-bus ${className}`.trim()} role="list">
      <span className="tactical-telemetry-bus__axis" aria-hidden="true"><i /></span>
      {children}
    </div>
  );
}

export function TacticalSummaryCard({ label, value, detail, tone = "neutral" }) {
  return (
    <article className={`tactical-summary-card tactical-instrument tactical-summary-card--${tone}`} role="listitem">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

export function TacticalDataPanel({ title, subtitle, actions, children, className = "", code, mode = "data" }) {
  const resolvedCode = code || panelCode(title);
  return (
    <section className={`tactical-data-panel tactical-surface tactical-subsystem-plane ${className}`.trim()} data-plane-mode={mode} data-plane-code={resolvedCode}>
      <span className="tactical-surface__socket" aria-hidden="true"><i />{resolvedCode}</span>
      {(title || subtitle || actions) ? (
        <div className="tactical-panel-header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="tactical-panel-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function TacticalBreakdownPanel({ title, subtitle = "Automatic tactical breakdown.", rows = [], limit = 10 }) {
  return (
    <TacticalDataPanel title={title} subtitle={subtitle} className="tactical-breakdown-panel">
      {rows.length ? (
        <div className="cockpit-list tactical-breakdown-list">
          {rows.slice(0, limit).map((row) => (
            <span key={row.label} className="cockpit-list-row">
              <strong>{row.label}</strong>
              <span>{row.count}</span>
            </span>
          ))}
        </div>
      ) : (
        <TacticalEmptyState title="No signal" detail="Not enough normalized rows for this breakdown yet." />
      )}
    </TacticalDataPanel>
  );
}

export function TacticalTable({ columns, rows, renderRow, emptyTitle = "No rows detected", emptyDetail = "Awaiting synchronized data." }) {
  return (
    <div className="react-table-wrap tactical-table-wrap">
      <table className="react-table tactical-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(renderRow)}
        </tbody>
      </table>
      {!rows.length ? <TacticalEmptyState title={emptyTitle} detail={emptyDetail} /> : null}
    </div>
  );
}

export function TacticalStatusBadge({ children, tone = "neutral" }) {
  return <span className={`tactical-status-badge tactical-status-badge--${tone}`}>{children}</span>;
}

export function TacticalActionButton({ children, className = "", ...props }) {
  return (
    <button type="button" className={`tactical-action-button ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function TacticalSourcePanel({ sourceName, sourceUrl, status = "Synchronized", updatedAt, children }) {
  return (
    <TacticalDataPanel title="Source / Coverage" subtitle="External reference and normalization status." className="tactical-source-panel">
      <dl className="detail-grid tactical-source-grid">
        <div><dt>Source</dt><dd>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceName || "Open source"}</a> : sourceName || "-"}</dd></div>
        <div><dt>Status</dt><dd><TacticalStatusBadge tone="green">{status}</TacticalStatusBadge></dd></div>
        <div><dt>Updated</dt><dd>{updatedAt || "-"}</dd></div>
      </dl>
      {children}
    </TacticalDataPanel>
  );
}

export function TacticalEmptyState({ title = "No data", detail = "The system has no rows for this module yet." }) {
  return (
    <div className="tactical-empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function TacticalLoadingState({ label = "System scan in progress..." }) {
  return (
    <div className="tactical-loading-state">
      <span />
      <strong>{label}</strong>
    </div>
  );
}

const SYSTEM_MODULES = [
  { id: "archive", code: "01", label: "OBJECT ARCHIVE", href: "/cards" },
  { id: "forge", code: "02", label: "TACTICAL FORGE", href: "/decks" },
  { id: "battlefield", code: "03", label: "FIELD INTEL", href: "/meta" },
  { id: "network", code: "04", label: "OPS NETWORK", href: "/community" },
  { id: "signals", code: "05", label: "SIGNAL ARRAY", href: "/leaks" },
];

function resolveActiveModule(className = "") {
  if (/cards|card-dossier|synergy/.test(className)) return "archive";
  if (/decks|builder|deck-dossier|io-terminal/.test(className)) return "forge";
  if (/meta|prices/.test(className)) return "battlefield";
  if (/community|players|venues|events|event-dossier/.test(className)) return "network";
  if (/preview/.test(className)) return "signals";
  return "system";
}

function panelCode(title = "") {
  const tokens = String(title).toUpperCase().match(/[A-Z0-9]+/g) || ["SYS"];
  return tokens.slice(0, 2).map((token) => token.slice(0, 3)).join("/");
}

function navigateSubsystem(event) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  window.history.pushState({}, "", event.currentTarget.getAttribute("href"));
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function inferModuleName(className = "") {
  const modules = [
    ["cards-terminal-page", "01 / ARSENAL DE CARTAS"],
    ["card-dossier-page", "02 / DOSSIÊ DA CARTA"],
    ["synergy-map-page", "03 / MAPA DE SINERGIAS"],
    ["synergy-terminal-page", "04 / ANÁLISE DE SINERGIAS"],
    ["decks-terminal-page", "05 / OPERAÇÕES DE DECK"],
    ["builder-terminal-page", "06 / CONSTRUTOR DE DECK"],
    ["deck-dossier-page", "07 / DOSSIÊ DO DECK"],
    ["meta-terminal-page", "08 / INTELIGÊNCIA DE META"],
    ["community-terminal-page", "09 / REDE DA COMUNIDADE"],
    ["players-terminal-page", "10 / DIRETÓRIO DE JOGADORES"],
    ["venues-terminal-page", "11 / LOCALIZADOR DE LOJAS"],
    ["events-terminal-page", "12 / ARQUIVO COMPETITIVO"],
    ["event-dossier-page", "13 / DOSSIÊ DO EVENTO"],
    ["prices-terminal-page", "14 / INTELIGÊNCIA DE MERCADO"],
    ["preview-terminal-page", "15 / RADAR DE LANÇAMENTOS"],
    ["io-terminal-page", "16 / IMPORTAÇÃO E EXPORTAÇÃO"],
    ["profile-terminal-page", "17 / IDENTIDADE DO PILOTO"],
    ["account-terminal-page", "18 / CONTROLE DE CONTA"],
    ["settings-terminal-page", "19 / CONFIGURAÇÕES DO SISTEMA"],
    ["login-terminal-page", "20 / ACESSO DO PILOTO"],
    ["register-terminal-page", "21 / REGISTRO DO PILOTO"],
    ["auth-callback-terminal-page", "22 / SINCRONIZAÇÃO DE ACESSO"],
    ["logout-terminal-page", "23 / ENCERRAMENTO DE SESSÃO"],
  ];
  return modules.find(([token]) => className.includes(token))?.[1] || "00 / SISTEMA TÁTICO";
}
