import { useEffect, useMemo, useState } from "react";
import { DeckMap } from "./DeckMap";
import { ZeroForge } from "./ZeroForge.jsx";
import { DeckImageExportLayer } from "./DeckImageExportLayer.jsx";
import { buildExBurstDeckText, downloadDeckText } from "../../domain/deckExport.js";
import { parseMsaDeckList } from "../../domain/deckLibrary.js";
import {
  TacticalDataPanel,
  TacticalEmptyState,
  TacticalLoadingState,
  TacticalStatusBadge,
} from "../tactical/TacticalPageShell";
import {
  analyzeRecommendedDeck,
  analyzeImportedDeck,
  applyRecommendedSubstitution,
  assembleRecommendedDeck,
  buildDeckSourceComparison,
  buildDeckVariantResearch,
  collectDeckResearch,
  getObservedArchetypesForFilters,
  normalizeDeckEvidence,
  scoreRecommendationPool,
} from "../../services/deckDesigner/index.js";
import {
  DESIGNER_COLORS,
  normalizeSearchText,
} from "../../services/deckDesigner/deckDesignerUtils.js";
import { createZeroForgeDraftFromDesignerReport } from "../../services/deckDesigner/zeroForgeEngine.js";
import { getLocaleTag } from "../../i18n/translations.js";
import { useLocale } from "../../i18n/LocaleProvider.jsx";
import { buildMetaWindows } from "../../domain/meta.js";

const ANALYSIS_STAGES = [
  "Collecting competitive decklists",
  "Normalizing cards, events and results",
  "Ranking placements and exact matches",
  "Locking registered 50-card decklists",
  "Explaining synergies and substitutions",
];

const BASIC_SYNERGY_STAGES = [
  "Reading card identity and official effects",
  "Mapping traits, links and tactical roles",
  "Balancing the legal 50-card curve",
  "Checking colors, copy limits and restrictions",
  "Explaining basic synergies and risks",
];

const MSA_ANALYSIS_STAGES = [
  "Reading the MSA decklist",
  "Matching card numbers to the catalog",
  "Checking deck size and legality",
  "Calculating curve and tactical roles",
  "Mapping strengths, weaknesses and synergies",
];

