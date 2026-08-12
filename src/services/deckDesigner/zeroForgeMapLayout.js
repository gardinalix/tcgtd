export const FORGE_STAGE_WIDTH = 1500;

const LANE_X = [78, 340, 602, 864];
const MAP_TOP = 86;
const DECK_ROW_PITCH = 174;
const GHOST_X = 1156;
const GHOST_GAP = 20;
const MAP_BOTTOM_PADDING = 72;

export function buildForgeLayout(rows = [], suggestions = [], focusCardNumber = "") {
  const buckets = [
    { id: "early", label: "COST 0–2", test: (cost) => cost <= 2, x: LANE_X[0] },
    { id: "three", label: "COST 3", test: (cost) => cost === 3, x: LANE_X[1] },
    { id: "four", label: "COST 4", test: (cost) => cost === 4, x: LANE_X[2] },
    { id: "late", label: "COST 5+", test: (cost) => cost >= 5, x: LANE_X[3] },
  ].map((lane) => ({
    ...lane,
    rows: rows
      .filter((row) => lane.test(Number(row.card.cost || 0)))
      .sort((left, right) =>
        String(left.card.cardType).localeCompare(String(right.card.cardType))
        || String(left.card.cardName).localeCompare(String(right.card.cardName))),
  }));
  const positions = new Map();
  let deepestDeckNode = MAP_TOP;

  for (const lane of buckets) {
    lane.rows.forEach((row, index) => {
      const x = lane.x + (index % 2) * 124;
      const y = MAP_TOP + Math.floor(index / 2) * DECK_ROW_PITCH;
      positions.set(row.card.cardNumber, { x, y, cx: x + 54, cy: y + 76 });
      deepestDeckNode = Math.max(deepestDeckNode, y + forgeNodeSize(row.card.cardNumber).height);
    });
  }

  // Suggestions occupy one terminal column. Ordering them by their anchor keeps
  // the wires legible and makes each wire finish at its own card instead of a
  // two-column stack that can overlap or cross unrelated projections.
  const projectionQueue = suggestions
    .map((suggestion, index) => {
      const sourceId = suggestion.bestSourceCardNumber || focusCardNumber;
      const source = positions.get(sourceId);
      return {
        suggestion,
        index,
        desiredY: Math.max(MAP_TOP, (source?.cy || MAP_TOP + 76) - (forgeNodeSize("ghost:projection").height / 2)),
      };
    })
    .sort((left, right) => left.desiredY - right.desiredY || left.index - right.index);

  let nextProjectionY = MAP_TOP;
  for (const { suggestion, desiredY } of projectionQueue) {
    const y = Math.max(desiredY, nextProjectionY);
    const nodeId = `ghost:${suggestion.card.cardNumber}`;
    const size = forgeNodeSize(nodeId);
    positions.set(nodeId, { x: GHOST_X, y, cx: GHOST_X + (size.width / 2), cy: y + (size.centerY || size.height / 2) });
    nextProjectionY = y + size.height + GHOST_GAP;
  }

  return {
    height: Math.max(820, deepestDeckNode + MAP_BOTTOM_PADDING, nextProjectionY + MAP_BOTTOM_PADDING),
    positions,
    lanes: buckets.map((lane) => ({
      id: lane.id,
      label: lane.label,
      x: lane.x,
      count: lane.rows.reduce((sum, row) => sum + row.quantity, 0),
    })),
  };
}

export function applyForgeNodePositions(layout, nodePositions = {}) {
  const positions = new Map(
    [...layout.positions.entries()].map(([nodeId, position]) => {
      const override = nodePositions[nodeId];
      if (!override) return [nodeId, position];
      const size = forgeNodeSize(nodeId);
      return [
        nodeId,
        {
          x: override.x,
          y: override.y,
          cx: override.x + (size.width / 2),
          cy: override.y + (size.centerY || size.height / 2),
        },
      ];
    }),
  );
  return { ...layout, positions };
}

export function forgeNodeSize(nodeId) {
  return String(nodeId).startsWith("ghost:")
    ? { width: 152, height: 134, centerY: 67 }
    : { width: 108, height: 152, centerY: 76 };
}

export function forgeLinkEndpoints(source, target, sourceId, targetId) {
  return {
    ...pointOnNodeEdge(source, forgeNodeSize(sourceId), target.cx, target.cy),
    ...prefixPoint("x2", "y2", pointOnNodeEdge(target, forgeNodeSize(targetId), source.cx, source.cy)),
  };
}

function pointOnNodeEdge(position, size, towardX, towardY) {
  const deltaX = towardX - position.cx;
  const deltaY = towardY - position.cy;
  if (!deltaX && !deltaY) return { x1: position.cx, y1: position.cy };
  const scale = 1 / Math.max(
    Math.abs(deltaX) / (size.width / 2),
    Math.abs(deltaY) / (size.height / 2),
  );
  return {
    x1: position.cx + (deltaX * scale),
    y1: position.cy + (deltaY * scale),
  };
}

function prefixPoint(xKey, yKey, point) {
  return { [xKey]: point.x1, [yKey]: point.y1 };
}
