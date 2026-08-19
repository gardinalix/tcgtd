import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CardArt } from "../cards/CardArt";
import { buildDeckGraph, relatedNodeIds } from "../../services/deckDesigner/deckMapLayout.js";
import { buildDrawPriorityPlan } from "../../services/deckDesigner/drawPriorityEngine.js";
import { getDeckLegalityPresentation } from "../../services/deckDesigner/deckLegalityPresentation.js";

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.6;
const FIT_ZOOM = 0.66;

export function DeckMap({ report, onApplySubstitution }) {
  const graphSynergies = report.mapSynergies || report.synergies;
  const graph = useMemo(() => buildDeckGraph(report.rows, graphSynergies), [graphSynergies, report.rows]);
  const legalityPresentation = getDeckLegalityPresentation(report.legality);
  const [viewMode, setViewMode] = useState("links");
  const [nodePositions, setNodePositions] = useState({});
  const [selectedId, setSelectedId] = useState("");
  const [hoveredId, setHoveredId] = useState("");
  const [rosterOpen, setRosterOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [viewport, setViewport] = useState({ zoom: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggingId, setDraggingId] = useState("");
  const [tacticalContext, setTacticalContext] = useState({
    turn: 3,
    matchup: "Balanced / unknown",
  });
  const positionedNodes = useMemo(() => graph.nodes.map((node) => ({
    ...node,
    ...(nodePositions[node.id] || {}),
  })), [graph.nodes, nodePositions]);
  const positionedGraph = useMemo(() => ({ ...graph, nodes: positionedNodes }), [graph, positionedNodes]);
  const activeId = hoveredId || selectedId;
  const relatedIds = useMemo(() => relatedNodeIds(graph, activeId), [graph, activeId]);
  const rosterGroups = useMemo(() => groupRosterNodes(positionedNodes), [positionedNodes]);
  const rosterNodeRefs = useRef(new Map());
  const selectionSourceRef = useRef("");
  const panSessionRef = useRef(null);
  const nodeDragSessionRef = useRef(null);
  const ignoreNodeClickRef = useRef("");
  const selectedNode = positionedNodes.find((node) => node.id === selectedId) || positionedNodes[0] || null;
  const selectedConnections = graph.edges.filter((edge) => edge.source === selectedNode?.id || edge.target === selectedNode?.id);
  const matchupOptions = useMemo(() => [
    "Balanced / unknown",
    ...(report.matchups || []).map((item) => item.opponent).filter(Boolean),
  ], [report.matchups]);
  const drawPlan = useMemo(() => (
    selectedId && selectedNode
      ? buildDrawPriorityPlan(
        selectedNode.row.card,
        positionedNodes.map((node) => node.row),
        tacticalContext,
        positionedGraph,
      )
      : null
  ), [positionedGraph, positionedNodes, selectedId, selectedNode, tacticalContext]);
  const drawPriorityIds = useMemo(
    () => new Set((drawPlan?.recommendations || []).map((item) => item.card.cardNumber)),
    [drawPlan],
  );
  const focusedRelatedIds = useMemo(
    () => new Set([...relatedIds, ...drawPriorityIds]),
    [drawPriorityIds, relatedIds],
  );

  useEffect(() => {
    if (globalThis.matchMedia?.("(max-width: 900px)").matches) {
      setViewport({ zoom: 0.78, x: 0, y: 0 });
    }
  }, []);

  useEffect(() => {
    if (selectedId && !graph.nodes.some((node) => node.id === selectedId)) {
      setSelectedId("");
    }
  }, [graph.nodes, selectedId]);

  useEffect(() => {
    const liveIds = new Set(graph.nodes.map((node) => node.id));
    setNodePositions((current) => Object.fromEntries(
      Object.entries(current).filter(([nodeId]) => liveIds.has(nodeId)),
    ));
  }, [graph.nodes]);

  useEffect(() => {
    if (selectionSourceRef.current !== "map" && selectionSourceRef.current !== "inspector") return;
    rosterNodeRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
    selectionSourceRef.current = "";
  }, [selectedId]);

  function selectNode(nodeId, source) {
    selectionSourceRef.current = source;
    setSelectedId(nodeId);
    if (source === "map" || source === "list") setInspectorOpen(true);
  }

  function zoomBy(delta) {
    setViewport((current) => ({
      ...current,
      zoom: clamp(current.zoom + delta, MIN_ZOOM, MAX_ZOOM),
    }));
  }

  function fitMap() {
    setViewport({ zoom: FIT_ZOOM, x: 0, y: 0 });
  }

  function resetMap() {
    setViewport({ zoom: 1, x: 0, y: 0 });
  }

  function resetLayout() {
    setNodePositions({});
  }

  function startPan(event) {
    if (event.button !== 0 || event.pointerType === "touch" || event.target.closest?.("button, a")) return;
    panSessionRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: viewport.x,
      y: viewport.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsPanning(true);
  }

  function movePan(event) {
    const session = panSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const maxX = event.currentTarget.clientWidth * 0.45;
    const maxY = event.currentTarget.clientHeight * 0.45;
    setViewport((current) => ({
      ...current,
      x: clamp(session.x + event.clientX - session.clientX, -maxX, maxX),
      y: clamp(session.y + event.clientY - session.clientY, -maxY, maxY),
    }));
  }

  function endPan(event) {
    if (panSessionRef.current?.pointerId !== event.pointerId) return;
    panSessionRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setIsPanning(false);
  }

  function startNodeDrag(event, nodeId) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const canvas = event.currentTarget.closest(".deck-map__canvas");
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect?.width || !rect?.height) return;
    nodeDragSessionRef.current = {
      pointerId: event.pointerId,
      nodeId,
      clientX: event.clientX,
      clientY: event.clientY,
      canvas,
      rect,
      moved: false,
    };
    setDraggingId(nodeId);
  }

  function moveNode(event) {
    const session = nodeDragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - session.clientX, event.clientY - session.clientY);
    if (!session.moved && distance < 3) return;
    if (!session.moved) {
      session.moved = true;
      session.canvas.setPointerCapture?.(event.pointerId);
    }
    const rect = session.rect;
    if (!rect?.width || !rect?.height) return;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const mapX = centerX + ((localX - centerX - viewport.x) / viewport.zoom);
    const mapY = centerY + ((localY - centerY - viewport.y) / viewport.zoom);
    setNodePositions((current) => ({
      ...current,
      [session.nodeId]: {
        x: clamp((mapX / rect.width) * 100, 6, 94),
        y: clamp((mapY / rect.height) * 100, 8, 92),
      },
    }));
  }

  function endNodeDrag(event) {
    const session = nodeDragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    nodeDragSessionRef.current = null;
    if (session.canvas.hasPointerCapture?.(event.pointerId)) {
      session.canvas.releasePointerCapture(event.pointerId);
    }
    if (session.moved) {
      ignoreNodeClickRef.current = session.nodeId;
      globalThis.setTimeout(() => {
        if (ignoreNodeClickRef.current === session.nodeId) ignoreNodeClickRef.current = "";
      }, 0);
    }
    setDraggingId("");
  }

  function moveCanvasPointer(event) {
    if (nodeDragSessionRef.current) {
      moveNode(event);
      return;
    }
    movePan(event);
  }

  function endCanvasPointer(event) {
    if (nodeDragSessionRef.current) {
      endNodeDrag(event);
      return;
    }
    endPan(event);
  }

  function handleNodeClick(nodeId) {
    if (ignoreNodeClickRef.current === nodeId) {
      ignoreNodeClickRef.current = "";
      return;
    }
    selectNode(nodeId, "map");
  }

  function moveNodeWithKeyboard(event, node) {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (!directions[event.key]) return;
    event.preventDefault();
    const amount = event.shiftKey ? 4 : 1.5;
    const [deltaX, deltaY] = directions[event.key];
    setNodePositions((current) => {
      const position = current[node.id] || { x: node.x, y: node.y };
      return {
        ...current,
        [node.id]: {
          x: clamp(position.x + (deltaX * amount), 6, 94),
          y: clamp(position.y + (deltaY * amount), 8, 92),
        },
      };
    });
  }

  return (
    <section className="deck-map">
      <header className="deck-map__hudbar">
        <div className="deck-map__mission">
          <span className="eyebrow">DATABASE // DECK LINK MAP</span>
          <h3>{report.title || "Tactical deck map"}</h3>
          <p>{report.strategy}</p>
        </div>
        <nav className="deck-map__mode-switch" aria-label="Deck analysis view">
          <button type="button" className={viewMode === "links" ? "is-active" : ""} onClick={() => setViewMode("links")}>INTERACTIVE MAP</button>
          <button type="button" className={viewMode === "formation" ? "is-active" : ""} onClick={() => setViewMode("formation")}>DECK MANIFEST</button>
        </nav>
        <div className="deck-map__readouts" aria-label="Deck telemetry">
          <span><b>{report.stats.mainCount}</b> / 50 MAIN</span>
          <span><b>{graph.nodes.length}</b> NODES</span>
          <span><b>{graph.edges.length}</b> CONNECTIONS</span>
          <span><b>{report.stats.averageCost}</b> AVERAGE CURVE</span>
          <span><b>{report.confidence}</b> CONFIDENCE</span>
          <span className={legalityPresentation.className} title={legalityPresentation.detail}>
            <b>{legalityPresentation.label}</b> CURRENT RULESET
          </span>
        </div>
      </header>

      <div className={`deck-map__workspace ${viewMode === "formation" ? "is-formation" : "is-links"} ${rosterOpen ? "is-roster-open" : ""} ${inspectorOpen ? "is-inspector-open" : ""}`.trim()}>
        {viewMode === "formation" ? (
          <DeckFormation
            groups={rosterGroups}
            mainCount={report.stats.mainCount}
            onAnalyze={(nodeId) => {
              selectNode(nodeId, "list");
              setViewMode("links");
            }}
          />
        ) : <>
        <div className="deck-map__cockpit-frame" aria-hidden="true">
          <i className="is-north-west" />
          <i className="is-north-east" />
          <i className="is-south-west" />
          <i className="is-south-east" />
          <b className="is-horizon" />
          <b className="is-reticle" />
          <span>NEURAL GRID // TACTICAL DATABASE</span>
        </div>
        {!rosterOpen ? (
          <button
            type="button"
            className="deck-map__rail-toggle deck-map__rail-toggle--roster"
            onClick={() => setRosterOpen(true)}
            aria-label="Open deck manifest"
          >
            MANIFEST
          </button>
        ) : (
          <DeckMapRoster
            groups={rosterGroups}
            activeId={activeId}
            selectedId={selectedNode?.id || ""}
            relatedIds={relatedIds}
            onHover={setHoveredId}
            onSelect={(nodeId) => selectNode(nodeId, "list")}
            onClose={() => setRosterOpen(false)}
            nodeRefs={rosterNodeRefs}
            mainCount={report.stats.mainCount}
          />
        )}

        <div
          className={`deck-map__canvas ${isPanning ? "is-panning" : ""} ${draggingId ? "is-repositioning" : ""}`.trim()}
          role="group"
          aria-label="Interactive map of recommended deck cards and their relationships. Drag a card to rearrange it, or drag the empty field to pan."
          onMouseLeave={() => setHoveredId("")}
          onPointerDown={startPan}
          onPointerMove={moveCanvasPointer}
          onPointerUp={endCanvasPointer}
          onPointerCancel={endCanvasPointer}
          onDoubleClick={resetMap}
        >
          <div className="deck-map__scanline" aria-hidden="true" />
          <div
            className="deck-map__graph-stage"
            style={{
              "--map-zoom": viewport.zoom,
              "--map-pan-x": `${viewport.x}px`,
              "--map-pan-y": `${viewport.y}px`,
            }}
          >
            <svg className="deck-map__links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {(graph.edges || []).map((edge) => {
                const source = positionedNodes.find((node) => node.id === edge.source);
                const target = positionedNodes.find((node) => node.id === edge.target);
                if (!source || !target) return null;
                const isActive = Boolean(activeId && (edge.source === activeId || edge.target === activeId));
                if (activeId && !isActive) return null;
                return (
                  <line
                    key={edge.id}
                    className={`deck-map__link deck-map__link--${edge.kind} deck-map__link--strength-${edge.strength || "structural"} ${isActive ? "is-active" : "is-dimmed"}`.trim()}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                  />
                );
              })}
              {(drawPlan?.recommendations || []).map((recommendation) => {
                const source = positionedNodes.find((node) => node.id === drawPlan.sourceCardNumber);
                const target = positionedNodes.find((node) => node.id === recommendation.card.cardNumber);
                if (!source || !target) return null;
                return (
                  <line
                    key={`draw-route-${drawPlan.sourceCardNumber}-${recommendation.card.cardNumber}`}
                    className={`deck-map__draw-route deck-map__draw-route--rank-${recommendation.rank}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                  />
                );
              })}
            </svg>

            {activeId ? (graph.edges || [])
              .filter((edge) => edge.source === activeId || edge.target === activeId)
              .slice(0, 6)
              .map((edge) => {
                const source = positionedNodes.find((node) => node.id === edge.source);
                const target = positionedNodes.find((node) => node.id === edge.target);
                const other = edge.source === activeId ? target : source;
                if (!source || !target || !other) return null;
                return (
                  <span
                    key={`caption-${edge.id}`}
                    className={`deck-map__edge-caption deck-map__edge-caption--${edge.strength || "structural"}`}
                    style={{
                      "--caption-x": `${(source.x + target.x) / 2}%`,
                      "--caption-y": `${(source.y + target.y) / 2}%`,
                    }}
                  >
                    <strong>{edge.strength === "structural" ? "STRUCTURE" : String(edge.strength || "low").toUpperCase()}</strong>
                    <span>{other.row.card.cardName}</span>
                    <small>{edge.basis || edge.label}</small>
                  </span>
                );
              }) : null}

            {positionedNodes.map((node) => {
              const isActive = node.id === activeId;
              const isSelected = node.id === selectedNode?.id;
              const drawPriority = (drawPlan?.recommendations || [])
                .find((item) => item.card.cardNumber === node.id);
              const isRelated = !activeId || focusedRelatedIds.has(node.id);
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`deck-map-node deck-map-node--${node.row.category} ${isActive ? "is-active" : ""} ${isSelected ? "is-selected" : ""} ${isRelated ? "is-related" : "is-dimmed"} ${draggingId === node.id ? "is-dragging" : ""} ${drawPriority ? "is-draw-priority" : ""}`.trim()}
                  style={{ "--node-x": `${node.x}%`, "--node-y": `${node.y}%` }}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onFocus={() => setHoveredId(node.id)}
                  onBlur={() => setHoveredId("")}
                  onPointerDown={(event) => startNodeDrag(event, node.id)}
                  onDragStart={(event) => event.preventDefault()}
                  onKeyDown={(event) => moveNodeWithKeyboard(event, node)}
                  onClick={() => handleNodeClick(node.id)}
                  aria-pressed={isSelected}
                  aria-label={`${node.row.quantity} copies of ${node.row.card.cardName}. ${node.degree} connections. Drag to rearrange, or use arrow keys while focused.`}
                >
                  <span className="deck-map-node__orbit" aria-hidden="true" />
                  <CardArt card={node.row.card} className="deck-map-node__art" compact />
                  <span className="deck-map-node__qty">{node.row.quantity}x</span>
                  {drawPriority ? (
                    <span className="deck-map-node__draw-rank">
                      {drawPlan.mode === "search" ? "TARGET" : "HIT"} #{drawPriority.rank}
                    </span>
                  ) : null}
                  <span className="deck-map-node__label">
                    <strong>{node.row.card.cardName}</strong>
                    <small>{node.row.card.cardNumber} · C{node.row.card.cost || "-"}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="deck-map__view-controls" role="toolbar" aria-label="Map view controls">
            <button type="button" onClick={() => zoomBy(-0.1)} disabled={viewport.zoom <= MIN_ZOOM} aria-label="Zoom out">−</button>
            <output aria-label="Current zoom">{Math.round(viewport.zoom * 100)}%</output>
            <button type="button" onClick={() => zoomBy(0.1)} disabled={viewport.zoom >= MAX_ZOOM} aria-label="Zoom in">+</button>
            <button type="button" onClick={fitMap}>FIT ALL</button>
            <button type="button" onClick={resetMap}>1:1</button>
            <button type="button" onClick={resetLayout} disabled={!Object.keys(nodePositions).length}>RESET LAYOUT</button>
            <span>DRAG CARDS · DRAG FIELD TO PAN</span>
          </div>

          <div className="deck-map__legend" aria-label="Connection legend">
            <span><i className="is-high" /> HIGH · direct mechanic</span>
            <span><i className="is-good" /> GOOD · supported interaction</span>
            <span><i className="is-low" /> LOW · deck context</span>
            <span><i className="is-printed" /> solid = printed / observed</span>
            <span><i className="is-inferred" /> dashed = inferred</span>
            <span><i className="is-structural" /> STRUCTURE · layout only</span>
            {drawPlan ? <span><i className="is-draw-route" /> DRAW ROUTE · contextual priority</span> : null}
          </div>
        </div>

        {!inspectorOpen ? (
          <button
            type="button"
            className="deck-map__rail-toggle deck-map__rail-toggle--inspector"
            onClick={() => setInspectorOpen(true)}
            aria-label="Open selected card data"
          >
            NODE DATA
          </button>
        ) : selectedNode ? (
          <DeckMapInspector
            node={selectedNode}
            connections={selectedConnections}
            graph={positionedGraph}
            drawPlan={drawPlan}
            tacticalContext={tacticalContext}
            matchupOptions={matchupOptions}
            onTacticalContextChange={setTacticalContext}
            substitutions={report.substitutions?.[selectedNode.id] || []}
            onSelect={(nodeId) => selectNode(nodeId, "inspector")}
            onApply={(targetCardNumber) => onApplySubstitution(selectedNode.id, targetCardNumber)}
            onClose={() => setInspectorOpen(false)}
          />
        ) : null}
        </>}
      </div>
    </section>
  );
}

function DeckFormation({ groups, mainCount, onAnalyze }) {
  return (
    <section className="deck-map__formation" aria-label="Deck manifest">
      <header className="deck-map__formation-header">
        <span>50-CARD DECK FORMATION</span>
        <strong>{mainCount} / 50 MAIN</strong>
        <small>Select a card to trace its evidence-backed links.</small>
      </header>
      <div className="deck-map__formation-groups">
        {groups.map((group) => (
          <section className={`deck-map__formation-group deck-map__formation-group--${group.type.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.trim()} key={group.type}>
            <header>
              <span>{group.type}</span>
              <b>{group.quantity} cards</b>
            </header>
            <div>
              {group.nodes.map((node) => (
                <button
                  type="button"
                  key={node.id}
                  className={`deck-map__formation-card deck-map__formation-card--${node.row.category}`}
                  onClick={() => onAnalyze(node.id)}
                  aria-label={`Trace links for ${node.row.quantity} copies of ${node.row.card.cardName}`}
                >
                  <CardArt card={node.row.card} className="deck-map__formation-art" compact />
                  <span>
                    <small>{node.row.card.cardNumber} · C{node.row.card.cost || "-"}</small>
                    <strong>{node.row.card.cardName}</strong>
                    <em>{node.row.card.color || "-"} · {node.row.card.cardType || "-"}</em>
                  </span>
                  <b>{node.row.quantity}x</b>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function DeckMapRoster({
  groups,
  activeId,
  selectedId,
  relatedIds,
  onHover,
  onSelect,
  onClose,
  nodeRefs,
  mainCount,
}) {
  return (
    <aside
      className="deck-map-roster"
      aria-label="Linked deck list"
      onMouseLeave={() => onHover("")}
    >
      <header className="deck-map-roster__header">
        <span>DECK MANIFEST // LINKED</span>
        <strong>{mainCount} / 50</strong>
        <button type="button" onClick={onClose} aria-label="Close deck manifest">‹</button>
        <small>Hover or focus a card to trace it across the map.</small>
      </header>
      <div className="deck-map-roster__groups">
        {groups.map((group) => (
          <section className="deck-map-roster__group" key={group.type}>
            <header>
              <h4>{group.type}</h4>
              <span>{group.quantity} cards</span>
            </header>
            <div>
              {group.nodes.map((node) => {
                const isActive = node.id === activeId;
                const isSelected = node.id === selectedId;
                const isRelated = !activeId || relatedIds.has(node.id);
                return (
                  <button
                    ref={(element) => {
                      if (element) nodeRefs.current.set(node.id, element);
                      else nodeRefs.current.delete(node.id);
                    }}
                    type="button"
                    key={node.id}
                    className={`deck-map-roster__card deck-map-roster__card--${node.row.category} ${isActive ? "is-active" : ""} ${isSelected ? "is-selected" : ""} ${isRelated ? "is-related" : "is-dimmed"}`.trim()}
                    onMouseEnter={() => onHover(node.id)}
                    onFocus={() => onHover(node.id)}
                    onBlur={() => onHover("")}
                    onClick={() => onSelect(node.id)}
                    aria-pressed={isSelected}
                  >
                    <CardArt card={node.row.card} className="deck-map-roster__art" compact />
                    <span className="deck-map-roster__identity">
                      <strong>{node.row.card.cardName}</strong>
                      <small>{node.row.card.cardNumber}</small>
                      <em>{node.degree} links</em>
                    </span>
                    <span className="deck-map-roster__stats">
                      <b>{node.row.quantity}x</b>
                      <small>C{node.row.card.cost || "-"}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function DeckMapInspector({
  node,
  connections,
  graph,
  drawPlan,
  tacticalContext,
  matchupOptions,
  onTacticalContextChange,
  substitutions,
  onSelect,
  onApply,
  onClose,
}) {
  const { row } = node;
  const [cardPreviewOpen, setCardPreviewOpen] = useState(false);

  useEffect(() => {
    setCardPreviewOpen(false);
  }, [node.id]);

  return (
    <aside className="deck-map-inspector" aria-live="polite">
      <header>
        <span>NODE // {row.card.cardNumber}</span>
        <strong>{row.quantity}x</strong>
        <button type="button" onClick={onClose} aria-label="Close selected card data">›</button>
      </header>
      <div className="deck-map-inspector__identity">
        <figure
          className="deck-map-inspector__art-trigger"
          tabIndex={0}
          aria-label={`${row.card.cardName}. Hover or focus to enlarge card art.`}
          onMouseEnter={() => setCardPreviewOpen(true)}
          onMouseLeave={() => setCardPreviewOpen(false)}
          onFocus={() => setCardPreviewOpen(true)}
          onBlur={() => setCardPreviewOpen(false)}
        >
          <CardArt card={row.card} className="deck-map-inspector__art" />
          <figcaption>HOVER / FOCUS TO ENLARGE</figcaption>
        </figure>
        <div>
          <h3>{row.card.cardName}</h3>
          <p>{row.card.cardType} · {row.card.color} · Cost {row.card.cost || "-"}</p>
          <div className="deck-map-inspector__tags">
            <span className={`deck-category-pill deck-category-pill--${row.category}`}>{row.category}</span>
            <span>{row.confidence} confidence</span>
          </div>
        </div>
      </div>
      {cardPreviewOpen && typeof document !== "undefined"
        ? createPortal(
          <div className="deck-map-inspector__art-preview" aria-hidden="true">
            <span>{row.card.cardName}</span>
            <CardArt card={row.card} className="deck-map-inspector__art-preview-card" />
            <small>{row.card.cardNumber}</small>
          </div>,
          document.body,
        )
        : null}
      <section>
        <span className="deck-map-inspector__label">ROLE IN DECK</span>
        <p>{row.recommendationReason}</p>
      </section>
      <section>
        <span className="deck-map-inspector__label">ACTIVE LINKS · {connections.length}</span>
        <div className="deck-map-inspector__connections">
          {connections.slice(0, 6).map((edge) => {
            const otherId = edge.source === node.id ? edge.target : edge.source;
            const other = graph.nodes.find((candidate) => candidate.id === otherId);
            return (
              <button type="button" key={edge.id} onClick={() => onSelect(otherId)}>
                <i className={`is-${edge.kind}`} />
                <span>
                  <strong>{other?.row.card.cardName || otherId}</strong>
                  <small>{edge.label}</small>
                </span>
                <b className={`deck-map-inspector__strength is-${edge.strength || "structural"}`}>
                  {edge.strength || "structure"}
                </b>
              </button>
            );
          })}
        </div>
      </section>
      {drawPlan ? (
        <section className="deck-map-draw-plan">
          <span className="deck-map-inspector__label">DRAW INTELLIGENCE</span>
          <div className="deck-map-draw-plan__context">
            <label>
              <span>TURN</span>
              <select
                value={tacticalContext.turn}
                onChange={(event) => onTacticalContextChange((current) => ({
                  ...current,
                  turn: Number(event.target.value),
                }))}
              >
                <option value={1}>T1</option>
                <option value={2}>T2</option>
                <option value={3}>T3</option>
                <option value={4}>T4</option>
                <option value={5}>T5+</option>
              </select>
            </label>
            <label>
              <span>MATCHUP</span>
              <select
                value={tacticalContext.matchup}
                onChange={(event) => onTacticalContextChange((current) => ({
                  ...current,
                  matchup: event.target.value,
                }))}
              >
                {matchupOptions.map((matchup) => (
                  <option key={matchup} value={matchup}>{matchup}</option>
                ))}
              </select>
            </label>
          </div>
          <header>
            <strong>{drawPlan.title}</strong>
            <small>TURN {drawPlan.turn} · {drawPlan.matchup}</small>
          </header>
          <p>{drawPlan.disclaimer}</p>
          <div className="deck-map-draw-plan__targets">
            {drawPlan.recommendations.map((recommendation) => (
              <button
                type="button"
                key={recommendation.card.cardNumber}
                onClick={() => onSelect(recommendation.card.cardNumber)}
              >
                <b>#{recommendation.rank}</b>
                <span>
                  <strong>{recommendation.card.cardName}</strong>
                  <small>{recommendation.card.cardNumber} · C{recommendation.card.cost || "-"}</small>
                  <small className="deck-map-draw-plan__reason">
                    {recommendation.reasons.map((reason) => <span key={reason}>{reason}</span>)}
                  </small>
                </span>
                <em>{["NOW", "NEXT", "PLAN"][recommendation.rank - 1]}</em>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {substitutions.length ? (
        <section>
          <span className="deck-map-inspector__label">SUBSTITUTIONS</span>
          <div className="deck-map-inspector__swaps">
            {substitutions.map((substitution) => (
              <article key={substitution.card.cardNumber}>
                <CardArt card={substitution.card} className="deck-map-inspector__swap-art" compact />
                <span><strong>{substitution.card.cardName}</strong><small>{Math.round(substitution.fitScore * 100)}% fit · {substitution.kind}</small></span>
                <button type="button" onClick={() => onApply(substitution.card.cardNumber)}>APPLY</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function groupRosterNodes(nodes = []) {
  const grouped = new Map();
  [...nodes]
    .sort((left, right) =>
      String(left.row.card.cardType).localeCompare(String(right.row.card.cardType))
      || Number(left.row.card.cost || 0) - Number(right.row.card.cost || 0)
      || String(left.row.card.cardName).localeCompare(String(right.row.card.cardName)))
    .forEach((node) => {
      const type = node.row.card.cardType || "OTHER";
      if (!grouped.has(type)) grouped.set(type, []);
      grouped.get(type).push(node);
    });
  return [...grouped].map(([type, groupNodes]) => ({
    type,
    nodes: groupNodes,
    quantity: groupNodes.reduce((total, node) => total + Number(node.row.quantity || 0), 0),
  }));
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
