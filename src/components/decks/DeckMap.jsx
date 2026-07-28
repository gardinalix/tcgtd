import { useEffect, useMemo, useRef, useState } from "react";
import { CardArt } from "../cards/CardArt";
import { buildDeckGraph, relatedNodeIds } from "../../services/deckDesigner/deckMapLayout.js";

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.6;
const FIT_ZOOM = 0.66;

export function DeckMap({ report, onApplySubstitution }) {
  const graph = useMemo(() => buildDeckGraph(report.rows, report.synergies), [report.rows, report.synergies]);
  const [selectedId, setSelectedId] = useState(() => graph.nodes[0]?.id || "");
  const [hoveredId, setHoveredId] = useState("");
  const [rosterOpen, setRosterOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [viewport, setViewport] = useState({ zoom: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const activeId = hoveredId || selectedId;
  const relatedIds = useMemo(() => relatedNodeIds(graph, activeId), [graph, activeId]);
  const rosterGroups = useMemo(() => groupRosterNodes(graph.nodes), [graph.nodes]);
  const rosterNodeRefs = useRef(new Map());
  const selectionSourceRef = useRef("");
  const panSessionRef = useRef(null);
  const selectedNode = graph.nodes.find((node) => node.id === selectedId) || graph.nodes[0] || null;
  const selectedConnections = graph.edges.filter((edge) => edge.source === selectedNode?.id || edge.target === selectedNode?.id);

  useEffect(() => {
    if (!graph.nodes.some((node) => node.id === selectedId)) {
      setSelectedId(graph.nodes[0]?.id || "");
    }
  }, [graph.nodes, selectedId]);

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

  return (
    <section className="deck-map">
      <header className="deck-map__hudbar">
        <div className="deck-map__mission">
          <span className="eyebrow">BRUXÃO // DECK LINK MAP</span>
          <h3>{report.title || "Tactical deck map"}</h3>
          <p>{report.strategy}</p>
        </div>
        <div className="deck-map__readouts" aria-label="Deck telemetry">
          <span><b>{report.stats.mainCount}</b> / 50 MAIN</span>
          <span><b>{graph.nodes.length}</b> NODES</span>
          <span><b>{graph.edges.length}</b> CONNECTIONS</span>
          <span><b>{report.stats.averageCost}</b> AVERAGE CURVE</span>
          <span><b>{report.confidence}</b> CONFIDENCE</span>
          <span className={report.legality?.legal ? "is-legal" : "is-illegal"}>
            <b>{report.legality?.legal ? "LEGAL" : "ILLEGAL"}</b> CURRENT RULESET
          </span>
        </div>
      </header>

      <div className={`deck-map__workspace ${rosterOpen ? "is-roster-open" : ""} ${inspectorOpen ? "is-inspector-open" : ""}`.trim()}>
        <div className="deck-map__cockpit-frame" aria-hidden="true">
          <i className="is-north-west" />
          <i className="is-north-east" />
          <i className="is-south-west" />
          <i className="is-south-east" />
          <b className="is-horizon" />
          <b className="is-reticle" />
          <span>NEURAL GRID // POTTER</span>
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
          className={`deck-map__canvas ${isPanning ? "is-panning" : ""}`.trim()}
          role="group"
          aria-label="Interactive map of recommended deck cards and their relationships. Drag the field to pan."
          onMouseLeave={() => setHoveredId("")}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
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
                const source = graph.nodes.find((node) => node.id === edge.source);
                const target = graph.nodes.find((node) => node.id === edge.target);
                if (!source || !target) return null;
                const isActive = !activeId || edge.source === activeId || edge.target === activeId;
                return (
                  <line
                    key={edge.id}
                    className={`deck-map__link deck-map__link--${edge.kind} ${isActive ? "is-active" : "is-dimmed"}`.trim()}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                  />
                );
              })}
            </svg>

            {(graph.nodes || []).map((node) => {
              const isActive = node.id === activeId;
              const isSelected = node.id === selectedNode?.id;
              const isRelated = !activeId || relatedIds.has(node.id);
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`deck-map-node deck-map-node--${node.row.category} ${isActive ? "is-active" : ""} ${isSelected ? "is-selected" : ""} ${isRelated ? "is-related" : "is-dimmed"}`.trim()}
                  style={{ "--node-x": `${node.x}%`, "--node-y": `${node.y}%` }}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onFocus={() => setHoveredId(node.id)}
                  onBlur={() => setHoveredId("")}
                  onClick={() => selectNode(node.id, "map")}
                  aria-pressed={isSelected}
                  aria-label={`${node.row.quantity} copies of ${node.row.card.cardName}. ${node.degree} connections.`}
                >
                  <span className="deck-map-node__orbit" aria-hidden="true" />
                  <CardArt card={node.row.card} className="deck-map-node__art" compact />
                  <span className="deck-map-node__qty">{node.row.quantity}x</span>
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
            <span>DRAG TO PAN</span>
          </div>

          <div className="deck-map__legend" aria-label="Connection legend">
            <span><i className="is-observed" /> Observed synergy</span>
            <span><i className="is-inferred" /> Inferred synergy</span>
            <span><i className="is-structural" /> Trait / curve</span>
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
            graph={graph}
            substitutions={report.substitutions?.[selectedNode.id] || []}
            onSelect={(nodeId) => selectNode(nodeId, "inspector")}
            onApply={(targetCardNumber) => onApplySubstitution(selectedNode.id, targetCardNumber)}
            onClose={() => setInspectorOpen(false)}
          />
        ) : null}
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

function DeckMapInspector({ node, connections, graph, substitutions, onSelect, onApply, onClose }) {
  const { row } = node;
  return (
    <aside className="deck-map-inspector" aria-live="polite">
      <header>
        <span>NODE // {row.card.cardNumber}</span>
        <strong>{row.quantity}x</strong>
        <button type="button" onClick={onClose} aria-label="Close selected card data">›</button>
      </header>
      <div className="deck-map-inspector__identity">
        <CardArt card={row.card} className="deck-map-inspector__art" />
        <div>
          <h3>{row.card.cardName}</h3>
          <p>{row.card.cardType} · {row.card.color} · Cost {row.card.cost || "-"}</p>
          <div className="deck-map-inspector__tags">
            <span className={`deck-category-pill deck-category-pill--${row.category}`}>{row.category}</span>
            <span>{row.confidence} confidence</span>
          </div>
        </div>
      </div>
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
                <span><strong>{other?.row.card.cardName || otherId}</strong><small>{edge.label}</small></span>
              </button>
            );
          })}
        </div>
      </section>
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
