const MAX_STRUCTURAL_EDGES_PER_NODE = 2;
const MAX_GRAPH_EDGES = 84;
const MAX_REPORTED_EDGES_PER_NODE = 3;

export function buildDeckGraph(rows = [], synergies = []) {
  const uniqueRows = uniqueBy(rows.filter((row) => row?.card?.cardNumber), (row) => row.card.cardNumber);
  const rowById = new Map(uniqueRows.map((row) => [row.card.cardNumber, row]));
  const edges = [];
  const edgeIds = new Set();
  const reportedDegree = new Map();

  for (const synergy of synergies) {
    if (edges.length >= MAX_GRAPH_EDGES) break;
    const source = synergy?.sourceCard?.cardNumber;
    const target = synergy?.targetCard?.cardNumber;
    if (!rowById.has(source) || !rowById.has(target) || source === target) continue;
    const id = edgeId(source, target);
    if (edgeIds.has(id)) continue;
    const sourceDegree = reportedDegree.get(source) || 0;
    const targetDegree = reportedDegree.get(target) || 0;
    if (sourceDegree >= MAX_REPORTED_EDGES_PER_NODE || targetDegree >= MAX_REPORTED_EDGES_PER_NODE) continue;
    edgeIds.add(id);
    reportedDegree.set(source, sourceDegree + 1);
    reportedDegree.set(target, targetDegree + 1);
    const strength = synergy.rank || strengthFromScore(synergy.score);
    const rules = new Set(synergy.algorithmRules || []);
    const isPrintedMechanic = ["direct_link_pair", "mechanic_setup", "text_bridge"]
      .some((rule) => rules.has(rule));
    edges.push({
      id,
      source,
      target,
      kind: isPrintedMechanic ? "printed" : synergy.coDeckCount > 0 ? "observed" : "inferred",
      score: Number(synergy.score || 0),
      strength,
      basis: relationshipBasis(synergy),
      label: synergy.explanation
        || (synergy.coDeckCount > 0
          ? `${strengthLabel(strength)}: observed together in ${synergy.coDeckCount} competitive decklists.`
          : "Low synergy: inferred text, trait or curve interaction."),
      shared: [],
    });
  }

  const structuralCandidates = [];
  for (let leftIndex = 0; leftIndex < uniqueRows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < uniqueRows.length; rightIndex += 1) {
      const left = uniqueRows[leftIndex];
      const right = uniqueRows[rightIndex];
      const id = edgeId(left.card.cardNumber, right.card.cardNumber);
      if (edgeIds.has(id)) continue;
      const relation = scoreStructuralRelation(left.card, right.card);
      if (relation.score > 0) {
        structuralCandidates.push({
          id,
          source: left.card.cardNumber,
          target: right.card.cardNumber,
          kind: "structural",
          score: relation.score,
          strength: "structural",
          basis: "DECK STRUCTURE",
          label: relation.label,
          shared: relation.shared,
        });
      }
    }
  }

  const structuralDegree = new Map();
  structuralCandidates
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .forEach((edge) => {
      const sourceDegree = structuralDegree.get(edge.source) || 0;
      const targetDegree = structuralDegree.get(edge.target) || 0;
      if (sourceDegree >= MAX_STRUCTURAL_EDGES_PER_NODE || targetDegree >= MAX_STRUCTURAL_EDGES_PER_NODE) return;
      if (edges.length >= Math.min(MAX_GRAPH_EDGES, Math.max(uniqueRows.length * 2, 12))) return;
      edges.push(edge);
      edgeIds.add(edge.id);
      structuralDegree.set(edge.source, sourceDegree + 1);
      structuralDegree.set(edge.target, targetDegree + 1);
    });

  connectIsolatedNodes(uniqueRows, edges, edgeIds, MAX_GRAPH_EDGES);

  const degree = new Map(uniqueRows.map((row) => [row.card.cardNumber, 0]));
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }

  const orderedRows = [...uniqueRows].sort((left, right) =>
    (degree.get(right.card.cardNumber) || 0) - (degree.get(left.card.cardNumber) || 0)
    || categoryWeight(right.category) - categoryWeight(left.category)
    || Number(right.confidenceValue || 0) - Number(left.confidenceValue || 0)
    || String(left.card.cardNumber).localeCompare(String(right.card.cardNumber)));

  const nodes = layoutNodes(orderedRows).map((node) => ({
    ...node,
    degree: degree.get(node.id) || 0,
  }));

  return { nodes, edges };
}

export function relatedNodeIds(graph, selectedId) {
  if (!selectedId) return new Set();
  const ids = new Set([selectedId]);
  for (const edge of graph.edges || []) {
    if (edge.source === selectedId) ids.add(edge.target);
    if (edge.target === selectedId) ids.add(edge.source);
  }
  return ids;
}

