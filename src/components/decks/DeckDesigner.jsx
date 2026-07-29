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
  buildDeckVariantResearch,
  collectDeckResearch,
  getObservedArchetypesForFilters,
  normalizeDeckEvidence,
  scoreRecommendationPool,
} from "../../services/deckDesigner/index.js";
import { DESIGNER_COLORS } from "../../services/deckDesigner/deckDesignerUtils.js";
import { getLocaleTag } from "../../i18n/translations.js";

const ANALYSIS_STAGES = [
  "Collecting competitive decklists",
  "Normalizing cards, events and results",
  "Ranking placements and exact matches",
  "Locking registered 50-card decklists",
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
  const [variantReports, setVariantReports] = useState([]);
  const [originalVariantReports, setOriginalVariantReports] = useState([]);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [briefOpen, setBriefOpen] = useState(true);
  const [savedDeckId, setSavedDeckId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [exportLayerOpen, setExportLayerOpen] = useState(false);
  const [hudBooting, setHudBooting] = useState(() => !prefersReducedMotion());
  const [hudSystem] = useState(getHudSystemLabel);
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
  const selectedUnitName = useMemo(() => {
    const requested = normalizeSelectionValue(criteria.unitQuery);
    return requested
      ? unitNames.find((name) => normalizeSelectionValue(name) === requested) || ""
      : "";
  }, [criteria.unitQuery, unitNames]);
  const availableArchetypes = useMemo(
    () => buildAvailableArchetypes(data, archetypes, {
      unitName: selectedUnitName,
      unitQuery: criteria.unitQuery,
      colors: criteria.colors,
    }),
    [archetypes, criteria.colors, criteria.unitQuery, data, selectedUnitName],
  );
  const hasActiveArchetypeFilters = Boolean(selectedUnitName || criteria.colors.length);
  const report = variantReports[activeVariantIndex] || null;

  useEffect(() => {
    if (!hudBooting) return undefined;
    const timer = window.setTimeout(() => setHudBooting(false), 2300);
    return () => window.clearTimeout(timer);
  }, [hudBooting]);

  useEffect(() => {
    if (status !== "success") return undefined;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [status]);

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
      const competitiveVariants = buildDeckVariantResearch(data, research);
      if (!competitiveVariants.length && (data.metaResults || []).length) {
        throw new Error("No complete registered decklist matched these filters. Remove a constraint or choose another unit/archetype.");
      }
      const researchSets = competitiveVariants.length ? competitiveVariants : [research];

      setActiveStage(1);
      await nextFrame();
      const normalizedSets = researchSets.map((variantResearch) =>
        normalizeDeckEvidence(data, variantResearch));

      setActiveStage(2);
      await nextFrame();
      const scoredSets = normalizedSets.map((normalized) =>
        scoreRecommendationPool(data, normalized, normalized.criteria));

      setActiveStage(3);
      await nextFrame();
      const assembledSets = scoredSets.map((scored) =>
        assembleRecommendedDeck(data, scored, scored.criteria));
      if (assembledSets.some((assembled) =>
        assembled.mainCount !== Number(data.rules?.mainDeckSize || 50))) {
        throw new Error("The recommendation engine could not assemble a legal main-deck size.");
      }

      setActiveStage(4);
      await nextFrame();
      const nextReports = assembledSets.map((assembled) =>
        analyzeRecommendedDeck(data, assembled, assembled.criteria));
      setVariantReports(nextReports);
      setOriginalVariantReports(nextReports);
      setActiveVariantIndex(0);
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
      const colors = selected
        ? current.colors.filter((item) => item !== color)
        : [...current.colors, color];
      const nextAvailableArchetypes = buildAvailableArchetypes(data, archetypes, {
        unitName: selectedUnitName,
        unitQuery: current.unitQuery,
        colors,
      });
      const preservesArchetype = !current.archetype
        || nextAvailableArchetypes.some((item) => item.archetype === current.archetype);
      return {
        ...current,
        colors,
        archetype: preservesArchetype ? current.archetype : "",
      };
    });
  }

  function applySubstitution(sourceCardNumber, targetCardNumber) {
    setVariantReports((current) => current.map((variant, index) =>
      index === activeVariantIndex
        ? applyRecommendedSubstitution(variant, sourceCardNumber, targetCardNumber, data)
        : variant));
    setSavedDeckId("");
    setSaveMessage("Deck changed. Statistics, curve and synergies were recalculated.");
  }

  function resetSubstitutions() {
    setVariantReports((current) => current.map((variant, index) =>
      index === activeVariantIndex
        ? originalVariantReports[index]
        : variant));
    setSavedDeckId("");
    setSaveMessage("Original recommendation restored.");
  }

  function selectVariant(index) {
    setActiveVariantIndex(index);
    setSavedDeckId("");
    setSaveMessage("");
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
      {hudBooting ? (
        <HudBootSequence system={hudSystem} onSkip={() => setHudBooting(false)} />
      ) : null}
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
            {criteria.archetype || (selectedUnitName ? "UNIT-LOCKED AUTO STRATEGY" : criteria.unitQuery ? "SELECT A LISTED UNIT" : "OPEN STRATEGY")}
            {" · "}
            {criteria.colors.join(" / ") || "AUTO COLORS"}
          </strong>
          <em>{briefOpen ? "COLLAPSE" : "RECONFIGURE"}</em>
        </summary>
        <form
          className={`deck-designer__brief tactical-data-panel ${selectedUnitName ? "is-unit-locked" : criteria.unitQuery.trim() ? "is-unit-pending" : ""}`.trim()}
          onSubmit={runAnalysis}
        >
        <div className="deck-designer__cockpit-frame" aria-hidden="true">
          <span className="deck-designer__cockpit-strut deck-designer__cockpit-strut--left" />
          <span className="deck-designer__cockpit-strut deck-designer__cockpit-strut--right" />
          <span className="deck-designer__cockpit-reticle"><i /><b /></span>
        </div>
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
          <label className="deck-designer__unit-field">
            <span>Main Mobile Suit <em>optional</em></span>
            <input
              list="deck-designer-units"
              value={criteria.unitQuery}
              onChange={(event) => {
                const unitQuery = event.target.value;
                const nextSelectedUnit = unitNames.find((name) =>
                  normalizeSelectionValue(name) === normalizeSelectionValue(unitQuery)) || "";
                setCriteria((current) => {
                  const allowedArchetypes = buildAvailableArchetypes(data, archetypes, {
                    unitName: nextSelectedUnit,
                    unitQuery,
                    colors: current.colors,
                  });
                  const preservesArchetype = !current.archetype
                    || allowedArchetypes.some((item) => item.archetype === current.archetype);
                  return {
                    ...current,
                    unitQuery,
                    archetype: preservesArchetype ? current.archetype : "",
                  };
                });
              }}
              placeholder="e.g. Gundam Barbatos 1st Form"
            />
            <datalist id="deck-designer-units">
              {unitNames.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
          <label className="deck-designer__strategy-field">
            <span>
              Archetype / strategy
              <em>
                {selectedUnitName
                  ? "restricted to observed unit decks"
                  : criteria.colors.length
                    ? "restricted by selected colors"
                    : "optional · auto when blank"}
              </em>
            </span>
            <select
              value={criteria.archetype}
              disabled={Boolean(criteria.unitQuery.trim()) && !selectedUnitName}
              onChange={(event) => {
                const archetype = event.target.value;
                const profile = availableArchetypes.find((item) => item.archetype === archetype);
                const inferredColors = inferInitialColors(profile?.commonColorCombination);
                setCriteria((current) => ({
                  ...current,
                  archetype,
                  colors: current.colors.length
                    ? current.colors
                    : inferredColors.length
                      ? inferredColors
                      : current.colors,
                }));
              }}
            >
              <option value="">
                {criteria.unitQuery.trim() && !selectedUnitName
                  ? "Select a listed Mobile Suit first"
                  : selectedUnitName
                    ? "Infer the strongest observed strategy"
                    : "Infer the best strategy from my selection"}
              </option>
              {availableArchetypes.map((item) => (
                <option key={item.archetype} value={item.archetype}>
                  {item.archetype} · {hasActiveArchetypeFilters
                    ? formatMatchingDeckCount(item.matchingDecklists)
                    : `${item.recentDecklists || 0} recent`}
                </option>
              ))}
            </select>
            <small className={`deck-designer__strategy-signal ${hasActiveArchetypeFilters ? "is-locked" : criteria.unitQuery.trim() ? "is-pending" : ""}`.trim()} aria-live="polite">
              {selectedUnitName ? (
                <>
                  <b>UNIT LINKED</b>
                  <span>
                    {availableArchetypes.length ? (
                      <>
                        <strong>{availableArchetypes.length}</strong>
                        {" "}
                        <span>observed strategies contain</span>
                        {" "}
                        <strong>{selectedUnitName}</strong>.
                      </>
                    ) : (
                      <>
                        <span>No legal competitive archetype currently contains this unit.</span>
                        {" "}
                        <span>Automatic unit inference remains available.</span>
                      </>
                    )}
                  </span>
                </>
              ) : criteria.colors.length ? (
                <>
                  <b>COLOR FILTER ACTIVE</b>
                  <span>
                    <strong>{availableArchetypes.length}</strong>
                    {" "}
                    <span>observed strategies match</span>
                    {" "}
                    <strong>{criteria.colors.join(" / ")}</strong>.
                  </span>
                </>
              ) : criteria.unitQuery.trim() ? (
                <span>Choose a Mobile Suit from the list to lock the strategy matrix.</span>
              ) : (
                <span>Leave blank to let the agent infer a competitive color and strategy shell.</span>
              )}
            </small>
          </label>
          <label className="deck-designer__focus-field">
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
        {status === "success" && report ? (
          <aside className="deck-designer__sidebar-actions" aria-label="Deck operations">
            <span className="eyebrow">DECK OPERATIONS</span>
            <button type="button" onClick={saveRecommendation}>Save deck</button>
            {savedDeckId ? <button type="button" onClick={() => onEditDeck?.(savedDeckId)}>Edit in builder</button> : null}
            <div>
              <button type="button" onClick={() => setExportLayerOpen(true)}>Export TXT</button>
              <button type="button" onClick={() => downloadJsonReport(report)}>Export JSON</button>
            </div>
            {report.substitutionHistory?.length ? (
              <button type="button" onClick={resetSubstitutions}>Reset swaps</button>
            ) : null}
          </aside>
        ) : null}
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
          variants={variantReports}
          activeVariantIndex={activeVariantIndex}
          onSelectVariant={selectVariant}
          onApplySubstitution={applySubstitution}
          saveMessage={saveMessage}
        />
      ) : null}
      {exportLayerOpen && report ? (
        <ExBurstExportLayer report={report} onClose={() => setExportLayerOpen(false)} />
      ) : null}
    </div>
  );
}

