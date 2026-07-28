import { useMemo, useState } from "react";
import { CardArt } from "../cards/CardArt";
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
  const [expandedCard, setExpandedCard] = useState("");
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
    if (!criteria.colors.length || !criteria.archetype.trim()) {
      setStatus("error");
      setErrorMessage("Select at least one color and an archetype or strategy.");
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

      setActiveStage(1);
      await nextFrame();
      const normalized = normalizeDeckEvidence(data, research);

      setActiveStage(2);
      await nextFrame();
      const scored = scoreRecommendationPool(data, normalized, criteria);

      setActiveStage(3);
      await nextFrame();
      const assembled = assembleRecommendedDeck(data, scored, criteria);
      if (assembled.mainCount !== Number(data.rules?.mainDeckSize || 50)) {
        throw new Error("The recommendation engine could not assemble a legal main-deck size.");
      }

      setActiveStage(4);
      await nextFrame();
      const nextReport = analyzeRecommendedDeck(data, assembled, criteria);
      setReport(nextReport);
      setOriginalReport(nextReport);
      setExpandedCard("");
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
    <div className="deck-designer">
      <section className="bruxao-designer-hero" aria-labelledby="bruxao-designer-title">
        <div className="bruxao-designer-hero__sigil" aria-hidden="true">
          <span>BD</span>
          <i />
        </div>
        <div className="bruxao-designer-hero__copy">
          <span className="eyebrow">Arcane tactical oracle · competitive intelligence</span>
          <h2 id="bruxao-designer-title"><span>BRUXÃO</span> DECK DESIGNER</h2>
          <p>Real data goes in. A sharpened list comes out. Every choice includes evidence, confidence and calculated impact.</p>
          <div className="bruxao-designer-hero__signals" aria-label="Designer capabilities">
            <span>Competitive meta</span>
            <span>Deep synergies</span>
            <span>Live swaps</span>
          </div>
        </div>
        <div className="bruxao-designer-hero__status">
          <small>AI CORE</small>
          <strong>ONLINE</strong>
          <span>VERIFIABLE EVIDENCE</span>
        </div>
      </section>
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
              onChange={(event) => setCriteria((current) => ({ ...current, unitQuery: event.target.value }))}
              placeholder="e.g. Gundam Barbatos 1st Form"
            />
            <datalist id="deck-designer-units">
              {unitNames.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
          <label>
            <span>Archetype / strategy</span>
            <select
              value={criteria.archetype}
              onChange={(event) => {
                const archetype = event.target.value;
                const profile = archetypes.find((item) => item.archetype === archetype);
                const inferredColors = inferInitialColors(profile?.commonColorCombination);
                setCriteria((current) => ({
                  ...current,
                  archetype,
                  colors: inferredColors.length ? inferredColors : current.colors,
                }));
              }}
            >
              {archetypes.map((item) => (
                <option key={item.archetype} value={item.archetype}>
                  {item.archetype} · {item.recentDecklists || 0} recent
                </option>
              ))}
            </select>
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
          expandedCard={expandedCard}
          onToggleCard={(cardNumber) => setExpandedCard((current) => current === cardNumber ? "" : cardNumber)}
          onApplySubstitution={applySubstitution}
          onResetSubstitutions={resetSubstitutions}
          onSave={saveRecommendation}
          onEdit={() => onEditDeck?.(savedDeckId)}
          onExportText={() => downloadReport(report, "txt")}
          onExportJson={() => downloadReport(report, "json")}
          savedDeckId={savedDeckId}
          saveMessage={saveMessage}
        />
      ) : null}
    </div>
  );
}

