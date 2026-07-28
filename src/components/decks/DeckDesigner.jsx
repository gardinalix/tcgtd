import { useEffect, useMemo, useState } from "react";
import { DeckMap } from "./DeckMap";
import { buildExBurstDeckText, downloadDeckText } from "../../domain/deckExport.js";
import {
  TacticalDataPanel,
  TacticalEmptyState,
  TacticalLoadingState,
  TacticalStatusBadge,
} from "../tactical/TacticalPageShell";
import {
  analyzeRecommendedDeck,
  applyRecommendedSubstitution,
  assembleRecommendedDeck,
  collectDeckResearch,
  normalizeDeckEvidence,
  scoreRecommendationPool,
} from "../../services/deckDesigner/index.js";
import { DESIGNER_COLORS } from "../../services/deckDesigner/deckDesignerUtils.js";
import { getLocaleTag } from "../../i18n/translations.js";

const ANALYSIS_STAGES = [
  "Collecting competitive decklists",
  "Normalizing cards, events and results",
  "Scoring adoption, fit and constraints",
  "Assembling the legal 50-card shell",
  "Explaining synergies and substitutions",
];

export function DeckDesigner({ data, onSaveRecommendation, onEditDeck }) {
  const defaultArchetype = data.defaults?.template_archetype || data.archetypes?.[0]?.archetype || "";
  const defaultProfile = data.archetypes?.find((item) => item.archetype === defaultArchetype);
  const [criteria, setCriteria] = useState(() => ({
    colors: inferInitialColors(defaultProfile?.commonColorCombination),
    unitQuery: "",
    archetype: defaultArchetype,
    preferences: "",
    requiredCards: "",
    excludedCards: "",
    budgetBrl: "",
    focus: "competitive",
  }));
  const [status, setStatus] = useState("idle");
  const [activeStage, setActiveStage] = useState(-1);
  const [errorMessage, setErrorMessage] = useState("");
  const [report, setReport] = useState(null);
  const [originalReport, setOriginalReport] = useState(null);
  const [briefOpen, setBriefOpen] = useState(true);
  const [savedDeckId, setSavedDeckId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const archetypes = useMemo(
    () => [...(data.archetypes || [])].sort((left, right) =>
      Number(right.recentDecklists || 0) - Number(left.recentDecklists || 0)
      || String(left.archetype).localeCompare(String(right.archetype))),
    [data.archetypes],
  );
  const unitNames = useMemo(() => [...new Set((data.cards || [])
    .filter((card) => card.cardType === "UNIT")
    .filter((card) => Number(card.recentTop8DecksUsing || 0) > 0)
    .sort((left, right) => Number(right.recentTop8DecksUsing || 0) - Number(left.recentTop8DecksUsing || 0))
    .map((card) => card.cardName))].slice(0, 180), [data.cards]);

  async function runAnalysis(event) {
    event?.preventDefault();
    if (!criteria.colors.length && !criteria.archetype.trim() && !criteria.unitQuery.trim()) {
      setStatus("error");
      setErrorMessage("Select a color, an archetype, or a main unit so the agent has an anchor.");
      return;
    }
    setStatus("loading");
    setErrorMessage("");
    setSaveMessage("");
    setSavedDeckId("");
    try {
      setActiveStage(0);
      await nextFrame();
      const research = collectDeckResearch(data, criteria);
      const resolvedCriteria = research.criteria;

      setActiveStage(1);
      await nextFrame();
      const normalized = normalizeDeckEvidence(data, research);

      setActiveStage(2);
      await nextFrame();
      const scored = scoreRecommendationPool(data, normalized, resolvedCriteria);

      setActiveStage(3);
      await nextFrame();
      const assembled = assembleRecommendedDeck(data, scored, resolvedCriteria);
      if (assembled.mainCount !== Number(data.rules?.mainDeckSize || 50)) {
        throw new Error("The recommendation engine could not assemble a legal main-deck size.");
      }

      setActiveStage(4);
      await nextFrame();
      const nextReport = analyzeRecommendedDeck(data, assembled, resolvedCriteria);
      setReport(nextReport);
      setOriginalReport(nextReport);
      setBriefOpen(false);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error.message || "The Deck Designer could not complete this analysis.");
    } finally {
      setActiveStage(-1);
    }
  }

  function toggleColor(color) {
    setCriteria((current) => {
      const selected = current.colors.includes(color);
      if (!selected && current.colors.length >= Number(data.rules?.maxColors || 2)) return current;
      return {
        ...current,
        colors: selected
          ? current.colors.filter((item) => item !== color)
          : [...current.colors, color],
      };
    });
  }

  function applySubstitution(sourceCardNumber, targetCardNumber) {
    setReport((current) => applyRecommendedSubstitution(current, sourceCardNumber, targetCardNumber, data));
    setSavedDeckId("");
    setSaveMessage("Deck changed. Statistics, curve and synergies were recalculated.");
  }

  function resetSubstitutions() {
    setReport(originalReport);
    setSavedDeckId("");
    setSaveMessage("Original recommendation restored.");
  }

  function saveRecommendation() {
    const saved = onSaveRecommendation?.(report);
    if (!saved?.id) {
      setSaveMessage("The deck could not be saved.");
      return;
    }
    setSavedDeckId(saved.id);
    setSaveMessage("Saved to My decks on this device.");
  }

  if (!(data.cards || []).length) {
    return (
      <TacticalDataPanel title="BRUXÃO DECK DESIGNER" subtitle="Card catalog required">
        <TacticalEmptyState title="No card data" detail="Synchronize the official card snapshot before requesting a recommendation." />
      </TacticalDataPanel>
    );
  }

  return (
    <div className={`deck-designer ${report ? "is-engaged" : ""}`.trim()}>
      <section className="bruxao-designer-hero" aria-labelledby="bruxao-designer-title">
        <div className="bruxao-designer-hero__core" aria-hidden="true">
          <span>BRX</span>
          <i />
          <b />
        </div>
        <div className="bruxao-designer-hero__copy">
          <span className="eyebrow">Potter callsign · tactical deck system</span>
          <h2 id="bruxao-designer-title"><span>BRUXÃO</span> DECK DESIGNER</h2>
          <p>BRUXÃO is Potter's pilot ID. This system turns competitive evidence into a connected deck map built for battle decisions.</p>
          <div className="bruxao-designer-hero__signals" aria-label="Designer capabilities">
            <span>Deck link map</span>
            <span>Synergy analysis</span>
            <span>Live substitution impact</span>
          </div>
        </div>
        <div className="bruxao-designer-hero__status">
          <small>PILOT ID</small>
          <strong>POTTER</strong>
          <span>DECK LINK ONLINE</span>
        </div>
      </section>
      <details
        className="deck-designer__brief-frame"
        open={briefOpen}
        onToggle={(event) => setBriefOpen(event.currentTarget.open)}
      >
        <summary>
          <span>MISSION PARAMETERS</span>
          <strong>
            {criteria.archetype || (criteria.unitQuery ? "AUTO STRATEGY" : "OPEN STRATEGY")}
            {" · "}
            {criteria.colors.join(" / ") || "AUTO COLORS"}
          </strong>
          <em>{briefOpen ? "COLLAPSE" : "RECONFIGURE"}</em>
        </summary>
        <form className="deck-designer__brief tactical-data-panel" onSubmit={runAnalysis}>
        <div className="deck-designer__brief-head">
          <div>
            <span className="eyebrow">01 / Mission brief</span>
            <h2>Configure the deck agent</h2>
            <p>Choose the identity first. Constraints remain optional and are applied before cards are scored.</p>
          </div>
          <span className="deck-designer__agent-status">Agent / evidence mode</span>
        </div>

        <fieldset className="deck-designer__colors">
          <legend>Colors · up to {data.rules?.maxColors || 2}</legend>
          <div>
            {DESIGNER_COLORS.map((color) => (
              <label key={color} className={`deck-color-option deck-color-option--${color.toLowerCase()} ${criteria.colors.includes(color) ? "is-selected" : ""}`.trim()}>
                <input
                  type="checkbox"
                  checked={criteria.colors.includes(color)}
                  onChange={() => toggleColor(color)}
                />
                <span aria-hidden="true" />
                <strong>{color}</strong>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="deck-designer__primary-fields">
          <label>
            <span>Main unit / robot <em>optional</em></span>
            <input
              list="deck-designer-units"
              value={criteria.unitQuery}
              onChange={(event) => {
                const unitQuery = event.target.value;
                setCriteria((current) => ({
                  ...current,
                  unitQuery,
                  colors: !current.archetype.trim() && unitQuery.trim() ? [] : current.colors,
                }));
              }}
              placeholder="e.g. Gundam Barbatos 1st Form"
            />
            <datalist id="deck-designer-units">
              {unitNames.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
          <label>
            <span>Archetype / strategy <em>optional · auto when blank</em></span>
            <select
              value={criteria.archetype}
              onChange={(event) => {
                const archetype = event.target.value;
                const profile = archetypes.find((item) => item.archetype === archetype);
                const inferredColors = inferInitialColors(profile?.commonColorCombination);
                setCriteria((current) => ({
                  ...current,
                  archetype,
                  colors: inferredColors.length
                    ? inferredColors
                    : archetype
                      ? current.colors
                      : current.unitQuery.trim()
                        ? []
                        : current.colors,
                }));
              }}
            >
              <option value="">Infer the best strategy from my selection</option>
              {archetypes.map((item) => (
                <option key={item.archetype} value={item.archetype}>
                  {item.archetype} · {item.recentDecklists || 0} recent
                </option>
              ))}
            </select>
            <small>Leave blank to let the agent infer a competitive color and strategy shell for the selected unit.</small>
          </label>
          <label>
            <span>Optimization focus</span>
            <select
              value={criteria.focus}
              onChange={(event) => setCriteria((current) => ({ ...current, focus: event.target.value }))}
            >
              <option value="competitive">Competitive consistency</option>
              <option value="casual">Casual flexibility</option>
            </select>
          </label>
        </div>

        <details className="deck-designer__constraints">
          <summary>Advanced constraints <span>preferences, collection and budget</span></summary>
          <div className="deck-designer__constraint-grid">
            <label className="is-wide">
              <span>Playstyle preferences</span>
              <textarea
                value={criteria.preferences}
                onChange={(event) => setCriteria((current) => ({ ...current, preferences: event.target.value }))}
                placeholder="More interaction, smoother curve, preserve a specific trait package..."
              />
            </label>
            <label>
              <span>Required cards</span>
              <textarea
                value={criteria.requiredCards}
                onChange={(event) => setCriteria((current) => ({ ...current, requiredCards: event.target.value }))}
                placeholder={"Card number or exact name\nOne per line"}
              />
            </label>
            <label>
              <span>Cards not owned / excluded</span>
              <textarea
                value={criteria.excludedCards}
                onChange={(event) => setCriteria((current) => ({ ...current, excludedCards: event.target.value }))}
                placeholder={"Card number or exact name\nOne per line"}
              />
            </label>
            <label>
              <span>Budget ceiling · BRL</span>
              <input
                type="number"
                min="0"
                step="10"
                value={criteria.budgetBrl}
                onChange={(event) => setCriteria((current) => ({ ...current, budgetBrl: event.target.value }))}
                placeholder="No ceiling"
              />
            </label>
          </div>
        </details>

        <div className="deck-designer__launch">
          <div>
            <strong>{(data.metaResults || []).length.toLocaleString()} results · {(data.metaDeckCards || []).length.toLocaleString()} normalized card rows</strong>
            <span>Snapshot: {formatDate(data.generatedAt || data.metaSnapshotGeneratedAt)}</span>
          </div>
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Agent analyzing..." : report ? "Rebuild recommendation" : "Design my deck"}
          </button>
        </div>
        </form>
      </details>

      {status === "loading" ? <AnalysisProgress activeStage={activeStage} /> : null}
      {status === "error" ? (
        <div className="deck-designer__error" role="alert">
          <strong>Analysis interrupted</strong>
          <span>{errorMessage}</span>
          <button type="button" onClick={runAnalysis}>Try again</button>
        </div>
      ) : null}
      {status === "idle" ? <DesignerEmptyState data={data} /> : null}
      {status === "success" && report ? (
        <DesignerResult
          report={report}
          onApplySubstitution={applySubstitution}
          onResetSubstitutions={resetSubstitutions}
          onSave={saveRecommendation}
          onEdit={() => onEditDeck?.(savedDeckId)}
          onExportJson={() => downloadJsonReport(report)}
          savedDeckId={savedDeckId}
          saveMessage={saveMessage}
        />
      ) : null}
    </div>
  );
}

function DesignerResult({
  report,
  onApplySubstitution,
  onResetSubstitutions,
  onSave,
  onEdit,
  onExportJson,
  savedDeckId,
  saveMessage,
}) {
  const [exportLayerOpen, setExportLayerOpen] = useState(false);

  return (
    <section className="deck-designer-result" aria-live="polite">
      <header className="deck-designer-result__header">
        <div>
          <span className="eyebrow">05 / Recommendation online</span>
          <h2>{report.title}</h2>
          <p>{report.strategy}</p>
        </div>
        <div className="deck-designer-result__actions">
          <button type="button" onClick={onSave}>Save deck</button>
          {savedDeckId ? <button type="button" onClick={onEdit}>Edit in builder</button> : null}
          <button type="button" onClick={() => setExportLayerOpen(true)}>Export TXT</button>
          <button type="button" onClick={onExportJson}>Export JSON</button>
          {report.substitutionHistory?.length ? <button type="button" onClick={onResetSubstitutions}>Reset swaps</button> : null}
        </div>
      </header>
      {saveMessage ? <p className="deck-designer-result__save-status">{saveMessage}</p> : null}

      <DeckMap report={report} onApplySubstitution={onApplySubstitution} />

      {(report.limitations || []).length ? (
        <div className="deck-designer-result__limitations">
          <strong>Evidence limitations</strong>
          {report.limitations.map((limitation) => <span key={limitation}>{limitation}</span>)}
        </div>
      ) : null}

      <details className="deck-designer-debrief">
        <summary>
          <span>TACTICAL DEBRIEF // EXPAND INTELLIGENCE</span>
          <strong>Curve · matchups · synergies · sources</strong>
        </summary>
        <div className="deck-designer-result__layout">
          <aside className="deck-designer-analysis">
            <CurvePanel stats={report.stats} />
            <InsightPanel title="Observed facts" items={report.observedFacts} tone="fact" />
            <InsightPanel title="Strengths · theoretical" items={report.strengths} tone="inference" />
            <InsightPanel title="Weaknesses / risks" items={report.weaknesses} tone="risk" />
            <MatchupPanel rows={report.matchups} />
          </aside>
        </div>
        <div className="deck-designer-result__lower-grid">
          <SynergyPanel rows={report.synergies} />
          <EvidencePanel report={report} />
        </div>
      </details>
      {exportLayerOpen ? (
        <ExBurstExportLayer report={report} onClose={() => setExportLayerOpen(false)} />
      ) : null}
    </section>
  );
}

function ExBurstExportLayer({ report, onClose }) {
  const content = useMemo(() => buildExBurstDeckText(report), [report]);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function copyForExBurst() {
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("List copied. Paste it into ExBurst's text import.");
    } catch {
      setCopyStatus("Automatic copy was blocked. Select the text and copy it manually.");
    }
  }

  return (
    <div
      className="deck-export-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="deck-export-layer__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-export-title"
      >
        <div className="deck-export-layer__scan" aria-hidden="true" />
        <header>
          <div>
            <span className="eyebrow">TRANSFER LAYER // EXBURST</span>
            <h2 id="deck-export-title">ExBurst text format</h2>
            <p>One entry per card in <code>4xCARD-NUMBER</code> format, ready to copy or save.</p>
          </div>
          <button type="button" className="deck-export-layer__close" onClick={onClose} aria-label="Close export layer">×</button>
        </header>
        <div className="deck-export-layer__telemetry">
          <span><small>MAIN DECK</small><strong>{report.stats?.mainCount || 0} / 50</strong></span>
          <span><small>UNIQUE CARDS</small><strong>{report.rows?.length || 0}</strong></span>
          <span><small>FORMAT</small><strong>EXBURST TXT</strong></span>
        </div>
        <label className="deck-export-layer__payload">
          <span>DECK PAYLOAD</span>
          <textarea
            readOnly
            value={content}
            spellCheck="false"
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        <footer>
          <div aria-live="polite">{copyStatus || "Resource cards are managed separately from the 50-card main deck."}</div>
          <nav aria-label="Export actions">
            <button type="button" onClick={copyForExBurst}>Copy for ExBurst</button>
            <button type="button" onClick={() => downloadDeckText(content, report.title)}>Download .TXT</button>
            <a href="https://exburst.dev/gundam" target="_blank" rel="noreferrer">Open ExBurst</a>
          </nav>
        </footer>
      </section>
    </div>
  );
}

function AnalysisProgress({ activeStage }) {
  return (
    <section className="deck-designer-progress" aria-live="polite">
      <TacticalLoadingState label={ANALYSIS_STAGES[activeStage] || "Starting deck agent..."} />
      <ol>
        {ANALYSIS_STAGES.map((stage, index) => (
          <li key={stage} className={index < activeStage ? "is-complete" : index === activeStage ? "is-active" : ""}>
            <span>{index < activeStage ? "✓" : String(index + 1).padStart(2, "0")}</span>
            <strong>{stage}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DesignerEmptyState({ data }) {
  return (
    <section className="deck-designer-empty">
      <div className="deck-designer-empty__radar" aria-hidden="true">
        <span />
        <i />
      </div>
      <div>
        <span className="eyebrow">Awaiting mission parameters</span>
        <h2>Evidence before intuition</h2>
        <p>
          The agent will compare {Number(data.metaResults?.length || 0).toLocaleString()} competitive results,
          official card text and the current rules snapshot. Low-sample recommendations stay explicitly labeled as inference.
        </p>
        <ul>
          <li>Competitive adoption and finishes</li>
          <li>Curve, traits, LINK/PAIR and text bridges</li>
          <li>Budget-aware substitutions with impact</li>
        </ul>
      </div>
    </section>
  );
}

function CurvePanel({ stats }) {
  const curve = Object.entries(stats.curve || {}).sort((left, right) => Number(left[0]) - Number(right[0]));
  const max = Math.max(...curve.map(([, count]) => count), 1);
  return (
    <section className="designer-analysis-panel designer-curve-panel">
      <header><h3>Cost curve</h3><span>{stats.averageCost} avg.</span></header>
      <div className="designer-curve-chart">
        {curve.map(([cost, count]) => (
          <div key={cost}>
            <span style={{ "--curve-height": `${Math.max(8, (count / max) * 100)}%` }}><i>{count}</i></span>
            <strong>{cost}</strong>
          </div>
        ))}
      </div>
      <dl>
        {Object.entries(stats.types || {}).map(([type, count]) => <div key={type}><dt>{type}</dt><dd>{count}</dd></div>)}
      </dl>
    </section>
  );
}

function InsightPanel({ title, items = [], tone }) {
  return (
    <section className={`designer-analysis-panel designer-insight-panel designer-insight-panel--${tone}`}>
      <h3>{title}</h3>
      {items.map((item) => <p key={item}>{item}</p>)}
    </section>
  );
}

function MatchupPanel({ rows = [] }) {
  return (
    <section className="designer-analysis-panel designer-matchup-panel">
      <header><h3>Probable matchups</h3><span>theory only</span></header>
      {rows.map((row) => (
        <article key={row.opponent}>
          <strong>{row.opponent}</strong>
          <span>{row.outlook} · {row.confidence} confidence</span>
          <p>{row.basis}</p>
        </article>
      ))}
    </section>
  );
}

function SynergyPanel({ rows = [] }) {
  return (
    <TacticalDataPanel title="Primary synergies and combos" subtitle="Competitive co-occurrence is factual; text/curve bridges are labeled as inference.">
      <div className="designer-synergy-list">
        {rows.map((row) => (
          <article key={row.id}>
            <header>
              <strong>{row.sourceCard.cardName}</strong>
              <span>+</span>
              <strong>{row.targetCard.cardName}</strong>
              <TacticalStatusBadge tone={row.confidence === "High" ? "green" : row.confidence === "Medium" ? "blue" : "gold"}>
                {row.confidence}
              </TacticalStatusBadge>
            </header>
            <p>{row.explanation}</p>
            {row.facts.map((fact) => <span key={fact}>{fact}</span>)}
            {row.inference ? <em>{row.inference}</em> : null}
          </article>
        ))}
      </div>
    </TacticalDataPanel>
  );
}

function EvidencePanel({ report }) {
  return (
    <TacticalDataPanel title="Evidence and sources" subtitle={report.evidenceSummary}>
      <div className="designer-evidence-list">
        {(report.sources || []).map((source, index) => (
          <article key={`${source.name}-${source.url}-${index}`}>
            <span>{source.classification?.replaceAll("_", " ")}</span>
            <strong>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> : source.name}</strong>
            <p>{source.detail}</p>
            <em>Source date: {source.sourceDate || "not published"} · consulted {formatDate(source.consultationDate)}</em>
          </article>
        ))}
      </div>
    </TacticalDataPanel>
  );
}

function inferInitialColors(value = "") {
  return String(value || "")
    .split("/")
    .map((color) => color.trim())
    .filter((color) => DESIGNER_COLORS.includes(color))
    .slice(0, 2);
}

function nextFrame() {
  return new Promise((resolve) => window.setTimeout(resolve, 90));
}

function formatDate(value) {
  if (!value) return "date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(getLocaleTag(), { year: "numeric", month: "short", day: "numeric" });
}

function downloadJsonReport(report) {
  const safeTitle = String(report.title || "deck-recommendation").replace(/[^\w-]+/g, "-").toLowerCase();
  const content = JSON.stringify(exportPayload(report), null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeTitle}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportPayload(report) {
  return {
    generatedAt: report.generatedAt,
    title: report.title,
    criteria: report.criteria,
    confidence: report.confidence,
    strategy: report.strategy,
    main: Object.fromEntries((report.rows || []).map((row) => [row.card.cardNumber, {
      name: row.card.cardName,
      quantity: row.quantity,
      type: row.card.cardType,
      cost: row.card.cost,
      category: row.category,
      confidence: row.confidence,
    }])),
    resource: report.resource,
    stats: report.stats,
    synergies: report.synergies.map((row) => ({
      cards: [row.sourceCard.cardNumber, row.targetCard.cardNumber],
      confidence: row.confidence,
      explanation: row.explanation,
    })),
    limitations: report.limitations,
    sources: report.sources,
  };
}