function HudBootSequence({ system, onSkip }) {
  return (
    <div className="bruxao-hud-boot" role="status" aria-label={`${system} initializing`}>
      <div className="bruxao-hud-boot__shutter bruxao-hud-boot__shutter--top" aria-hidden="true" />
      <div className="bruxao-hud-boot__shutter bruxao-hud-boot__shutter--bottom" aria-hidden="true" />
      <div className="bruxao-hud-boot__ignition" aria-hidden="true">
        <i />
        <b />
      </div>
      <div className="bruxao-hud-boot__scan" aria-hidden="true" />
      <div className="bruxao-hud-boot__copy">
        <small>{system}</small>
        <strong>BRUXÃO</strong>
        <span>PILOT POTTER // DECK LINK SYNCHRONIZING</span>
      </div>
      <button type="button" onClick={onSkip}>SKIP BOOT</button>
    </div>
  );
}

function DesignerResult({
  report,
  variants,
  activeVariantIndex,
  onSelectVariant,
  onApplySubstitution,
  saveMessage,
}) {
  return (
    <section className="deck-designer-result" aria-live="polite">
      <header className="deck-designer-result__header">
        <div>
          <span className="eyebrow">05 / Recommendation online</span>
          <h2>{report.title}</h2>
          <p>{report.strategy}</p>
        </div>
        <div className="deck-designer-result__source-signal">
          <span><small>SOURCE RESULT</small><strong>{report.sourceDeck?.placingLabel || "AI MODEL"}</strong></span>
          <span><small>PILOT</small><strong>{report.sourceDeck?.playerName || "BRUXÃO"}</strong></span>
          <span><small>CONFIDENCE</small><strong>{report.confidence}</strong></span>
        </div>
      </header>
      {saveMessage ? <p className="deck-designer-result__save-status">{saveMessage}</p> : null}

      <DeckVariantSelector
        variants={variants}
        activeVariantIndex={activeVariantIndex}
        onSelectVariant={onSelectVariant}
      />

      <div className="deck-variant-maps">
        {variants.map((variant, index) => (
          <div
            key={variant.sourceDeck?.deckId || `theoretical-${index}`}
            className={`deck-variant-map ${index === activeVariantIndex ? "is-active" : ""}`.trim()}
            hidden={index !== activeVariantIndex}
          >
            <DeckMap report={variant} onApplySubstitution={onApplySubstitution} />
          </div>
        ))}
      </div>

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
    </section>
  );
}