function DesignerResult({
  report,
  expandedCard,
  onToggleCard,
  onApplySubstitution,
  onResetSubstitutions,
  onSave,
  onEdit,
  onExportText,
  onExportJson,
  savedDeckId,
  saveMessage,
}) {
  const groupedRows = groupDeckRows(report.rows);
  const confidenceTone = report.confidence === "High" ? "green" : report.confidence === "Medium" ? "gold" : "red";
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
          <button type="button" onClick={onExportText}>Export TXT</button>
          <button type="button" onClick={onExportJson}>Export JSON</button>
          {report.substitutionHistory?.length ? <button type="button" onClick={onResetSubstitutions}>Reset swaps</button> : null}
        </div>
      </header>
      {saveMessage ? <p className="deck-designer-result__save-status">{saveMessage}</p> : null}

      <div className="deck-designer-result__telemetry">
        <Telemetry label="Main deck" value={`${report.stats.mainCount} / 50`} detail="Legal card count" tone="blue" />
        <Telemetry label="Confidence" value={report.confidence} detail={`${report.facts.exactDecklists || report.exactDeckCount || 0} exact matches`} tone={confidenceTone} />
        <Telemetry label="Average cost" value={report.stats.averageCost} detail="Weighted main-deck curve" tone="green" />
        <Telemetry label="Estimated price" value={`R$ ${report.stats.estimatedPriceBrl.toFixed(2)}`} detail="Lowest tracked printings" tone="gold" />
        <Telemetry label="Evidence" value={`${report.facts.matchedDecklists} lists`} detail={`${report.facts.eventCount} events · ${report.facts.wins} wins`} />
      </div>

      {(report.limitations || []).length ? (
        <div className="deck-designer-result__limitations">
          <strong>Evidence limitations</strong>
          {report.limitations.map((limitation) => <span key={limitation}>{limitation}</span>)}
        </div>
      ) : null}

      <div className="deck-designer-result__layout">
        <div className="deck-designer-list">
          <div className="deck-designer-list__legend">
            <CategoryPill category="essential" />
            <CategoryPill category="flexible" />
            <CategoryPill category="accessible" />
            <CategoryPill category="experimental" />
            <span className="deck-category-pill deck-category-pill--sideboard">Sideboard · not used</span>
          </div>
          {Object.entries(groupedRows).map(([type, costGroups]) => (
            <section key={type} className="deck-designer-list__type">
              <header>
                <h3>{type}</h3>
                <span>{sumRows(Object.values(costGroups).flat())} cards</span>
              </header>
              {Object.entries(costGroups).map(([cost, rows]) => (
                <div key={`${type}-${cost}`} className="deck-designer-list__cost">
                  <span className="deck-designer-list__cost-label">Cost {cost}</span>
                  {rows.map((row) => (
                    <RecommendedCardRow
                      key={row.card.cardNumber}
                      row={row}
                      substitutions={report.substitutions?.[row.card.cardNumber] || []}
                      expanded={expandedCard === row.card.cardNumber}
                      onToggle={() => onToggleCard(row.card.cardNumber)}
                      onApply={(targetCardNumber) => onApplySubstitution(row.card.cardNumber, targetCardNumber)}
                    />
                  ))}
                </div>
              ))}
            </section>
          ))}
          <section className="deck-designer-list__resource">
            <h3>RESOURCE DECK</h3>
            <span>10x {Object.keys(report.resource || {})[0] || "Resource"}</span>
            <small>Separate resource deck · unlimited copies under the current rules snapshot.</small>
          </section>
        </div>

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
    </section>
  );
}