export function DeckDesigner({
  data,
  onSaveRecommendation,
  onEditDeck,
  initialForgeImport,
  onForgeImportConsumed,
  initialCriteria,
  onInitialCriteriaConsumed,
  selectedMetaId,
  onSelectedMetaChange,
}) {
  const { t } = useLocale();
  const defaultArchetype = data.defaults?.template_archetype || data.archetypes?.[0]?.archetype || "";
  const defaultProfile = data.archetypes?.find((item) => item.archetype === defaultArchetype);
  const [criteria, setCriteria] = useState(() => ({
    colors: initialCriteria?.colors?.length
      ? initialCriteria.colors
      : inferInitialColors(defaultProfile?.commonColorCombination),
    unitQuery: "",
    archetype: initialCriteria?.archetype || defaultArchetype,
    selectedMetaId: initialCriteria?.selectedMetaId || selectedMetaId || "current",
    competitiveIntelligence: initialCriteria?.competitiveIntelligence !== false,
    counterArchetype: "",
    preferences: "",
    requiredCards: "",
    excludedCards: "",
    budgetBrl: "",
    focus: "competitive",
  }));
  const [inputMode, setInputMode] = useState("design");
  const [analysisPipeline, setAnalysisPipeline] = useState("design");
  const [msaText, setMsaText] = useState("");
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
  const [imageExportOpen, setImageExportOpen] = useState(false);
  const [zeroForgeOpen, setZeroForgeOpen] = useState(false);
  const [designerForgeDraft, setDesignerForgeDraft] = useState(null);
  const [modeSelectionOpen, setModeSelectionOpen] = useState(false);
  const [preferredSourceDeckId, setPreferredSourceDeckId] = useState("");
  const metaWindows = useMemo(() => buildMetaWindows(data), [data]);
  const archetypes = useMemo(
    () => [...(data.archetypes || [])].sort((left, right) =>
      Number(right.recentDecklists || 0) - Number(left.recentDecklists || 0)
      || String(left.archetype).localeCompare(String(right.archetype))),
    [data.archetypes],
  );
  const counterTargets = useMemo(() => {
    const families = new Map();
    for (const profile of archetypes) {
      const base = String(profile.archetype || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
      if (!base || base === profile.archetype) continue;
      const group = families.get(base) || { value: base, label: `${base} · all variants`, recentDecklists: 0, count: 0 };
      group.recentDecklists += Number(profile.recentDecklists || 0);
      group.count += 1;
      families.set(base, group);
    }
    return [
      ...[...families.values()].filter((group) => group.count > 1),
      ...archetypes.map((profile) => ({
        value: profile.archetype,
        label: profile.archetype,
        recentDecklists: Number(profile.recentDecklists || 0),
      })),
    ];
  }, [archetypes]);
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
      selectedMetaId: criteria.selectedMetaId,
    }),
    [archetypes, criteria.colors, criteria.selectedMetaId, criteria.unitQuery, data, selectedUnitName],
  );
  const hasActiveArchetypeFilters = Boolean(selectedUnitName || criteria.colors.length);
  const report = variantReports[activeVariantIndex] || null;
  const parsedMsaDeck = useMemo(() => parseMsaDeckList(msaText), [msaText]);
  const sourceComparisons = useMemo(() => {
    if (!criteria.competitiveIntelligence || !criteria.archetype.trim()) return [];
    const research = collectDeckResearch(data, criteria);
    return buildDeckSourceComparison(research.deckVariants || []);
  }, [
    criteria.archetype,
    criteria.competitiveIntelligence,
    criteria.counterArchetype,
    criteria.colors,
    criteria.excludedCards,
    criteria.requiredCards,
    criteria.selectedMetaId,
    criteria.unitQuery,
    data,
  ]);
  const effectiveSourceDeckId = sourceComparisons.some((source) => source.deckId === preferredSourceDeckId)
    ? preferredSourceDeckId
    : sourceComparisons[0]?.deckId || "";

  useEffect(() => {
    if (initialForgeImport?.id) setZeroForgeOpen(true);
  }, [initialForgeImport]);

  useEffect(() => {
    if (!initialCriteria?.key) return;
    setCriteria((current) => ({
      ...current,
      archetype: initialCriteria.archetype || current.archetype,
      colors: initialCriteria.colors?.length ? initialCriteria.colors : current.colors,
      selectedMetaId: initialCriteria.selectedMetaId || "current",
    }));
    setInputMode("design");
    setModeSelectionOpen(false);
    setBriefOpen(true);
    setStatus("idle");
    if (initialCriteria.selectedMetaId) onSelectedMetaChange?.(initialCriteria.selectedMetaId);
    onInitialCriteriaConsumed?.();
  }, [initialCriteria?.key]);

  useEffect(() => {
    if (!selectedMetaId) return;
    setCriteria((current) => {
      if (current.selectedMetaId === selectedMetaId) return current;
      const allowedArchetypes = buildAvailableArchetypes(data, archetypes, {
        unitName: selectedUnitName,
        unitQuery: current.unitQuery,
        colors: current.colors,
        selectedMetaId,
      });
      const preservesArchetype = !current.archetype
        || allowedArchetypes.some((item) => item.archetype === current.archetype);
      return {
        ...current,
        selectedMetaId,
        archetype: preservesArchetype ? current.archetype : "",
      };
    });
  }, [archetypes, data, selectedMetaId, selectedUnitName]);

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
    setModeSelectionOpen(false);
    setAnalysisPipeline(criteria.competitiveIntelligence ? "competitive" : "basic");
    setErrorMessage("");
    setSaveMessage("");
    setSavedDeckId("");
    try {
      setActiveStage(0);
      await nextFrame();
      const research = collectDeckResearch(data, criteria);
      const competitiveVariants = research.criteria?.competitiveIntelligence && !research.counterPlan?.active
        ? buildDeckVariantResearch(data, research)
        : [];
      if (research.criteria?.competitiveIntelligence && !competitiveVariants.length && (data.metaResults || []).length) {
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
      const preferredVariantIndex = nextReports.findIndex((variant) =>
        variant.sourceDeck?.deckId === effectiveSourceDeckId);
      setActiveVariantIndex(preferredVariantIndex >= 0 ? preferredVariantIndex : 0);
      setBriefOpen(false);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error.message || "The Deck Designer could not complete this analysis.");
    } finally {
      setActiveStage(-1);
    }
  }

  async function runMsaAnalysis(event) {
    event?.preventDefault();
    if (!parsedMsaDeck.mainCount) {
      setStatus("error");
      setErrorMessage("Paste an MSA decklist with at least one recognizable main-deck entry.");
      return;
    }
    setStatus("loading");
    setModeSelectionOpen(false);
    setAnalysisPipeline("msa");
    setErrorMessage("");
    setSaveMessage("");
    setSavedDeckId("");
    try {
      for (let stage = 0; stage < MSA_ANALYSIS_STAGES.length; stage += 1) {
        setActiveStage(stage);
        await nextFrame();
      }
      const nextReport = analyzeImportedDeck(data, parsedMsaDeck);
      if (!nextReport.rows?.length) {
        throw new Error("None of the pasted MSA card numbers matched the current catalog.");
      }
      setVariantReports([nextReport]);
      setOriginalVariantReports([nextReport]);
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
        selectedMetaId: current.selectedMetaId,
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

  function openModeSelection() {
    setModeSelectionOpen(true);
    setBriefOpen(true);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }

  function resumeCurrentMap() {
    setModeSelectionOpen(false);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }

  function openReportInForge() {
    if (!report) return;
    setDesignerForgeDraft(createZeroForgeDraftFromDesignerReport(report));
    setZeroForgeOpen(true);
  }

  if (!(data.cards || []).length) {
    return (
      <TacticalDataPanel title="TACTICAL DECK SYSTEM" subtitle="Card catalog required">
        <TacticalEmptyState title="No card data" detail="Synchronize the official card snapshot before requesting a recommendation." />
      </TacticalDataPanel>
    );
  }

  return (
    <div className={`deck-designer ${report && !modeSelectionOpen ? "is-engaged" : ""}`.trim()}>
      <section className="bruxao-designer-hero" aria-labelledby="bruxao-designer-title">
        <div className="bruxao-designer-hero__core" aria-hidden="true">
          <span>TTD</span>
          <i />
          <b />
        </div>
        <div className="bruxao-designer-hero__copy">
          <span className="eyebrow">TCG Tactical Database · deck intelligence engine</span>
          <h2 id="bruxao-designer-title"><span>TACTICAL</span> DECK SYSTEM</h2>
          <p>Competitive evidence becomes a connected deck map built for battle decisions.</p>
          <div className="bruxao-designer-hero__signals" aria-label="Designer capabilities">
            <span>Deck link map</span>
            <span>Synergy analysis</span>
            <span>Live substitution impact</span>
          </div>
        </div>
        <div className="bruxao-designer-hero__status">
          <small>SYSTEM ID</small>
          <strong>TTD-01</strong>
          <span>DECK LINK ONLINE</span>
        </div>
      </section>
      <section className="deck-designer-input-mode" aria-label="Choose how to start" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === "design"}
          className={inputMode === "design" ? "is-active" : ""}
          onClick={() => setInputMode("design")}
        >
          <small>BUILD TACTICAL MAP</small>
          <strong>Design a deck</strong>
          <span>Start from colors, a unit or a strategy.</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === "msa"}
          className={inputMode === "msa" ? "is-active" : ""}
          onClick={() => setInputMode("msa")}
        >
          <small>ANALYZE WHAT I PLAY</small>
          <strong>Paste an MSA list</strong>
          <span>Keep every card and reveal curve, strengths and risks.</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={zeroForgeOpen}
          className="deck-designer-input-mode__zero-forge"
          onClick={() => setZeroForgeOpen(true)}
        >
          <small>FORGE FROM ZERO</small>
          <strong>Open ZERO Forge</strong>
          <span>Build on a fullscreen map with live legal suggestions.</span>
        </button>
      </section>
      {modeSelectionOpen && report ? (
        <div className="deck-designer-mode-return" role="status">
          <span>
            <small>CURRENT MAP PRESERVED</small>
            <strong>{report.title}</strong>
          </span>
          <button type="button" onClick={resumeCurrentMap}>RETURN TO CURRENT MAP</button>
        </div>
      ) : null}
      {zeroForgeOpen ? (
        <ZeroForge
          data={data}
          onClose={() => setZeroForgeOpen(false)}
          onSave={onSaveRecommendation}
          onOpenSavedDeck={(deckId) => {
            setZeroForgeOpen(false);
            onEditDeck?.(deckId);
          }}
          initialDraft={designerForgeDraft || initialForgeImport}
          onInitialDraftConsumed={() => {
            if (designerForgeDraft) setDesignerForgeDraft(null);
            else onForgeImportConsumed?.();
          }}
        />
      ) : null}
      <details
        className="deck-designer__brief-frame"
        hidden={inputMode !== "design"}
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
                    selectedMetaId: current.selectedMetaId,
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
          <label className="deck-designer__intelligence-field">
            <span>{t("Competitive intelligence")} <em>{t("optional competitive layer")}</em></span>
            <button
              type="button"
              role="switch"
              aria-checked={criteria.competitiveIntelligence}
              className={criteria.competitiveIntelligence ? "is-enabled" : ""}
              onClick={() => setCriteria((current) => ({
                ...current,
                competitiveIntelligence: !current.competitiveIntelligence,
                counterArchetype: current.competitiveIntelligence ? "" : current.counterArchetype,
              }))}
            >
              <i aria-hidden="true" />
              <strong>{criteria.competitiveIntelligence ? t("ENABLED") : t("BASIC SYNERGY")}</strong>
              <small>{criteria.competitiveIntelligence ? t("Meta, placements and counter plan are active") : t("Uses card text, traits, links and curve only")}</small>
            </button>
          </label>
          <label className="deck-designer__counter-field">
            <span>{t("Counter target")} <em>{t("optional · theory-assisted")}</em></span>
            <select
              value={criteria.counterArchetype}
              disabled={!criteria.competitiveIntelligence}
              onChange={(event) => setCriteria((current) => ({ ...current, counterArchetype: event.target.value }))}
            >
              <option value="">{t("Build for the open field")}</option>
              {counterTargets
                .filter((item) => item.value !== criteria.archetype)
                .map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} · {item.recentDecklists || 0} recent
                  </option>
                ))}
            </select>
            <small>
              {!criteria.competitiveIntelligence
                ? t("Enable competitive intelligence to select a counter target.")
                : criteria.counterArchetype
                ? t("Prioritizes mechanic tags that pressure this opponent profile. It does not claim a measured win rate.")
                : t("Leave empty to optimize for the broad competitive field.")}
            </small>
          </label>
          <label className="deck-designer__meta-field">
            <span>Meta / format <em>evidence scope</em></span>
            <select
              value={criteria.selectedMetaId || "current"}
              onChange={(event) => {
                const selectedMetaId = event.target.value;
                onSelectedMetaChange?.(selectedMetaId);
                setCriteria((current) => {
                  const allowedArchetypes = buildAvailableArchetypes(data, archetypes, {
                    unitName: selectedUnitName,
                    unitQuery: current.unitQuery,
                    colors: current.colors,
                    selectedMetaId,
                  });
                  const preservesArchetype = !current.archetype
                    || allowedArchetypes.some((item) => item.archetype === current.archetype);
                  return {
                    ...current,
                    selectedMetaId,
                    archetype: preservesArchetype ? current.archetype : "",
                  };
                });
              }}
            >
              {metaWindows.map((window) => (
                <option key={window.id} value={window.id}>{window.label}</option>
              ))}
            </select>
            <small>
              {metaWindows.find((window) => window.id === (criteria.selectedMetaId || "current"))?.startDate}
              {" → "}
              {metaWindows.find((window) => window.id === (criteria.selectedMetaId || "current"))?.endDate}
            </small>
          </label>
        </div>

        {criteria.competitiveIntelligence && criteria.archetype && !criteria.counterArchetype && sourceComparisons.length ? (
          <DeckSourcePreview
            sources={sourceComparisons}
            selectedDeckId={effectiveSourceDeckId}
            onSelect={setPreferredSourceDeckId}
          />
        ) : null}

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
        {status === "success" && report && !report.importedDeck ? (
          <DeckOperations
            report={report}
            savedDeckId={savedDeckId}
            onSave={saveRecommendation}
            onEdit={() => onEditDeck?.(savedDeckId)}
            onExportText={() => setExportLayerOpen(true)}
            onExportImage={() => setImageExportOpen(true)}
            onExportJson={() => downloadJsonReport(report)}
            onReset={resetSubstitutions}
          />
        ) : null}
      </details>

      {inputMode === "msa" ? (
        <MsaImportPanel
          data={data}
          parsedDeck={parsedMsaDeck}
          text={msaText}
          onTextChange={setMsaText}
          onAnalyze={runMsaAnalysis}
          busy={status === "loading"}
          operations={status === "success" && report?.importedDeck ? (
            <DeckOperations
              report={report}
              savedDeckId={savedDeckId}
              onSave={saveRecommendation}
              onEdit={() => onEditDeck?.(savedDeckId)}
              onExportText={() => setExportLayerOpen(true)}
              onExportImage={() => setImageExportOpen(true)}
              onExportJson={() => downloadJsonReport(report)}
              onReset={resetSubstitutions}
            />
          ) : null}
        />
      ) : null}

      {status === "loading" ? (
        <AnalysisProgress
          activeStage={activeStage}
          stages={analysisPipeline === "msa"
            ? MSA_ANALYSIS_STAGES
            : analysisPipeline === "competitive" ? ANALYSIS_STAGES : BASIC_SYNERGY_STAGES}
        />
      ) : null}
      {status === "error" ? (
        <div className="deck-designer__error" role="alert">
          <strong>Analysis interrupted</strong>
          <span>{errorMessage}</span>
          <button type="button" onClick={inputMode === "msa" ? runMsaAnalysis : runAnalysis}>Try again</button>
        </div>
      ) : null}
      {status === "idle" && inputMode === "design" ? <DesignerEmptyState data={data} /> : null}
      {status === "success" && report && !modeSelectionOpen ? (
        <DesignerResult
          report={report}
          variants={variantReports}
          activeVariantIndex={activeVariantIndex}
          onSelectVariant={selectVariant}
          onApplySubstitution={applySubstitution}
          onChooseMode={openModeSelection}
          onOpenForge={openReportInForge}
          saveMessage={saveMessage}
        />
      ) : null}
      {exportLayerOpen && report ? (
        <ExBurstExportLayer report={report} onClose={() => setExportLayerOpen(false)} />
      ) : null}
      {imageExportOpen && report ? (
        <DeckImageExportLayer
          deck={report}
          rows={report.rows}
          stats={report.stats}
          onClose={() => setImageExportOpen(false)}
        />
      ) : null}
    </div>
  );
}