function DeckVariantSelector({ variants, activeVariantIndex, onSelectVariant }) {
  const sourceVariants = variants.filter((variant) => variant.sourceDeck);
  if (!sourceVariants.length) return null;
  const active = variants[activeVariantIndex]?.sourceDeck;

  return (
    <section className="deck-variant-selector" aria-label="Competitive deck variants">
      <header>
        <div>
          <span className="eyebrow">COMPETITIVE DECK FEED // INTACT LISTS</span>
          <h3>Choose the source deck</h3>
        </div>
        <p>The primary map uses the best finish, then event size and recency. Every variant is a separate registered list—quantities and relationships never mix.</p>
      </header>
      <div className="deck-variant-selector__tabs" role="tablist" aria-label="Available source decks">
        {variants.map((variant, index) => {
          const source = variant.sourceDeck;
          if (!source) return null;
          const selected = index === activeVariantIndex;
          return (
            <button
              key={source.deckId}
              type="button"
              role="tab"
              aria-selected={selected}
              className={selected ? "is-active" : ""}
              onClick={() => onSelectVariant(index)}
            >
              <small>{index === 0 ? "PRIMARY TARGET" : `VARIANT ${String(index + 1).padStart(2, "0")}`}</small>
              <strong>{source.placingLabel || `#${source.placingRank}`} <i>{source.playerName}</i></strong>
              <span>{source.archetype} · {source.colorCombination}</span>
              <em>{source.eventName} · {formatDate(source.eventDate)}</em>
            </button>
          );
        })}
      </div>
      {active ? (
        <footer>
          <span>
            <b>{active.modified ? "LOCAL VARIANT" : "LOCKED SOURCE"}</b>
            {active.modified ? " Substitutions applied to this map only" : ` ${active.mainCount} cards reproduced from the registered list`}
          </span>
          <nav>
            {active.deckUrl ? <a href={active.deckUrl} target="_blank" rel="noreferrer">Open decklist</a> : null}
            {active.sourceUrl ? <a href={active.sourceUrl} target="_blank" rel="noreferrer">Open event source</a> : null}
          </nav>
        </footer>
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

function normalizeSelectionValue(value = "") {
  return String(value || "").trim().toLocaleLowerCase();
}

function formatMatchingDeckCount(value) {
  const count = Number(value || 0);
  return `${count} matching ${count === 1 ? "deck" : "decks"}`;
}

function buildAvailableArchetypes(data, archetypes, { unitName = "", unitQuery = "", colors = [] } = {}) {
  if (String(unitQuery || "").trim() && !unitName) return [];
  if (!unitName && !colors.length) return archetypes;

  const profiles = new Map(archetypes.map((item) => [item.archetype, item]));
  return getObservedArchetypesForFilters(data, {
    unitQuery: unitName,
    colors,
  }).map((observed) => ({
    ...(profiles.get(observed.archetype) || {}),
    ...observed,
  }));
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

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function getHudSystemLabel() {
  if (typeof document === "undefined") return "ZERO SYSTEM // DECK LINK";
  const theme = document.body?.dataset?.theme;
  if (theme === "barbatos") return "ALAYA-VIJNANA // NEURAL LINK";
  if (theme === "gquuuuuux") return "OMEGA PSYCOMMU SYSTEM // DECK LINK";
  if (theme === "wing-zero") return "ZERO SYSTEM // DECK LINK";
  return "MOBILE SUIT // TACTICAL LINK";
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
    assemblyMode: report.assemblyMode,
    sourceDeck: report.sourceDeck,
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