function RecommendedCardRow({ row, substitutions, expanded, onToggle, onApply }) {
  return (
    <article className={`recommended-card ${expanded ? "is-expanded" : ""}`.trim()}>
      <button type="button" className="recommended-card__main" onClick={onToggle} aria-expanded={expanded}>
        <span className="recommended-card__qty">{row.quantity}x</span>
        <CardArt card={row.card} className="recommended-card__art" compact />
        <span className="recommended-card__identity">
          <strong>{row.card.cardName}</strong>
          <em>{row.card.cardNumber} · {row.card.color} · {row.card.cost || "-"} cost</em>
        </span>
        <CategoryPill category={row.category} />
        <span className={`recommendation-confidence recommendation-confidence--${row.confidence.toLowerCase()}`}>
          {row.confidence} confidence
        </span>
        <span className="recommended-card__expand">{substitutions.length ? `${substitutions.length} swaps` : "Details"}</span>
      </button>
      {expanded ? (
        <div className="recommended-card__details">
          <div className="recommended-card__reason">
            <strong>Why this card</strong>
            <p>{row.recommendationReason}</p>
            <span>{row.source === "observed" ? "Observed competitive fact" : "AI inference"} · {Math.round(row.usageRate * 100)}% sample adoption</span>
          </div>
          {substitutions.length ? (
            <div className="recommended-card__substitutions">
              {substitutions.map((substitution) => (
                <SubstitutionCard
                  key={substitution.card.cardNumber}
                  substitution={substitution}
                  sourceQuantity={row.quantity}
                  onApply={() => onApply(substitution.card.cardNumber)}
                />
              ))}
            </div>
          ) : (
            <p className="recommended-card__no-substitution">No sufficiently similar same-color replacement passed the fit threshold.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function SubstitutionCard({ substitution, sourceQuantity, onApply }) {
  const impact = substitution.impact;
  return (
    <article className={`substitution-card substitution-card--${substitution.kind}`}>
      <header>
        <div>
          <span>{substitution.kind === "affordable" ? "Affordable alternative" : substitution.kind === "experimental" ? "Experimental line" : "Flex replacement"}</span>
          <h4>{substitution.card.cardName}</h4>
          <em>{substitution.card.cardNumber} · fit {Math.round(substitution.fitScore * 100)}%</em>
        </div>
        <button type="button" onClick={onApply}>Swap {sourceQuantity}x</button>
      </header>
      <div className="substitution-card__impact">
        <div>
          <strong>Deck gains</strong>
          {substitution.gains.map((item) => <span key={item}>{item}</span>)}
        </div>
        <div>
          <strong>Deck loses</strong>
          {substitution.losses.map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>
      <p><strong>Synergy impact:</strong> {substitution.synergyImpact}</p>
      <p><strong>Use when:</strong> {substitution.recommendation}</p>
      <footer>
        <span>Curve {formatDelta(impact.costDelta)}</span>
        <span>Price {formatCurrencyDelta(impact.priceDelta)}</span>
        <span>Meta signal {formatDelta(impact.metaDelta)}</span>
      </footer>
    </article>
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

function Telemetry({ label, value, detail, tone = "neutral" }) {
  return (
    <article className={`designer-telemetry designer-telemetry--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function CategoryPill({ category }) {
  return <span className={`deck-category-pill deck-category-pill--${category}`}>{category}</span>;
}

function groupDeckRows(rows = []) {
  return rows.reduce((types, row) => {
    const type = row.card.cardType || "OTHER";
    const cost = row.card.cost || "-";
    if (!types[type]) types[type] = {};
    if (!types[type][cost]) types[type][cost] = [];
    types[type][cost].push(row);
    return types;
  }, {});
}

function sumRows(rows) {
  return rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
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

function formatDelta(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${number}`;
}

function formatCurrencyDelta(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : number < 0 ? "-" : ""}R$ ${Math.abs(number).toFixed(2)}`;
}

function downloadReport(report, format) {
  const safeTitle = String(report.title || "deck-recommendation").replace(/[^\w-]+/g, "-").toLowerCase();
  const content = format === "json"
    ? JSON.stringify(exportPayload(report), null, 2)
    : buildTextExport(report);
  const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeTitle}.${format}`;
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

function buildTextExport(report) {
  const groups = groupDeckRows(report.rows);
  const lines = [
    report.title,
    `Generated: ${report.generatedAt}`,
    `Confidence: ${report.confidence}`,
    "",
    "STRATEGY",
    report.strategy,
    "",
    "MAIN DECK",
  ];
  for (const [type, costs] of Object.entries(groups)) {
    lines.push("", type);
    for (const [cost, rows] of Object.entries(costs)) {
      lines.push(`Cost ${cost}`);
      for (const row of rows) lines.push(`${row.quantity}x ${row.card.cardNumber} ${row.card.cardName} [${row.category}; ${row.confidence}]`);
    }
  }
  lines.push("", "RESOURCE", ...Object.entries(report.resource || {}).map(([cardNumber, quantity]) => `${quantity}x ${cardNumber}`));
  lines.push("", "SOURCES");
  for (const source of report.sources || []) lines.push(`${source.name} | ${source.sourceDate || "no source date"} | ${source.url || "no URL"}`);
  return lines.join("\n");
}
