export function TacticalPageShell({ children, className = "", moduleName }) {
  const resolvedModuleName = moduleName || inferModuleName(className);
  return (
    <section className={`react-page tactical-page-shell forge-unified-page ${className}`.trim()} data-forge-module={resolvedModuleName}>
      <div className="tactical-page-linkbar" aria-hidden="true">
        <span className="tactical-page-linkbar__system"><i /> FORJA INTERFACE</span>
        <strong>{resolvedModuleName}</strong>
        <span className="tactical-page-linkbar__network">TCG TACTICAL NETWORK · ONLINE</span>
      </div>
      {children}
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
      <div className="tactical-page-header__main">
        <div className="tactical-page-header__kicker">
          {onBack ? <button type="button" className="tactical-back-button" onClick={onBack}>{backLabel}</button> : null}
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        </div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {meta ? <div className="tactical-page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="tactical-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function TacticalSummaryStrip({ children, className = "" }) {
  return (
    <div className={`tactical-summary-strip ${className}`.trim()}>
      {children}
    </div>
  );
}

export function TacticalSummaryCard({ label, value, detail, tone = "neutral" }) {
  return (
    <article className={`tactical-summary-card tactical-summary-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

export function TacticalDataPanel({ title, subtitle, actions, children, className = "" }) {
  return (
    <section className={`tactical-data-panel ${className}`.trim()}>
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
