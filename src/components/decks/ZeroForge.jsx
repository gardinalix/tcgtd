import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CardArt } from "../cards/CardArt.jsx";
import { ExBurstExportLayer } from "./ExBurstExportLayer.jsx";
import { DeckAssistantPanel } from "./DeckAssistantPanel.jsx";
import { ForgeDeckViews } from "./ForgeDeckViews.jsx";
import { ForgeRecommendations } from "./ForgeRecommendations.jsx";
import { parseMsaDeckList } from "../../domain/deckLibrary.js";
import {
  buildZeroForgeSaveReport,
  buildZeroForgeWorkspace,
  describeZeroForgeCardState,
  evaluateZeroForgeAddition,
  prepareZeroForgeMsaImport,
} from "../../services/deckDesigner/zeroForgeEngine.js";
import {
  createCompetitiveMetaConfig,
  createForgeImportFromResult,
  getCompetitiveRecommendations,
} from "../../services/deckDesigner/competitiveMeta.js";
import {
  applyDeckChangeSuggestion,
  createDeckDiff,
  createHistoryEntry,
} from "../../services/deckDesigner/deckChangeHistory.js";
import { buildDeckAssistantContext } from "../../services/deckDesigner/deckAssistant.js";
import {
  applyForgeNodePositions,
  buildForgeLayout,
  calculateForgeFitScroll,
  calculateForgeFitZoom,
  forgeLinkEndpoints,
  forgeNodeSize,
  FORGE_STAGE_WIDTH,
} from "../../services/deckDesigner/zeroForgeMapLayout.js";
import { calculateMapRevealScroll } from "../../services/deckDesigner/zeroForgeMapNavigation.js";
import { filterCards, uniqueValues } from "../../utils/cardFilters.js";
import { useLocale } from "../../i18n/LocaleProvider.jsx";

const MIN_MAP_ZOOM = 0.5;
const MAX_MAP_ZOOM = 1.7;
const MAP_ZOOM_STEP = 0.1;