function MsaImportPanel({
  data,
  parsedDeck,
  text,
  onTextChange,
  onAnalyze,
  busy,
  operations,
}) {
  const catalogIds = useMemo(() => new Set((data.cards || []).map((card) => card.cardNumber)), [data.cards]);
  const resourceIds = useMemo(() => new Set((data.resourceCards || []).map((card) => card.cardNumber)), [data.resourceCards]);
  const unknownIds = [
    ...Object.keys(parsedDeck.main || {}).filter((cardNumber) => !catalogIds.has(cardNumber)),
    ...Object.keys(parsedDeck.resource || {}).filter((cardNumber) => !resourceIds.has(cardNumber)),
  ];
  const recognizedMain = Object.entries(parsedDeck.main || {})
    .filter(([cardNumber]) => catalogIds.has(cardNumber))
    .reduce((sum, [, quantity]) => sum + Number(quantity || 0), 0);
  const expectedMain = Number(data.rules?.mainDeckSize || 50);
  const expectedResource = Number(data.rules?.resourceDeckSize || 10);
  const hasPastedResources = Object.keys(parsedDeck.resource || {}).length > 0;
  const sizeTone = parsedDeck.mainCount === expectedMain ? "is-good" : parsedDeck.mainCount ? "is-warning" : "";
  const resourceTone = !hasPastedResources || parsedDeck.resourceCount === expectedResource ? "is-good" : "is-warning";

  return (
    <section className="msa-import-console" aria-labelledby="msa-import-title">
      <header>
        <div>
          <span className="eyebrow">01 / MSA DECK LINK</span>
          <h2 id="msa-import-title">Paste your deck. Keep your decisions.</h2>
          <p>The Designer reads the MSA export, validates every card number, then analyzes the list exactly as pasted.</p>
        </div>
        <span className="msa-import-console__status"><i /> LOCAL ANALYSIS</span>
      </header>

      <form onSubmit={onAnalyze}>
        <label className="msa-import-console__payload">
          <span>MSA DECKLIST</span>
          <textarea
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder={"My Deck\n\nMain Deck (50)\n4 Gundam Example [GD01-001]\n\nResource Deck (10)\n10 Resource [R-001]"}
            spellCheck="false"
            autoFocus
          />
          <small>Accepts the full MSA export and compact lines such as 4xGD01-001.</small>
        </label>

        <aside className="msa-import-console__readout" aria-live="polite">
          <span className="eyebrow">LIVE PARSE</span>
          <strong>{text.trim() ? parsedDeck.title : "Awaiting pasted list"}</strong>
          <div>
            <span className={sizeTone}>
              <small>MAIN DECK</small>
              <b>{parsedDeck.mainCount} / {expectedMain}</b>
            </span>
            <span>
              <small>RECOGNIZED</small>
              <b>{recognizedMain}</b>
            </span>
            <span>
              <small>UNIQUE CARDS</small>
              <b>{parsedDeck.uniqueMainCards}</b>
            </span>
            <span className={resourceTone}>
              <small>RESOURCES</small>
              <b>{hasPastedResources ? `${parsedDeck.resourceCount} / ${expectedResource}` : `AUTO / ${expectedResource}`}</b>
            </span>
            <span className={unknownIds.length ? "is-warning" : parsedDeck.mainCount ? "is-good" : ""}>
              <small>NOT FOUND</small>
              <b>{unknownIds.length}</b>
            </span>
          </div>
          {unknownIds.length ? <p>Check these card numbers: <strong>{unknownIds.join(", ")}</strong></p> : null}
          {parsedDeck.ignoredLines.length ? <p>{parsedDeck.ignoredLines.length} line(s) could not be read.</p> : null}
          <button type="submit" disabled={busy || !parsedDeck.mainCount}>
            {busy ? "Analyzing pasted deck..." : "Analyze my MSA deck"}
          </button>
        </aside>
      </form>
      {operations}
    </section>
  );
}