function layoutNodes(rows) {
  if (!rows.length) return [];
  const positions = [{ x: 50, y: 50 }];
  const innerCount = Math.min(7, Math.max(0, rows.length - 1));
  for (let index = 0; index < innerCount; index += 1) {
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / innerCount);
    positions.push({
      x: round(50 + Math.cos(angle) * 24),
      y: round(50 + Math.sin(angle) * 27),
    });
  }
  const outerCount = rows.length - positions.length;
  for (let index = 0; index < outerCount; index += 1) {
    const angle = (-Math.PI / 2) + 0.22 + ((Math.PI * 2 * index) / outerCount);
    positions.push({
      x: round(50 + Math.cos(angle) * 43),
      y: round(50 + Math.sin(angle) * 41),
    });
  }
  return rows.map((row, index) => ({
    id: row.card.cardNumber,
    row,
    x: positions[index].x,
    y: positions[index].y,
  }));
}

function connectIsolatedNodes(rows, edges, edgeIds, maxEdges) {
  const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const anchor = rows
    .slice()
    .sort((left, right) => categoryWeight(right.category) - categoryWeight(left.category))[0];
  if (!anchor) return;
  for (const row of rows) {
    if (edges.length >= maxEdges) break;
    const source = row.card.cardNumber;
    if (connected.has(source) || source === anchor.card.cardNumber) continue;
    const candidates = rows
      .filter((candidate) => candidate.card.cardNumber !== source)
      .map((candidate) => ({
        candidate,
        relation: scoreStructuralRelation(row.card, candidate.card),
      }))
      .sort((left, right) => right.relation.score - left.relation.score);
    const target = candidates[0]?.candidate || anchor;
    const relation = candidates[0]?.relation || { score: 1, label: "Deck structure link", shared: [] };
    const id = edgeId(source, target.card.cardNumber);
    if (edgeIds.has(id)) continue;
    edgeIds.add(id);
    connected.add(source);
    connected.add(target.card.cardNumber);
    edges.push({
      id,
      source,
      target: target.card.cardNumber,
      kind: "structural",
      score: Math.max(1, relation.score),
      strength: "structural",
      basis: "DECK STRUCTURE",
      label: relation.score > 0 ? relation.label : "Deck structure link",
      shared: relation.shared,
    });
  }
}

function scoreStructuralRelation(left, right) {
  const leftTraits = normalizedSet(left.traits);
  const rightTraits = normalizedSet(right.traits);
  const leftTags = normalizedSet(left.synergyTags);
  const rightTags = normalizedSet(right.synergyTags);
  const sharedTraits = intersection(leftTraits, rightTraits);
  const sharedTags = intersection(leftTags, rightTags);
  const sameColor = left.color && left.color === right.color;
  const costDistance = Math.abs(Number(left.cost || 0) - Number(right.cost || 0));
  const score = (sharedTags.length * 28)
    + (sharedTraits.length * 20)
    + (sameColor ? 4 : 0)
    + (costDistance <= 1 ? 3 : 0);
  const shared = [...sharedTags, ...sharedTraits].slice(0, 4);
  const label = shared.length
    ? `Shared signals: ${shared.join(", ")}`
    : sameColor && costDistance <= 1
      ? "Same-color curve bridge"
      : "Deck structure link";
  return { score, shared, label };
}

function normalizedSet(values = []) {
  return new Set(values.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean));
}

function intersection(left, right) {
  return [...left].filter((value) => right.has(value));
}

function edgeId(left, right) {
  return [left, right].sort().join("__");
}

function categoryWeight(category) {
  return { essential: 4, flexible: 3, accessible: 2, experimental: 1 }[category] || 0;
}

function strengthFromScore(value) {
  const score = Number(value || 0);
  if (score >= 80) return "high";
  if (score >= 50) return "good";
  return "low";
}

function strengthLabel(strength) {
  return { high: "High synergy", good: "Good synergy", low: "Low synergy" }[strength] || "Structural link";
}

function relationshipBasis(synergy = {}) {
  const rules = new Set(synergy.algorithmRules || []);
  if (rules.has("direct_link_pair")) return "PRINTED LINK / PAIR";
  if (rules.has("mechanic_setup")) return "MECHANICAL COMBO";
  if (rules.has("text_bridge")) {
    return synergy.textBridgeLabel
      ? `TEXT · ${String(synergy.textBridgeLabel).toUpperCase()}`
      : "CARD-TEXT BRIDGE";
  }
  if (rules.has("shared_trait")) return "SHARED TRAIT";
  if (synergy.coDeckCount > 0) return `CO-PLAY · ${synergy.coDeckCount} LISTS`;
  if (rules.has("shared_keyword")) return "SHARED MECHANIC";
  return "DECK CONTEXT";
}

function uniqueBy(values, keyFn) {
  const seen = new Set();
  return values.filter((value) => {
    const key = keyFn(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function round(value) {
  return Math.round(value * 100) / 100;
}