export function ZeroForge({
  data,
  onClose,
  onSave,
  onOpenSavedDeck,
  initialDraft,
  onInitialDraftConsumed,
}) {
  const { t } = useLocale();
  const [main, setMain] = useState({});
  const [resource, setResource] = useState({});
  const [focusCardNumber, setFocusCardNumber] = useState("");
  const [deckName, setDeckName] = useState("ZERO Forge Deck");
  const [search, setSearch] = useState("");
  const [color, setColor] = useState("Any");
  const [type, setType] = useState("Any");
  const [cost, setCost] = useState("");
  const [signal, setSignal] = useState({
    tone: "neutral",
    text: "Select or drag the first card to establish the deck anchor.",
  });
  const [dragActive, setDragActive] = useState(false);
  const [savedDeckId, setSavedDeckId] = useState("");
  const [preview, setPreview] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [sourceMode, setSourceMode] = useState("zero");
  const [mapZoom, setMapZoom] = useState(1);
  const [nodePositions, setNodePositions] = useState({});
  const [isMapPanning, setIsMapPanning] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState("");
  const [selectedMetaId, setSelectedMetaId] = useState(initialDraft?.selectedMetaId || "current");
  const [deckViewMode, setDeckViewMode] = useState("map");
  const [groupBy, setGroupBy] = useState("cost");
  const [sortBy, setSortBy] = useState("cost");
  const [mobilePanel, setMobilePanel] = useState("deck");
  const [intelTab, setIntelTab] = useState("analysis");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [sourceMetadata, setSourceMetadata] = useState(initialDraft?.sourceMetadata || null);
  const [originalMain, setOriginalMain] = useState(initialDraft?.originalMain || {});
  const [changeHistory, setChangeHistory] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const mapScrollportRef = useRef(null);
  const mapZoomRef = useRef(1);
  const mapPanSessionRef = useRef(null);
  const mapNodeDragSessionRef = useRef(null);
  const ignoreMapNodeClickRef = useRef("");
  const pendingMapRevealRef = useRef("");
  const loadedImportRef = useRef("");

  const cards = data.cards || [];
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.cardNumber, card])), [cards]);
  const workspace = useMemo(
    () => buildZeroForgeWorkspace(data, main, focusCardNumber, { limit: 8 }),
    [data, focusCardNumber, main],
  );
  const visibleCards = useMemo(() => filterCards(cards, {
    search,
    color,
    type,
    cost,
    rarity: "Any",
    set: "Any",
    trait: "",
  })
    .sort((left, right) =>
      Number(Boolean(workspace.availability[right.cardNumber]?.allowed))
      - Number(Boolean(workspace.availability[left.cardNumber]?.allowed))
      || Number(right.recentTop8DecksUsing || 0) - Number(left.recentTop8DecksUsing || 0)
      || String(left.cardName).localeCompare(String(right.cardName)))
    .slice(0, 120), [cards, color, cost, search, type, workspace.availability]);
  const colors = useMemo(() => uniqueValues(cards, (card) => card.color), [cards]);
  const types = useMemo(() => uniqueValues(cards, (card) => card.cardType), [cards]);
  const focusedCard = cardMap.get(focusCardNumber) || workspace.rows[0]?.card || null;
  const layout = useMemo(
    () => buildForgeLayout(workspace.rows, workspace.suggestions, focusCardNumber),
    [focusCardNumber, workspace.rows, workspace.suggestions],
  );
  const positionedLayout = useMemo(
    () => applyForgeNodePositions(layout, nodePositions),
    [layout, nodePositions],
  );
  const parsedMsaDeck = useMemo(() => parseMsaDeckList(importText), [importText]);
  const msaImport = useMemo(
    () => prepareZeroForgeMsaImport(data, parsedMsaDeck),
    [data, parsedMsaDeck],
  );
  const exportReport = useMemo(() => ({
    title: deckName,
    main,
    resource,
    rows: workspace.rows,
    stats: {
      ...workspace.stats,
      mainCount: workspace.mainCount,
    },
  }), [deckName, main, resource, workspace.mainCount, workspace.rows, workspace.stats]);
  const metaConfig = useMemo(() => createCompetitiveMetaConfig(data), [data]);
  const competitiveRecommendations = useMemo(
    () => getCompetitiveRecommendations(data, selectedMetaId).slice(0, 40),
    [data, selectedMetaId],
  );
  const sourceDiff = useMemo(
    () => createDeckDiff(originalMain, main),
    [main, originalMain],
  );
  const assistantContext = useMemo(() => buildDeckAssistantContext({
    data,
    deckName,
    selectedMetaId,
    workspace,
    main,
    sourceMetadata,
    originalMain,
    recentChanges: changeHistory,
    relevantMetaDecks: competitiveRecommendations,
  }), [changeHistory, competitiveRecommendations, data, deckName, main, originalMain, selectedMetaId, sourceMetadata, workspace]);

  useEffect(() => {
    document.body.classList.add("zero-forge-active");
    return () => document.body.classList.remove("zero-forge-active");
  }, []);

  useEffect(() => {
    if (!initialDraft?.id || loadedImportRef.current === initialDraft.id) return;
    loadedImportRef.current = initialDraft.id;
    loadForgeImport(initialDraft, initialDraft.sourceMetadata?.sourceType === "deck_designer" ? "designer" : "tournament");
    onInitialDraftConsumed?.();
  }, [initialDraft, onInitialDraftConsumed]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      if (exportOpen) {
        setExportOpen(false);
        return;
      }
      if (importOpen) {
        setImportOpen(false);
        return;
      }
      onClose?.();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [exportOpen, importOpen, onClose]);

  useEffect(() => {
    const liveNodeIds = new Set([
      ...workspace.rows.map((row) => row.card.cardNumber),
      ...workspace.suggestions.map((suggestion) => `ghost:${suggestion.card.cardNumber}`),
    ]);
    setNodePositions((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([nodeId]) => liveNodeIds.has(nodeId)),
      );
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [workspace.rows, workspace.suggestions]);

  useEffect(() => {
    const nodeId = pendingMapRevealRef.current;
    const position = positionedLayout.positions.get(nodeId);
    const scrollport = mapScrollportRef.current;
    if (!nodeId || !position || !scrollport) return undefined;

    const frame = globalThis.requestAnimationFrame?.(() => {
      const nextScroll = calculateMapRevealScroll({
        position,
        nodeSize: forgeNodeSize(nodeId),
        zoom: mapZoomRef.current,
        viewportWidth: scrollport.clientWidth,
        viewportHeight: scrollport.clientHeight,
        scrollLeft: scrollport.scrollLeft,
        scrollTop: scrollport.scrollTop,
        padding: 56,
      });
      scrollport.scrollLeft = nextScroll.scrollLeft;
      scrollport.scrollTop = nextScroll.scrollTop;
      pendingMapRevealRef.current = "";
    });

    return () => globalThis.cancelAnimationFrame?.(frame);
  }, [positionedLayout]);

  function commitMain(nextMain, label, origin = "pilot") {
    const resolved = typeof nextMain === "function" ? nextMain(main) : nextMain;
    const diff = createDeckDiff(main, resolved);
    if (!diff.changedCards) return false;
    const entry = createHistoryEntry(main, resolved, { label, origin });
    setUndoStack((current) => [...current, { main: { ...main }, entry }].slice(-50));
    setRedoStack([]);
    setChangeHistory((current) => [...current, entry].slice(-100));
    setMain(resolved);
    return true;
  }

  function undoChange() {
    const target = undoStack.at(-1);
    if (!target) return;
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, { main: { ...main }, entry: target.entry }].slice(-50));
    setMain(target.main);
    setSavedDeckId("");
    setSignal({ tone: "neutral", text: `Desfeito: ${target.entry.label}.` });
  }

  function redoChange() {
    const target = redoStack.at(-1);
    if (!target) return;
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, { main: { ...main }, entry: target.entry }].slice(-50));
    setMain(target.main);
    setSavedDeckId("");
    setSignal({ tone: "allowed", text: `Refeito: ${target.entry.label}.` });
  }

  function addCard(cardNumber, origin = "catalog") {
    const card = cardMap.get(cardNumber);
    if (!card) return;
    setPreview(null);
    const projectedSuggestion = origin === "suggestion"
      ? workspace.suggestions.find((suggestion) => suggestion.card.cardNumber === cardNumber)
      : null;
    if (projectedSuggestion?.action === "replace") {
      const replacedCard = cardMap.get(projectedSuggestion.replaceCardNumber);
      const replacedQuantity = Number(main[projectedSuggestion.replaceCardNumber] || 0);
      if (!replacedCard || !replacedQuantity) {
        setSignal({ tone: "blocked", text: "That projected swap is no longer current. Review the refreshed recommendations." });
        return;
      }
      const reducedMain = { ...main };
      if (replacedQuantity === 1) delete reducedMain[replacedCard.cardNumber];
      else reducedMain[replacedCard.cardNumber] = replacedQuantity - 1;
      const swapAssessment = evaluateZeroForgeAddition(data, reducedMain, card);
      if (!swapAssessment.allowed) {
        setSignal({ tone: "blocked", text: swapAssessment.reason });
        return;
      }
      pendingMapRevealRef.current = cardNumber;
      setFocusCardNumber(cardNumber);
      commitMain(swapAssessment.nextMain, `Swap ${replacedCard.cardName} for ${card.cardName}`, "recommendation");
      setSavedDeckId("");
      setSignal({
        tone: "allowed",
        text: `${card.cardName} accepted as a legal swap for ${replacedCard.cardName}.`,
      });
      return;
    }
    const assessment = evaluateZeroForgeAddition(data, main, card);
    if (!assessment.allowed) {
      setSignal({ tone: "blocked", text: assessment.reason });
      return;
    }
    pendingMapRevealRef.current = cardNumber;
    setFocusCardNumber(cardNumber);
    commitMain(
      assessment.nextMain,
      `${card.cardName}: ${Number(main[cardNumber] || 0)} → ${Number(assessment.nextMain[cardNumber] || 0)}`,
      origin === "suggestion" ? "recommendation" : "pilot",
    );
    setSavedDeckId("");
    setSignal({
      tone: "allowed",
      text: origin === "suggestion"
        ? `${card.cardName} accepted from the projected synergy line.`
        : `${card.cardName} added. The tactical map and projections were recalculated.`,
    });
  }

  function removeCard(cardNumber) {
    const current = Number(main[cardNumber] || 0);
    if (!current) return;
    const next = { ...main };
    if (current === 1) delete next[cardNumber];
    else next[cardNumber] = current - 1;
    commitMain(next, `${cardMap.get(cardNumber)?.cardName || cardNumber}: ${current} → ${Math.max(0, current - 1)}`, "pilot");
    setSavedDeckId("");
    if (!next[focusCardNumber]) setFocusCardNumber(Object.keys(next)[0] || "");
    setSignal({
      tone: "neutral",
      text: `${cardMap.get(cardNumber)?.cardName || cardNumber} removed. Suggestions were recalculated.`,
    });
  }

  function startDrag(event, cardNumber) {
    const assessment = workspace.availability[cardNumber];
    if (!assessment?.allowed) {
      event.preventDefault();
      setSignal({ tone: "blocked", text: assessment?.reason || "This card is currently locked." });
      return;
    }
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-zero-forge-card", cardNumber);
    event.dataTransfer.setData("text/plain", cardNumber);
  }

  function showCardPreview(card, event) {
    if (!card || typeof window === "undefined") return;
    const rect = event.currentTarget?.getBoundingClientRect?.();
    const pointX = Number.isFinite(event.clientX) && event.clientX > 0
      ? event.clientX
      : (rect?.left || 0) + (rect?.width || 0) / 2;
    const pointY = Number.isFinite(event.clientY) && event.clientY > 0
      ? event.clientY
      : (rect?.top || 0) + Math.min(rect?.height || 0, 96) / 2;
    setPreview(buildPreviewGeometry(card, pointX, pointY));
  }

  function hideCardPreview(event) {
    if (event?.currentTarget?.contains?.(event.relatedTarget)) return;
    setPreview(null);
  }

  function previewHandlers(card) {
    return {
      onMouseEnter: (event) => showCardPreview(card, event),
      onMouseLeave: hideCardPreview,
      onFocus: (event) => showCardPreview(card, event),
      onBlur: hideCardPreview,
    };
  }

  function dropOnMap(event) {
    event.preventDefault();
    setDragActive(false);
    const cardNumber = event.dataTransfer.getData("application/x-zero-forge-card")
      || event.dataTransfer.getData("text/plain");
    addCard(cardNumber, "catalog");
  }

  function applyMapZoom(nextZoom, point = null) {
    const scrollport = mapScrollportRef.current;
    const currentZoom = mapZoomRef.current;
    const clampedZoom = clamp(nextZoom, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
    if (clampedZoom === currentZoom) return;

    const rect = scrollport?.getBoundingClientRect();
    const localX = point && rect ? point.clientX - rect.left : (scrollport?.clientWidth || 0) / 2;
    const localY = point && rect ? point.clientY - rect.top : (scrollport?.clientHeight || 0) / 2;
    const mapX = scrollport ? (scrollport.scrollLeft + localX) / currentZoom : 0;
    const mapY = scrollport ? (scrollport.scrollTop + localY) / currentZoom : 0;

    mapZoomRef.current = clampedZoom;
    setMapZoom(clampedZoom);
    globalThis.requestAnimationFrame?.(() => {
      if (!scrollport) return;
      scrollport.scrollLeft = Math.max(0, (mapX * clampedZoom) - localX);
      scrollport.scrollTop = Math.max(0, (mapY * clampedZoom) - localY);
    });
  }

  function zoomMapBy(delta) {
    applyMapZoom(mapZoomRef.current + delta);
  }

  function fitMap() {
    const scrollport = mapScrollportRef.current;
    if (!scrollport) return;
    const nextZoom = calculateForgeFitZoom({
      viewportWidth: scrollport.clientWidth,
    });
    mapZoomRef.current = nextZoom;
    setMapZoom(nextZoom);
    globalThis.requestAnimationFrame?.(() => {
      const nextScroll = calculateForgeFitScroll({
        viewportWidth: scrollport.clientWidth,
        zoom: nextZoom,
      });
      scrollport.scrollLeft = nextScroll.scrollLeft;
      scrollport.scrollTop = nextScroll.scrollTop;
    });
  }

  function resetMapView() {
    const scrollport = mapScrollportRef.current;
    mapZoomRef.current = 1;
    setMapZoom(1);
    globalThis.requestAnimationFrame?.(() => {
      if (!scrollport) return;
      const nextScroll = calculateForgeFitScroll({
        viewportWidth: scrollport.clientWidth,
        zoom: 1,
      });
      scrollport.scrollLeft = nextScroll.scrollLeft;
      scrollport.scrollTop = 0;
    });
  }

  function resetMapLayout() {
    setNodePositions({});
  }

  function handleMapWheel(event) {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      applyMapZoom(
        mapZoomRef.current + (event.deltaY < 0 ? MAP_ZOOM_STEP : -MAP_ZOOM_STEP),
        event,
      );
      return;
    }
    if (event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      event.currentTarget.scrollLeft += event.deltaY;
    }
  }

  function startMapPan(event) {
    if (
      event.button !== 0
      || event.pointerType === "touch"
      || event.target.closest?.(".zero-forge-node, .zero-forge-ghost, .zero-forge-map__view-controls")
    ) return;
    mapPanSessionRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsMapPanning(true);
  }

  function moveMapPan(event) {
    const session = mapPanSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.currentTarget.scrollLeft = session.scrollLeft - (event.clientX - session.clientX);
    event.currentTarget.scrollTop = session.scrollTop - (event.clientY - session.clientY);
  }

  function endMapPan(event) {
    const session = mapPanSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    mapPanSessionRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setIsMapPanning(false);
  }

  function startMapNodeDrag(event, nodeId) {
    if (event.button !== 0 || event.pointerType === "touch") return;
    const position = positionedLayout.positions.get(nodeId);
    const scrollport = mapScrollportRef.current;
    if (!position || !scrollport) return;
    event.stopPropagation();
    mapNodeDragSessionRef.current = {
      pointerId: event.pointerId,
      nodeId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: position.x,
      y: position.y,
      scrollport,
      moved: false,
    };
    setDraggingNodeId(nodeId);
  }

  function moveMapNode(event) {
    const session = mapNodeDragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - session.clientX, event.clientY - session.clientY);
    if (!session.moved && distance < 3) return;
    if (!session.moved) {
      session.moved = true;
      session.scrollport.setPointerCapture?.(event.pointerId);
    }
    const size = forgeNodeSize(session.nodeId);
    const zoom = mapZoomRef.current;
    const x = clamp(
      session.x + ((event.clientX - session.clientX) / zoom),
      18,
      FORGE_STAGE_WIDTH - size.width - 18,
    );
    const y = clamp(
      session.y + ((event.clientY - session.clientY) / zoom),
      58,
      layout.height - size.height - 18,
    );
    setNodePositions((current) => ({
      ...current,
      [session.nodeId]: { x, y },
    }));
  }

  function endMapNodeDrag(event) {
    const session = mapNodeDragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    mapNodeDragSessionRef.current = null;
    if (session.scrollport.hasPointerCapture?.(event.pointerId)) {
      session.scrollport.releasePointerCapture(event.pointerId);
    }
    if (session.moved) {
      ignoreMapNodeClickRef.current = session.nodeId;
      globalThis.setTimeout(() => {
        if (ignoreMapNodeClickRef.current === session.nodeId) {
          ignoreMapNodeClickRef.current = "";
        }
      }, 0);
    }
    setDraggingNodeId("");
  }

  function moveMapPointer(event) {
    if (mapNodeDragSessionRef.current) {
      moveMapNode(event);
      return;
    }
    moveMapPan(event);
  }

  function endMapPointer(event) {
    if (mapNodeDragSessionRef.current) {
      endMapNodeDrag(event);
      return;
    }
    endMapPan(event);
  }

  function handleMapNodeClick(nodeId, action) {
    if (ignoreMapNodeClickRef.current === nodeId) {
      ignoreMapNodeClickRef.current = "";
      return;
    }
    action();
  }

  function moveMapNodeWithKeyboard(event, nodeId) {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (!directions[event.key]) return;
    event.preventDefault();
    const position = positionedLayout.positions.get(nodeId);
    if (!position) return;
    const size = forgeNodeSize(nodeId);
    const amount = event.shiftKey ? 36 : 12;
    const [deltaX, deltaY] = directions[event.key];
    setNodePositions((current) => ({
      ...current,
      [nodeId]: {
        x: clamp(position.x + (deltaX * amount), 18, FORGE_STAGE_WIDTH - size.width - 18),
        y: clamp(position.y + (deltaY * amount), 58, layout.height - size.height - 18),
      },
    }));
  }

  function loadMsaDeck() {
    if (!msaImport.canImport) {
      setSignal({
        tone: "blocked",
        text: "None of the pasted MSA card numbers matched the current catalog.",
      });
      return;
    }

    commitMain(msaImport.main, `Importação MSA: ${msaImport.title}`, "msa_import");
    setResource(msaImport.resource);
    setDeckName(msaImport.title);
    setFocusCardNumber(msaImport.firstCardNumber);
    pendingMapRevealRef.current = msaImport.firstCardNumber;
    setSourceMode("msa");
    setSourceMetadata({
      sourceTournamentDeckId: "",
      sourceResultId: "",
      playerName: "",
      eventName: "",
      placement: "",
      eventDate: "",
      originalMetaId: "msa",
      selectedMetaId,
      sourceUrl: "",
      importedAt: new Date().toISOString(),
      archetype: "",
      colors: msaImport.workspace.colors,
      legalInSelectedMeta: msaImport.workspace.legal,
    });
    setOriginalMain({ ...msaImport.main });
    setSavedDeckId("");
    setPreview(null);
    setImportOpen(false);

    const unknownCards = [...msaImport.unknownMainCards, ...msaImport.unknownResourceCards];
    if (unknownCards.length) {
      setSignal({
        tone: "blocked",
        text: `MSA import loaded with omissions: ${unknownCards.length} card number(s) were not found: ${unknownCards.join(", ")}.`,
      });
      return;
    }
    if (!msaImport.workspace.structurallyLegal) {
      setSignal({
        tone: "blocked",
        text: "MSA import loaded for correction. Review the highlighted rule conflicts.",
      });
      return;
    }
    if (msaImport.resourceWarning) {
      setSignal({ tone: "blocked", text: msaImport.resourceWarning });
      return;
    }
    setSignal({
      tone: "allowed",
      text: `MSA import loaded: ${msaImport.recognizedMainCount} recognized cards across ${msaImport.recognizedUniqueMainCards} card numbers.`,
    });
  }

  function saveDraft() {
    if (!workspace.mainCount) {
      setSignal({ tone: "blocked", text: "Add at least one card before saving this draft." });
      return;
    }
    const report = buildZeroForgeSaveReport(data, main, {
      title: deckName,
      focusCardNumber,
      resource,
      importedFromMsa: sourceMode === "msa",
      selectedMetaId,
      sourceMetadata,
      originalMain,
      changeHistory,
    });
    const saved = onSave?.(report);
    if (!saved?.id) {
      setSignal({ tone: "blocked", text: "The ZERO Forge draft could not be saved." });
      return;
    }
    setSavedDeckId(saved.id);
    setSignal({
      tone: "allowed",
      text: workspace.legal
        ? "Legal 50-card deck saved to My decks."
        : "Draft saved to My decks. You can continue here or finish it in the standard builder.",
    });
  }

  function resetForge() {
    if (workspace.mainCount && !window.confirm(t("Clear every card from this ZERO Forge draft?"))) return;
    commitMain({}, "Reiniciar FORJA", "reset");
    setResource({});
    setSourceMode("zero");
    setSourceMetadata(null);
    setOriginalMain({});
    setFocusCardNumber("");
    setSavedDeckId("");
    setNodePositions({});
    resetMapView();
    setSignal({
      tone: "neutral",
      text: "Select or drag the first card to establish the deck anchor.",
    });
  }

  function loadForgeImport(draft, mode = "tournament") {
    if (!draft?.main || !Object.keys(draft.main).length) {
      setSignal({ tone: "blocked", text: "A lista selecionada não possui um manifesto completo para importar." });
      return;
    }
    commitMain(draft.main, `Lista importada: ${draft.name || "deck competitivo"}`, `${mode}_import`);
    setResource(draft.resource || {});
    setDeckName(draft.name || "Lista competitiva importada");
    setFocusCardNumber(Object.keys(draft.main)[0] || "");
    setSelectedMetaId(draft.selectedMetaId || selectedMetaId);
    setSourceMode(mode);
    setSourceMetadata(draft.sourceMetadata || null);
    setOriginalMain({ ...(draft.originalMain || draft.main) });
    setSavedDeckId("");
    setNodePositions({});
    setIntelTab("analysis");
    setMobilePanel("deck");
    const importedFromDesigner = mode === "designer";
    setSignal({
      tone: draft.sourceMetadata?.legalInSelectedMeta === false ? "blocked" : "allowed",
      text: draft.sourceMetadata?.legalInSelectedMeta === false
        ? "Lista importada para revisão: ela não passou todos os critérios do meta selecionado."
        : importedFromDesigner
          ? "Deck do sistema carregado. Todas as cartas e quantidades estão prontas para edição."
          : "Lista competitiva copiada. O registro de torneio original permanece intacto.",
    });
  }

  function importRecommendation(recommendation) {
    loadForgeImport(
      createForgeImportFromResult(data, recommendation.result, selectedMetaId),
      "tournament",
    );
  }

  function applyAssistantSuggestion(suggestion, operationIds) {
    const proposed = applyDeckChangeSuggestion(main, suggestion, {
      confirmed: true,
      operationIds,
    });
    if (!proposed.applied) return;
    const projected = buildZeroForgeWorkspace(data, proposed.main, focusCardNumber, { limit: 8 });
    if (!projected.structurallyLegal || projected.mainCount > projected.maxMain) {
      setSignal({
        tone: "blocked",
        text: projected.issues[0] || "A sugestão criaria um conflito de legalidade e não foi aplicada.",
      });
      return;
    }
    commitMain(proposed.main, "Alteração confirmada pelo assistente", "assistant");
    setSavedDeckId("");
    setSignal({ tone: "allowed", text: "Alteração confirmada e aplicada. Estatísticas e legalidade foram recalculadas." });
  }

  return createPortal(
    <section className="zero-forge" aria-label="ZERO Forge assisted deck construction">
      <header className="zero-forge__header">
        <div className="zero-forge__brand">
          <span>DATABASE // ADVANCED TACTICAL HUD</span>
          <strong>ZERO FORGE</strong>
          <small>MAP-DRIVEN DECK CONSTRUCTION</small>
        </div>
        <label className="zero-forge__name">
          <span>DECK ID</span>
          <input value={deckName} onChange={(event) => setDeckName(event.target.value)} />
        </label>
        <label className="zero-forge__meta">
          <span>AMBIENTE COMPETITIVO</span>
          <select value={selectedMetaId} onChange={(event) => setSelectedMetaId(event.target.value)}>
            {metaConfig.map((meta) => <option key={meta.id} value={meta.id}>{meta.label}</option>)}
          </select>
        </label>
        <div className="zero-forge__telemetry">
          <span><small>MAIN</small><strong>{workspace.mainCount}/{workspace.maxMain}</strong></span>
          <span><small>COLORS</small><strong>{workspace.colors.join(" / ") || "OPEN"}</strong></span>
          <span className={workspace.legal ? "is-legal" : workspace.structurallyLegal ? "is-building" : "is-blocked"}>
            <small>RULES</small>
            <strong>{workspace.legal ? "LEGAL" : workspace.structurallyLegal ? "BUILDING" : "BLOCKED"}</strong>
          </span>
        </div>
        <div className="zero-forge__actions">
          <button type="button" onClick={undoChange} disabled={!undoStack.length} aria-label="Desfazer última alteração">↶ DESFAZER</button>
          <button type="button" onClick={redoChange} disabled={!redoStack.length} aria-label="Refazer alteração">↷ REFAZER</button>
          <button type="button" onClick={resetForge}>RESET</button>
          <button
            type="button"
            className="is-import"
            onClick={() => {
              setPreview(null);
              setImportOpen(true);
            }}
          >
            IMPORT MSA
          </button>
          <button
            type="button"
            disabled={!workspace.mainCount}
            onClick={() => {
              setPreview(null);
              setExportOpen(true);
            }}
          >
            EXPORT
          </button>
          <button type="button" className="is-primary" onClick={saveDraft}>SAVE DRAFT</button>
          {savedDeckId ? (
            <button
              type="button"
              className="is-confirmed"
              onClick={() => onOpenSavedDeck?.(savedDeckId)}
            >
              OPEN IN BUILDER
            </button>
          ) : null}
          <button type="button" className="zero-forge__close" onClick={onClose} aria-label="Close ZERO Forge">×</button>
        </div>
      </header>

      {sourceMetadata ? (
        <div className="forge-source-banner" role="status">
          <span>LISTA IMPORTADA / ORIGINAL PRESERVADO</span>
          <strong>
            Baseado na lista de {sourceMetadata.playerName || "piloto não identificado"}, {sourceMetadata.placement || "resultado registrado"} no {sourceMetadata.eventName || "evento de origem"}, em {sourceMetadata.eventDate || "data não informada"}.
          </strong>
          <button type="button" onClick={() => { setIntelTab("history"); setMobilePanel("analysis"); }}>COMPARAR COM ORIGINAL · {sourceDiff.changedCards} MUDANÇA(S)</button>
        </div>
      ) : null}

      <div className={`zero-forge__body is-mobile-${mobilePanel}`}>
        <aside className="zero-forge-library" aria-hidden={mobilePanel !== "cards" && undefined}>
          <div className="zero-forge-panel-head">
            <span>01 / CARD ARMORY</span>
            <strong>SELECT · CLICK · DRAG</strong>
            <small>{visibleCards.length} candidates in current scan</small>
          </div>
          <input
            className="zero-forge-library__search"
            value={search}
            placeholder="Name, number, effect or trait..."
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="zero-forge-library__filters">
            <select value={color} onChange={(event) => setColor(event.target.value)} aria-label="Card color">
              <option value="Any">Any color</option>
              {colors.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Card type">
              <option value="Any">Any type</option>
              {types.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input value={cost} placeholder="Cost, e.g. <=2" onChange={(event) => setCost(event.target.value)} />
          </div>
          <div className="zero-forge-library__list">
            {visibleCards.map((card) => {
              const assessment = workspace.availability[card.cardNumber];
              const quantity = Number(main[card.cardNumber] || 0);
              const locked = !assessment?.allowed;
              const atCapacity = ["main_deck_size", "copy_limit"].includes(assessment?.type);
              return (
                <button
                  key={card.cardNumber}
                  type="button"
                  draggable={!locked}
                  className={`zero-forge-library-card ${locked ? atCapacity ? "is-capacity" : "is-locked" : ""} ${focusCardNumber === card.cardNumber ? "is-focused" : ""}`.trim()}
                  onDragStart={(event) => startDrag(event, card.cardNumber)}
                  onClick={() => addCard(card.cardNumber)}
                  aria-label={locked ? t(assessment?.reason) : t(`Add ${card.cardName}`)}
                  {...previewHandlers(card)}
                >
                  <CardArt card={card} className="zero-forge-library-card__art" compact />
                  <span>
                    <small>{card.cardNumber} · COST {card.cost ?? "-"}</small>
                    <strong>{card.cardName}</strong>
                    <em>{card.color} · {card.cardType}</em>
                  </span>
                  <b>{locked ? atCapacity ? assessment?.type === "copy_limit" ? "MAX" : "FULL" : "LOCK" : quantity ? `${quantity}/${assessment.maxCopies}` : "+"}</b>
                </button>
              );
            })}
          </div>
        </aside>

        <section
          className={`zero-forge-map ${dragActive ? "is-drop-active" : ""}`.trim()}
          aria-label="Live deck map"
          onDragEnter={() => setDragActive(true)}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={dropOnMap}
        >
          <div className="zero-forge-map__topline">
            <span>02 / LIVE DECK MAP</span>
            <strong>{workspace.remaining ? `${workspace.remaining} slots remaining` : "Main deck allocation complete"}</strong>
            <div>
              <i className="is-deck" /> IN DECK
              <i className="is-ghost" /> PROJECTED · NOT ADDED
              <i className="is-link" /> PRINTED / OBSERVED LINK
            </div>
          </div>
          <div className="forge-deck-toolbar" role="toolbar" aria-label="Controles de visualização do deck">
            <div>
              <button type="button" className={deckViewMode === "map" ? "is-active" : ""} onClick={() => setDeckViewMode("map")}>MAPA</button>
              <button type="button" className={deckViewMode === "grid" ? "is-active" : ""} onClick={() => setDeckViewMode("grid")}>GRADE</button>
              <button type="button" className={deckViewMode === "list" ? "is-active" : ""} onClick={() => setDeckViewMode("list")}>LISTA</button>
            </div>
            <label><span>AGRUPAR</span><select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}><option value="cost">Custo</option><option value="type">Tipo</option><option value="color">Cor</option><option value="role">Função</option></select></label>
            <label><span>ORDENAR</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="cost">Custo</option><option value="name">Nome</option><option value="quantity">Quantidade</option><option value="set">Coleção</option></select></label>
          </div>
          {deckViewMode !== "map" ? (
            <ForgeDeckViews
              mode={deckViewMode}
              rows={workspace.rows}
              groupBy={groupBy}
              sortBy={sortBy}
              onFocus={setFocusCardNumber}
              onAdd={addCard}
              onRemove={removeCard}
              previewHandlers={previewHandlers}
            />
          ) : null}
          {deckViewMode === "map" ? <div className="zero-forge-map__viewport">
            <div
              ref={mapScrollportRef}
              className={`zero-forge-map__scrollport ${isMapPanning ? "is-panning" : ""} ${draggingNodeId ? "is-repositioning" : ""}`.trim()}
              role="group"
              aria-label="Interactive Forge deck map. Drag cards to rearrange them, drag the empty field to pan, scroll to navigate, or use Control plus the mouse wheel to zoom."
              onPointerDown={startMapPan}
              onPointerMove={moveMapPointer}
              onPointerUp={endMapPointer}
              onPointerCancel={endMapPointer}
              onWheel={handleMapWheel}
              onDoubleClick={resetMapView}
            >
              <div
                className="zero-forge-map__surface"
                style={{
                  width: FORGE_STAGE_WIDTH * mapZoom,
                  height: layout.height * mapZoom,
                }}
              >
                <div
                  className="zero-forge-map__stage"
                  style={{
                    width: FORGE_STAGE_WIDTH,
                    height: layout.height,
                    "--forge-map-zoom": mapZoom,
                  }}
                >
              <div className="zero-forge-map__grid" aria-hidden="true" />
              {layout.lanes.map((lane) => (
                <i
                  key={`lane-frame:${lane.id}`}
                  className="zero-forge-map__lane-frame"
                  style={{ left: lane.x }}
                  aria-hidden="true"
                />
              ))}
              <i className="zero-forge-map__projection-frame" aria-hidden="true" />
              {layout.lanes.map((lane) => (
                <div
                  key={lane.id}
                  className="zero-forge-map__lane-label"
                  style={{ left: lane.x }}
                >
                  <span>{lane.label}</span>
                  <b>{lane.count}</b>
                </div>
              ))}
              <div className="zero-forge-map__projection-label">
                <span>TACTICAL PROJECTION</span>
                <small>Ghost cards are legal additions or full-deck swaps.</small>
              </div>

              <svg
                className="zero-forge-map__links"
                viewBox={`0 0 ${FORGE_STAGE_WIDTH} ${layout.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {workspace.edges.map((edge) => {
                  const source = positionedLayout.positions.get(edge.source);
                  const target = positionedLayout.positions.get(edge.target);
                  if (!source || !target) return null;
                  const endpoints = forgeLinkEndpoints(source, target, edge.source, edge.target);
                  return (
                    <line
                      key={edge.id}
                      {...endpoints}
                      className={`zero-forge-map__edge zero-forge-map__edge--${edge.kind} zero-forge-map__edge--${edge.strength}`}
                    />
                  );
                })}
                {workspace.suggestions.map((suggestion) => {
                  const sourceId = suggestion.bestSourceCardNumber || focusCardNumber;
                  const targetId = `ghost:${suggestion.card.cardNumber}`;
                  const source = positionedLayout.positions.get(sourceId);
                  const target = positionedLayout.positions.get(targetId);
                  if (!source || !target) return null;
                  const endpoints = forgeLinkEndpoints(source, target, sourceId, targetId);
                  return (
                    <line
                      key={`ghost-link:${suggestion.card.cardNumber}`}
                      {...endpoints}
                      className={`zero-forge-map__edge zero-forge-map__edge--ghost zero-forge-map__edge--${suggestion.strength}`}
                    />
                  );
                })}
              </svg>

              {!workspace.rows.length ? (
                <div className="zero-forge-map__empty">
                  <span>NO ANCHOR LOCKED</span>
                  <strong>DROP OR CLICK YOUR FIRST CARD</strong>
                  <p>The assistant will project legal synergy, competitive co-play, curve and role options around it.</p>
                </div>
              ) : null}

              {workspace.rows.map((row) => {
                const nodeId = row.card.cardNumber;
                const position = positionedLayout.positions.get(nodeId);
                return (
                  <article
                    key={nodeId}
                    className={`zero-forge-node ${focusCardNumber === nodeId ? "is-focused" : ""} ${draggingNodeId === nodeId ? "is-dragging" : ""}`.trim()}
                    style={{ left: position.x, top: position.y }}
                  >
                    <button
                      type="button"
                      onPointerDown={(event) => startMapNodeDrag(event, nodeId)}
                    onKeyDown={(event) => moveMapNodeWithKeyboard(event, nodeId)}
                    onClick={() => handleMapNodeClick(nodeId, () => setFocusCardNumber(nodeId))}
                    aria-label={`${row.card.cardName}. Drag to rearrange, or use the arrow keys while focused.`}
                    >
                      <CardArt card={row.card} className="zero-forge-node__art" compact />
                      <span>{row.card.cardNumber}</span>
                      <strong>{row.card.cardName}</strong>
                    </button>
                    <div>
                      <button type="button" onClick={() => removeCard(row.card.cardNumber)} aria-label={`Remove one ${row.card.cardName}`}>−</button>
                      <b>{row.quantity}x</b>
                      <button type="button" onClick={() => addCard(row.card.cardNumber)} aria-label={`Add one ${row.card.cardName}`}>+</button>
                    </div>
                  </article>
                );
              })}

              {workspace.suggestions.map((suggestion) => {
                const nodeId = `ghost:${suggestion.card.cardNumber}`;
                const position = positionedLayout.positions.get(nodeId);
                return (
                  <button
                    key={suggestion.card.cardNumber}
                    type="button"
                    className={`zero-forge-ghost zero-forge-ghost--${suggestion.category} ${suggestion.action === "replace" ? "is-swap" : ""} ${draggingNodeId === nodeId ? "is-dragging" : ""}`.trim()}
                    style={{ left: position.x, top: position.y }}
                    onPointerDown={(event) => startMapNodeDrag(event, nodeId)}
                    onKeyDown={(event) => moveMapNodeWithKeyboard(event, nodeId)}
                    onClick={() => handleMapNodeClick(nodeId, () => addCard(suggestion.card.cardNumber, "suggestion"))}
                    aria-label={`${suggestion.card.cardName}, projected ${suggestion.action === "replace" ? `swap for ${suggestion.replaceCard?.cardName || "a deck card"}` : "addition"}. Drag to rearrange, or activate to apply it.`}
                  >
                    <CardArt card={suggestion.card} className="zero-forge-ghost__art" compact />
                    <span>
                      <small>#{suggestion.rank} · {suggestion.action === "replace" ? "SWAP" : suggestion.category}</small>
                      <strong>{suggestion.card.cardName}</strong>
                      <em>{suggestion.action === "replace" ? `OUT: ${suggestion.replaceCard?.cardName || "deck card"}` : suggestion.reasons[0] || "Curve / role support"}</em>
                    </span>
                    <b>{suggestion.action === "replace" ? "SWAP" : "+ ADD"}</b>
                  </button>
                );
              })}
            </div>
          </div>
            </div>
            <div className="zero-forge-map__view-controls" role="toolbar" aria-label="Forge map view controls">
              <button type="button" onClick={() => zoomMapBy(-MAP_ZOOM_STEP)} disabled={mapZoom <= MIN_MAP_ZOOM} aria-label="Zoom out">−</button>
              <output aria-label="Current Forge map zoom">{Math.round(mapZoom * 100)}%</output>
              <button type="button" onClick={() => zoomMapBy(MAP_ZOOM_STEP)} disabled={mapZoom >= MAX_MAP_ZOOM} aria-label="Zoom in">+</button>
              <button type="button" onClick={fitMap}>FIT</button>
              <button type="button" onClick={resetMapView}>1:1</button>
              <button type="button" onClick={resetMapLayout} disabled={!Object.keys(nodePositions).length}>RESET LAYOUT</button>
              <span>SCROLL · DRAG FIELD · CTRL + WHEEL TO ZOOM</span>
            </div>
          </div> : null}
          <div className={`zero-forge-map__signal is-${signal.tone}`} role="status" aria-live="polite">
            <i />
            <span>{t(signal.text)}</span>
          </div>
        </section>

        <aside className="zero-forge-intel">
          <div className="zero-forge-panel-head">
            <span>03 / DATABASE INTELLIGENCE</span>
            <strong>ASSISTED CONSTRUCTION</strong>
            <small>Every projection is checked against current deck rules.</small>
          </div>

          <nav className="forge-intel-tabs" aria-label="Painéis de inteligência">
            <button type="button" className={intelTab === "analysis" ? "is-active" : ""} onClick={() => setIntelTab("analysis")}>ANÁLISE</button>
            <button type="button" className={intelTab === "recommendations" ? "is-active" : ""} onClick={() => setIntelTab("recommendations")}>META</button>
            <button type="button" className={intelTab === "history" ? "is-active" : ""} onClick={() => setIntelTab("history")}>HISTÓRICO</button>
          </nav>

          {intelTab === "analysis" && focusedCard ? (
            <section className="zero-forge-focus" {...previewHandlers(focusedCard)}>
              <CardArt card={focusedCard} className="zero-forge-focus__art" compact />
              <div>
                <small>ACTIVE ANCHOR</small>
                <strong>{focusedCard.cardName}</strong>
                <span>{focusedCard.cardNumber} · {focusedCard.color} · {focusedCard.cardType}</span>
                <p>{focusedCard.effectPreview || "No normalized effect preview available."}</p>
              </div>
            </section>
          ) : null}

          {intelTab === "analysis" ? <section className="zero-forge-intel__section zero-forge-composition">
            <header><strong>DECK COMPOSITION</strong><span>live quantities</span></header>
            <div className="zero-forge-composition__grid">
              {workspace.composition.map((item) => (
                <article key={item.id} className={`is-${item.id}`}>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </article>
              ))}
            </div>
          </section> : null}

          {intelTab === "analysis" ? <section className="zero-forge-intel__section">
            <header><strong>CURVE VECTOR</strong><span>current / target</span></header>
            {workspace.curve.map((bucket) => (
              <div className="zero-forge-meter" key={bucket.id}>
                <span>{bucket.label}</span>
                <i><b style={{ width: `${Math.min(100, (bucket.count / Math.max(1, bucket.target)) * 100)}%` }} /></i>
                <strong>{bucket.count}/{bucket.target}</strong>
              </div>
            ))}
          </section> : null}

          {intelTab === "analysis" ? <section className="zero-forge-intel__section">
            <header><strong>ROLE COVERAGE</strong><span>signals / target</span></header>
            <div className="zero-forge-role-grid">
              {workspace.roles.map((role) => (
                <article key={role.id} className={role.need <= 0 ? "is-ready" : ""}>
                  <span>{role.label}</span>
                  <strong>{role.count}/{role.target}</strong>
                  <small>{role.need > 0 ? `${role.need} wanted` : "covered"}</small>
                </article>
              ))}
            </div>
          </section> : null}

          {intelTab === "analysis" ? <section className="zero-forge-intel__section zero-forge-suggestion-stack">
            <header><strong>NEXT BEST LINES</strong><span>{workspace.mainCount >= workspace.maxMain ? "legal swaps" : "not yet added"}</span></header>
            {workspace.suggestions.slice(0, 5).map((suggestion) => (
              <button
                key={suggestion.card.cardNumber}
                type="button"
                onClick={() => addCard(suggestion.card.cardNumber, "suggestion")}
                {...previewHandlers(suggestion.card)}
              >
                <span>0{suggestion.rank}</span>
                <div>
                  <strong>{suggestion.card.cardName}</strong>
                  <small>{suggestion.action === "replace"
                    ? t(suggestion.replacementReason)
                    : suggestion.reasons.map((reason) => t(reason)).join(" · ")}</small>
                </div>
                <b>{Math.round(suggestion.score)}</b>
              </button>
            ))}
            {!workspace.suggestions.length ? <p>{workspace.mainCount >= workspace.maxMain
              ? "No legal swaps were found for this completed deck."
              : "Add an anchor card to generate legal projections."}</p> : null}
          </section> : null}

          {intelTab === "analysis" ? <section className="zero-forge-intel__section zero-forge-manifest">
            <header><strong>DECK MANIFEST</strong><span>{workspace.rows.length} unique</span></header>
            <div>
              {[...workspace.rows]
                .sort((left, right) =>
                  Number(left.card.cost || 0) - Number(right.card.cost || 0)
                  || String(left.card.cardName).localeCompare(String(right.card.cardName)))
                .map((row) => (
                  <button
                    key={row.card.cardNumber}
                    type="button"
                    onClick={() => setFocusCardNumber(row.card.cardNumber)}
                    {...previewHandlers(row.card)}
                  >
                    <span>{row.quantity}x</span>
                    <strong>{row.card.cardName}</strong>
                    <small>C{row.card.cost ?? "-"}</small>
                  </button>
                ))}
            </div>
          </section> : null}

          {intelTab === "recommendations" ? (
            <ForgeRecommendations recommendations={competitiveRecommendations} onImport={importRecommendation} />
          ) : null}

          {intelTab === "history" ? (
            <section className="forge-history-panel">
              <header><strong>REGISTRO DE ALTERAÇÕES</strong><span>{changeHistory.length} operação(ões)</span></header>
              {sourceMetadata ? (
                <article className="forge-history-source">
                  <span>ORIGEM DO DECK</span>
                  <strong>{sourceMetadata.playerName || "Piloto não identificado"} · {sourceMetadata.eventName || "Evento não informado"}</strong>
                  <small>{sourceMetadata.placement || "Resultado sem posição"} · {sourceMetadata.eventDate || "Sem data"} · {sourceMetadata.originalMetaId}</small>
                </article>
              ) : null}
              <div className="forge-history-diff">
                <strong>COMPARAÇÃO COM A LISTA ORIGINAL</strong>
                {sourceDiff.changes.map((change) => (
                  <span key={change.cardNumber} className={change.delta > 0 ? "is-added" : "is-removed"}>
                    <b>{change.delta > 0 ? "+" : ""}{change.delta}</b>
                    <em>{change.cardNumber}</em>
                    <small>{change.before} → {change.after}</small>
                  </span>
                ))}
                {!sourceDiff.changes.length ? <p>A lista atual ainda é idêntica à origem.</p> : null}
              </div>
              <ol>
                {[...changeHistory].reverse().map((entry) => (
                  <li key={entry.id}><span>{entry.origin}</span><strong>{entry.label}</strong><small>{new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small></li>
                ))}
              </ol>
            </section>
          ) : null}
        </aside>
      </div>
      <nav className="forge-mobile-nav" aria-label="Navegação móvel da FORJA">
        <button type="button" className={mobilePanel === "deck" ? "is-active" : ""} onClick={() => setMobilePanel("deck")}>DECK</button>
        <button type="button" className={mobilePanel === "cards" ? "is-active" : ""} onClick={() => setMobilePanel("cards")}>CARTAS</button>
        <button type="button" className={mobilePanel === "analysis" ? "is-active" : ""} onClick={() => { setIntelTab("analysis"); setMobilePanel("analysis"); }}>ANÁLISE</button>
        <button type="button" className={mobilePanel === "recommendations" ? "is-active" : ""} onClick={() => { setIntelTab("recommendations"); setMobilePanel("recommendations"); }}>SUGESTÕES</button>
      </nav>
      <DeckAssistantPanel
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        context={assistantContext}
        onApplySuggestion={applyAssistantSuggestion}
      />
      {importOpen ? (
        <ZeroForgeMsaImportLayer
          text={importText}
          report={msaImport}
          hasExistingDeck={workspace.mainCount > 0}
          onTextChange={setImportText}
          onCancel={() => setImportOpen(false)}
          onImport={loadMsaDeck}
        />
      ) : null}
      {exportOpen ? (
        <ExBurstExportLayer report={exportReport} onClose={() => setExportOpen(false)} />
      ) : null}
      {preview ? (
        <ZeroForgeCardPreview
          preview={preview}
          main={main}
          workspace={workspace}
        />
      ) : null}
    </section>,
    document.body,
  );
}

function ZeroForgeMsaImportLayer({
  text,
  report,
  hasExistingDeck,
  onTextChange,
  onCancel,
  onImport,
}) {
  const { t } = useLocale();
  const unknownCards = [...report.unknownMainCards, ...report.unknownResourceCards];
  const structuralIssue = report.workspace.issues.find((issue) =>
    !/^Main deck must have \d+ cards\./i.test(issue));
  const status = !report.canImport
    ? "AWAITING DECK DATA"
    : structuralIssue
      ? "RULE CORRECTION REQUIRED"
      : report.workspace.legal
        ? "LEGAL DECK DETECTED"
        : "DRAFT READY TO EDIT";

  return (
    <div
      className="zero-forge-import-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="zero-forge-import"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zero-forge-import-title"
      >
        <div className="zero-forge-import__scan" aria-hidden="true" />
        <header>
          <div>
            <span>{t("MSA DECK TRANSFER // ZERO FORGE")}</span>
            <h2 id="zero-forge-import-title">{t("Import an MSA deck into the map")}</h2>
            <p>{t("Paste the MSA export. Recognized quantities and resource cards will be preserved for editing in the Forge.")}</p>
          </div>
          <strong className={structuralIssue ? "is-blocked" : report.canImport ? "is-ready" : ""}>
            <i />
            {t(status)}
          </strong>
          <button type="button" onClick={onCancel} aria-label={t("Close MSA import")}>×</button>
        </header>

        <div className="zero-forge-import__body">
          <label className="zero-forge-import__payload">
            <span>{t("MSA DECKLIST")}</span>
            <textarea
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              placeholder={"My Deck\n\nMain Deck (50)\n4 Gundam Example [GD01-001]\n\nResource Deck (10)\n10 Resource [R-001]"}
              spellCheck="false"
              autoFocus
            />
            <small>{t("Accepts the full MSA export and compact lines such as 4xGD01-001.")}</small>
          </label>

          <aside className="zero-forge-import__readout" aria-live="polite">
            <span>{t("LIVE TRANSFER READOUT")}</span>
            <strong>{text.trim() ? report.title : t("Awaiting pasted list")}</strong>
            <div className="zero-forge-import__metrics">
              <article className={report.recognizedMainCount ? "is-ready" : ""}>
                <small>{t("MAIN RECOGNIZED")}</small>
                <b>{report.recognizedMainCount}/{report.pastedMainCount || 0}</b>
              </article>
              <article>
                <small>{t("UNIQUE CARDS")}</small>
                <b>{report.recognizedUniqueMainCards}</b>
              </article>
              <article className={report.recognizedResourceCount ? "is-ready" : ""}>
                <small>{t("RESOURCES")}</small>
                <b>{report.recognizedResourceCount}</b>
              </article>
              <article className={unknownCards.length ? "is-warning" : ""}>
                <small>{t("NOT FOUND")}</small>
                <b>{unknownCards.length}</b>
              </article>
            </div>

            {unknownCards.length ? (
              <div className="zero-forge-import__warning">
                <span>{t("These card numbers will not enter the map:")}</span>
                <strong>{unknownCards.join(", ")}</strong>
              </div>
            ) : null}
            {structuralIssue ? (
              <div className="zero-forge-import__warning">
                <span>{t("The deck can still be loaded for correction:")}</span>
                <strong>{t(structuralIssue)}</strong>
              </div>
            ) : null}
            {report.resourceWarning ? (
              <div className="zero-forge-import__warning">
                <span>{t("Resource fallback")}</span>
                <strong>{t(report.resourceWarning)}</strong>
              </div>
            ) : null}
            {report.ignoredLines.length ? (
              <p>{t(`${report.ignoredLines.length} line(s) could not be read and will be ignored.`)}</p>
            ) : null}
            {hasExistingDeck ? (
              <p className="is-replace">{t("Loading this list will replace the cards currently on the Forge map.")}</p>
            ) : (
              <p>{t("After loading, every recognized card becomes editable and the suggestion engine recalculates around the imported deck.")}</p>
            )}
          </aside>
        </div>

        <footer>
          <span>
            {t("RESOURCE POLICY")}
            <strong>{t("Valid imported resources are preserved; if none are present, the Forge adds the standard resource deck when saving.")}</strong>
          </span>
          <nav>
            <button type="button" onClick={onCancel}>{t("CANCEL")}</button>
            <button type="button" className="is-primary" disabled={!report.canImport} onClick={onImport}>
              {t(hasExistingDeck ? "REPLACE MAP WITH MSA DECK" : "LOAD INTO FORGE MAP")}
            </button>
          </nav>
        </footer>
      </section>
    </div>
  );
}

function ZeroForgeCardPreview({ preview, main, workspace }) {
  const { t } = useLocale();
  const { card } = preview;
  const suggestion = workspace.suggestions.find((item) => item.card.cardNumber === card.cardNumber);
  const cardState = describeZeroForgeCardState(workspace, main, card);
  const previewClass = suggestion && (cardState.className === "is-legal" || suggestion.action === "replace")
    ? "is-suggested"
    : cardState.className;
  const traits = card.traits || [];
  const links = card.linkTargets || [];
  const tags = card.synergyTags || [];
  const effect = card.effectPreview || card.effectText || card.cardText || "No normalized effect preview available.";
  const inlineStyle = {
    left: preview.left,
    top: preview.top,
    width: preview.width,
    "--preview-origin-x": `${preview.originX}px`,
    "--preview-origin-y": `${preview.originY}px`,
  };

  return (
    <>
      <i
        className="zero-forge-card-preview__point"
        style={{ left: preview.pointX, top: preview.pointY }}
        aria-hidden="true"
      />
      <i
        className={`zero-forge-card-preview__trace is-${preview.side}`}
        style={{
          left: preview.traceLeft,
          top: preview.pointY,
          width: preview.traceWidth,
        }}
        aria-hidden="true"
      />
      <aside
        className={`zero-forge-card-preview ${previewClass}`.trim()}
        style={inlineStyle}
        role="tooltip"
      >
        <header>
          <span>{t("LIVE CARD INSPECTION")}</span>
          <strong>{card.cardName}</strong>
          <small>{card.cardNumber} · {card.color || "-"} · {card.cardType || "-"}</small>
        </header>
        <div className="zero-forge-card-preview__body">
          <CardArt card={card} className="zero-forge-card-preview__art" />
          <div className="zero-forge-card-preview__intel">
            <div className={`zero-forge-card-preview__status ${cardState.statusClassName}`.trim()}>
              <span>{t("DECK STATUS")}</span>
              <strong>{t(cardState.status)}</strong>
              <small>{t(cardState.detail)}</small>
            </div>
            <dl className="zero-forge-card-preview__stats">
              <div><dt>LV</dt><dd>{card.level ?? "-"}</dd></div>
              <div><dt>{t("COST")}</dt><dd>{card.cost ?? "-"}</dd></div>
              <div><dt>AP</dt><dd>{card.ap ?? "-"}</dd></div>
              <div><dt>HP</dt><dd>{card.hp ?? "-"}</dd></div>
            </dl>
            <div className="zero-forge-card-preview__meta">
              <span><small>{t("RARITY")}</small><strong>{card.rarity || "-"}</strong></span>
              <span><small>{t("SET")}</small><strong>{(card.packageCodes || []).join(" / ") || "-"}</strong></span>
            </div>
            {traits.length ? (
              <section>
                <span>{t("TRAITS")}</span>
                <div>{traits.map((trait) => <b key={trait}>{trait}</b>)}</div>
              </section>
            ) : null}
            {links.length ? (
              <section className="is-link">
                <span>{t("PRINTED LINK / PAIR")}</span>
                <div>{links.map((link) => <b key={link}>{link}</b>)}</div>
              </section>
            ) : null}
            {tags.length ? (
              <section className="is-signal">
                <span>{t("TACTICAL SIGNALS")}</span>
                <div>{tags.slice(0, 7).map((tag) => <b key={tag}>{String(tag).replaceAll("_", " ")}</b>)}</div>
              </section>
            ) : null}
          </div>
        </div>
        <section className="zero-forge-card-preview__effect">
          <span>{t("NORMALIZED EFFECT")}</span>
          <p>{effect}</p>
        </section>
        {suggestion ? (
          <footer>
            <span>{t(`SYSTEM PROJECTION · #${suggestion.rank}`)}</span>
            <strong>{suggestion.action === "replace"
              ? t(suggestion.replacementReason)
              : suggestion.reasons.map((reason) => t(reason)).join(" · ")}</strong>
            <small>{t(suggestion.action === "replace"
              ? "This swap keeps the main deck legal at its card limit."
              : "This is a projected card and has not been added to the deck.")}</small>
          </footer>
        ) : null}
      </aside>
    </>
  );
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function buildPreviewGeometry(card, rawPointX, rawPointY) {
  const viewportWidth = Math.max(320, window.innerWidth || 1440);
  const viewportHeight = Math.max(480, window.innerHeight || 900);
  const width = Math.min(500, viewportWidth - 28);
  const estimatedHeight = Math.min(610, viewportHeight - 96);
  const gap = 26;
  const pointX = Math.max(8, Math.min(viewportWidth - 8, rawPointX));
  const pointY = Math.max(82, Math.min(viewportHeight - 8, rawPointY));
  const hasRoomRight = pointX + gap + width <= viewportWidth - 14;
  const side = hasRoomRight ? "right" : "left";
  const left = hasRoomRight
    ? pointX + gap
    : Math.max(14, pointX - gap - width);
  const top = Math.max(82, Math.min(pointY - 150, viewportHeight - estimatedHeight - 14));
  const panelEdge = hasRoomRight ? left : left + width;

  return {
    card,
    pointX,
    pointY,
    left,
    top,
    width,
    side,
    originX: hasRoomRight ? 0 : width,
    originY: Math.max(0, Math.min(estimatedHeight, pointY - top)),
    traceLeft: Math.min(pointX, panelEdge),
    traceWidth: Math.max(0, Math.abs(panelEdge - pointX)),
  };
}