function DeckOperations({
  report,
  savedDeckId,
  onSave,
  onEdit,
  onExportText,
  onExportImage,
  onExportJson,
  onReset,
}) {
  return (
    <aside className="deck-designer__sidebar-actions" aria-label="Deck operations">
      <span className="eyebrow">DECK OPERATIONS</span>
      <button type="button" onClick={onSave}>Save deck</button>
      {savedDeckId ? <button type="button" onClick={onEdit}>Edit in builder</button> : null}
      <div>
        <button type="button" onClick={onExportText}>Export TXT</button>
        <button type="button" className="is-image-export" onClick={onExportImage}>Export image</button>
        <button type="button" onClick={onExportJson}>Export JSON</button>
      </div>
      {report.substitutionHistory?.length ? (
        <button type="button" onClick={onReset}>Reset swaps</button>
      ) : null}
    </aside>
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
        <strong>DATABASE</strong>
        <span>TACTICAL SYSTEM // DECK LINK SYNCHRONIZING</span>
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
  onChooseMode,
  onOpenForge,
  saveMessage,
}) {
  const { t } = useLocale();
  return (
    <section className="deck-designer-result" aria-live="polite">
      <aside className="deck-designer-result__forge-handoff" aria-label={t("Edit this deck in ZERO Forge")}>
        <div>
          <span>{t("DECK READY TO FORGE")}</span>
          <strong>{t("Continue editing this recommendation")}</strong>
          <small>{t("The complete deck will open in ZERO Forge with every card and quantity preserved.")}</small>
        </div>
        <button type="button" onClick={onOpenForge}>
          <span>{t("EDIT THIS DECK")}</span>
          <strong>{t("OPEN IN ZERO FORGE")}</strong>
          <b aria-hidden="true">→</b>
        </button>
      </aside>
      <header className="deck-designer-result__header">
        <div>
          <span className="eyebrow">{report.importedDeck ? "05 / Imported deck analyzed" : "05 / Recommendation online"}</span>
          <h2>{report.title}</h2>
          <p>{t(report.strategy)}</p>
        </div>
        <div className="deck-designer-result__header-tools">
          <nav className="deck-designer-result__mode-actions" aria-label="Deck creation mode">
            <button type="button" onClick={onChooseMode}>← CHOOSE MODE</button>
            <button type="button" onClick={onOpenForge}>EDIT THIS DECK IN ZERO FORGE</button>
          </nav>
          <div className="deck-designer-result__source-signal">
            <span><small>SOURCE</small><strong>{report.importedDeck ? "MSA LIST" : report.sourceDeck?.placingLabel || "AI MODEL"}</strong></span>
            <span><small>PILOT</small><strong>{report.importedDeck ? "YOU" : report.sourceDeck?.playerName || "UNLISTED"}</strong></span>
            <span><small>CONFIDENCE</small><strong>{t(report.confidence)}</strong></span>
          </div>
        </div>
      </header>
      {saveMessage ? <p className="deck-designer-result__save-status">{t(saveMessage)}</p> : null}

      <div className="deck-variant-maps">
        <div className="deck-variant-map is-active">
          <DeckMap
            key={variantMapKey(report, activeVariantIndex)}
            report={report}
            variants={variants}
            activeVariantIndex={activeVariantIndex}
            onSelectVariant={onSelectVariant}
            onApplySubstitution={onApplySubstitution}
          />
        </div>
      </div>

      {(report.limitations || []).length ? (
        <div className="deck-designer-result__limitations">
          <strong>Evidence limitations</strong>
          {report.limitations.map((limitation) => <span key={limitation}>{t(limitation)}</span>)}
        </div>
      ) : null}

      <details className="deck-designer-debrief" open={report.importedDeck ? true : undefined}>
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
            {report.counterPlan?.active ? <CounterPlanPanel plan={report.counterPlan} /> : null}
            <MatchupPanel rows={report.matchups} />
          </aside>
        </div>
        <div className="deck-designer-result__lower-grid">
          <SynergyPanel rows={report.synergies} imported={Boolean(report.importedDeck)} />
          <EvidencePanel report={report} />
        </div>
      </details>
    </section>
  );
}

