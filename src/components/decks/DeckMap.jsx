import { useEffect, useMemo, useRef, useState } from "react";
import { CardArt } from "../cards/CardArt";
import { buildDeckGraph, relatedNodeIds } from "../../services/deckDesigner/deckMapLayout.js";

export function DeckMap({ report, onApplySubstitution }) {
  const graph = useMemo(() => buildDeckGraph(report.rows, report.synergies), [report.rows, report.synergies]);
  const [selectedId, setSelectedId] = useState(() => graph.nodes[0]?.id || "");
  const [hoveredId, setHoveredId] = useState("");
  const activeId = hoveredId || selectedId;
  const relatedIds = useMemo(() => relatedNodeIds(graph, activeId), [graph, activeId]);
  const rosterGroups = useMemo(() => groupRosterNodes(graph.nodes), [graph.nodes]);
  const rosterNodeRefs = useRef(new Map());
  const selectionSourceRef = useRef("");
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
  }

  return (
    <section className="deck-map">
      <header className="deck-map__hudbar">
        <div>
          <span className="eyebrow">DECK LINK MAP // LIVE</span>
          <h3>Tactical deck map</h3>
        </div>
        <div className="deck-map__readouts" aria-label="Deck telemetry">
          <span><b>{report.stats.mainCount}</b> / 50 MAIN</span>
          <span><b>{graph.nodes.length}</b> NODES</span>
          <span><b>{graph.edges.length}</b> CONNECTIONS</span>
          <span><b>{report.stats.averageCost}</b> AVERAGE CURVE</span>
          <span><b>{report.confidence}</b> CONFIDENCE</span>
        </div>
      </header>

      <div className="deck-map__workspace">
        <DeckMapRoster
          groups={rosterGroups}
          activeId={activeId}
          selectedId={selectedNode?.id || ""}
          relatedIds={relatedIds}
          onHover={setHoveredId}
          onSelect={(nodeId) => selectNode(nodeId, "list")}
          nodeRefs={rosterNodeRefs}
          mainCount={report.stats.mainCount}
        />

        <div
          className="deck-map__canvas"
          role="group"
          aria-label="Interactive map of recommended deck cards and their relationships"
          onMouseLeave={() => setHoveredId("")}
        >
          <div className="deck-map__scanline" aria-hidden="true" />
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

          <div className="deck-map__legend" aria-label="Connection legend">
            <span><i className="is-observed" /> Observed synergy</span>
            <span><i className="is-inferred" /> Inferred synergy</span>
            <span><i className="is-structural" /> Trait / curve</span>
          </div>
        </div>

        {selectedNode ? (
          <DeckMapInspector
            node={selectedNode}
            connections={selectedConnections}
            graph={graph}
            substitutions={report.substitutions?.[selectedNode.id] || []}
            onSelect={(nodeId) => selectNode(nodeId, "inspector")}
            onApply={(targetCardNumber) => onApplySubstitution(selectedNode.id, targetCardNumber)}
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

function DeckMapInspector({ node, connections, graph, substitutions, onSelect, onApply }) {
  const { row } = node;
  return (
    <aside className="deck-map-inspector" aria-live="polite">
      <header>
        <span>NODE // {row.card.cardNumber}</span>
        <strong>{row.quantity}x</strong>
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