function CounterPlanPanel({ plan }) {
  const { t } = useLocale();
  return (
    <section className="deck-counter-plan" aria-label={`Counter plan against ${plan.targetArchetype}`}>
      <span className="eyebrow">{t("COUNTER PLAN // THEORY")}</span>
      <strong>{t("Target")}: {plan.targetArchetype}</strong>
      <p>{t("Prioritized answers")}: {plan.answerTags.join(" · ") || t("no mapped mechanics")}.</p>
      {plan.objectives.length ? (
        <ul>{plan.objectives.map((objective) => <li key={objective}>{t(objective)}</li>)}</ul>
      ) : <p>{t("No structured counter tags are available for this profile yet.")}</p>}
      <small>{t("Built from catalog mechanics, not head-to-head game records.")}</small>
    </section>
  );
}

function DeckSourcePreview({ sources, selectedDeckId, onSelect }) {
  const { t } = useLocale();
  return (
    <section className="deck-source-preview" aria-labelledby="deck-source-preview-title">
      <header>
        <div>
          <span className="eyebrow">{t("SOURCE COMPARISON // BEFORE GENERATION")}</span>
          <h3 id="deck-source-preview-title">{t(`${sources.length} registered lists found`)}</h3>
        </div>
        <p>{t("The best result is ranked by finish, event size and recency. Core alignment measures proximity to cards repeated across these lists—not win rate.")}</p>
      </header>
      <div className="deck-source-preview__grid" role="radiogroup" aria-label={t("Choose which registered list should open first")}>
        {sources.map((source, index) => {
          const selected = source.deckId === selectedDeckId;
          const labels = [
            source.isBestFinish ? t("BEST RESULT") : "",
            source.isMostConsistent ? t("FIELD CONSENSUS") : "",
          ].filter(Boolean);
          return (
            <button
              key={source.deckId}
              type="button"
              role="radio"
              aria-checked={selected}
              className={selected ? "is-selected" : ""}
              onClick={() => onSelect(source.deckId)}
            >
              <span className="deck-source-preview__rank">{String(index + 1).padStart(2, "0")}</span>
              <span className="deck-source-preview__badges">
                {(labels.length ? labels : [t("ALTERNATIVE")]).map((label) => <i key={label}>{label}</i>)}
              </span>
              <strong>{source.placingLabel} <em>{source.playerName}</em></strong>
              <span className="deck-source-preview__event">{source.eventName} · {formatDate(source.eventDate)}</span>
              <span className="deck-source-preview__metrics">
                <b>{source.coreAlignment == null ? "—" : `${source.coreAlignment}%`} <small>{t("CORE ALIGNMENT")}</small></b>
                <b>{source.playerCount || "—"} <small>{t("PLAYERS")}</small></b>
                <b>{source.uniqueCards} <small>{t("UNIQUE CARDS")}</small></b>
              </span>
              <span className="deck-source-preview__action">
                {selected ? t("SELECTED FOR MAP") : t("USE AS STARTING LIST")}
              </span>
            </button>
          );
        })}
      </div>
      <footer><i /> {t("This list will open first. All source lists stay available as tabs after generation.")}</footer>
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

function AnalysisProgress({ activeStage, stages = ANALYSIS_STAGES }) {
  return (
    <section className="deck-designer-progress" aria-live="polite">
      <TacticalLoadingState label={stages[activeStage] || "Starting deck agent..."} />
      <ol>
        {stages.map((stage, index) => (
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
  const { t } = useLocale();
  const curve = Object.entries(stats.curve || {}).sort((left, right) => Number(left[0]) - Number(right[0]));
  const max = Math.max(...curve.map(([, count]) => count), 1);
  return (
    <section className="designer-analysis-panel designer-curve-panel">
      <header><h3>{t("Cost curve")}</h3><span>{stats.averageCost} {t("avg.")}</span></header>
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
  const { t } = useLocale();
  return (
    <section className={`designer-analysis-panel designer-insight-panel designer-insight-panel--${tone}`}>
      <h3>{t(title)}</h3>
      {items.map((item) => <p key={item}>{t(item)}</p>)}
    </section>
  );
}

function MatchupPanel({ rows = [] }) {
  const { t } = useLocale();
  return (
    <section className="designer-analysis-panel designer-matchup-panel">
      <header><h3>{t("Probable matchups")}</h3><span>{t("theory only")}</span></header>
      {rows.map((row) => (
        <article key={row.opponent}>
          <strong>{t(row.opponent)}</strong>
          <span>{t(row.outlook)} · {t("Confidence")}: {t(row.confidence)}</span>
          <p>{t(row.basis)}</p>
        </article>
      ))}
    </section>
  );
}

function SynergyPanel({ rows = [], imported = false }) {
  const { t } = useLocale();
  return (
    <TacticalDataPanel
      title={t("Primary synergies and combos")}
      subtitle={t(imported
        ? "Each combination appears once. Quantities are preserved from the imported list; contextual bridges remain labeled as inference."
        : "Each combination appears once. Quantities are the suggested copies for this build; contextual bridges remain labeled as inference.")}
    >
      <div className="designer-synergy-list">
        {rows.map((row) => (
          <article key={row.id}>
            <header>
              <div className="designer-synergy-card">
                <strong>{row.sourceCard.cardName}</strong>
                <small>{row.sourceCopies || 0}x</small>
              </div>
              <span>+</span>
              <div className="designer-synergy-card">
                <strong>{row.targetCard.cardName}</strong>
                <small>{row.targetCopies || 0}x</small>
              </div>
              <TacticalStatusBadge tone={row.confidence === "High" ? "green" : row.confidence === "Medium" ? "blue" : "gold"}>
                {t(row.confidence)}
              </TacticalStatusBadge>
            </header>
            <p>{t(row.explanation)}</p>
            {row.facts.map((fact) => <span key={fact}>{t(fact)}</span>)}
            {row.inference ? <em>{t(row.inference)}</em> : null}
          </article>
        ))}
      </div>
    </TacticalDataPanel>
  );
}

function EvidencePanel({ report }) {
  const { t } = useLocale();
  return (
    <TacticalDataPanel title={t("Evidence and sources")} subtitle={t(report.evidenceSummary)}>
      <div className="designer-evidence-list">
        {(report.sources || []).map((source, index) => (
          <article key={`${source.name}-${source.url}-${index}`}>
            <span>{t(source.classification?.replaceAll("_", " "))}</span>
            <strong>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> : source.name}</strong>
            <p>{t(source.detail)}</p>
            <em>{t(`Source date: ${source.sourceDate || "not published"} · consulted ${formatDate(source.consultationDate)}`)}</em>
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
  return normalizeSearchText(value);
}

function variantMapKey(variant, index) {
  return String(
    variant?.sourceDeck?.deckId
    || variant?.importedDeck?.id
    || variant?.title
    || `recommendation-${index}`,
  );
}

function formatMatchingDeckCount(value) {
  const count = Number(value || 0);
  return `${count} matching ${count === 1 ? "deck" : "decks"}`;
}

function buildAvailableArchetypes(data, archetypes, {
  unitName = "",
  unitQuery = "",
  colors = [],
  selectedMetaId = "",
} = {}) {
  if (String(unitQuery || "").trim() && !unitName) return [];
  if (!unitName && !colors.length && !selectedMetaId) return archetypes;

  const profiles = new Map(archetypes.map((item) => [item.archetype, item]));
  return getObservedArchetypesForFilters(data, {
    unitQuery: unitName,
    colors,
    selectedMetaId,
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
