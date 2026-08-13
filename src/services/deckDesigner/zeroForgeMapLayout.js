export const FORGE_STAGE_WIDTH = 1200;
const MIN_FIT_ZOOM = 0.5;

const LANE_X = [32, 224, 416, 608];
const LANE_CARD_OFFSET = 64;
const MAP_TOP = 86;
// A map node is a 190px-tall stack once its card, identity strip and quantity
// controls render. Keep a real gutter below each pair: using the old 174px
// pitch made the controls of one row sit on top of the next row's art.
const DECK_ROW_PITCH = 210;
const GHOST_X = 864;
const GHOST_COLUMN_PITCH = 168;
const GHOST_GAP = 20;
const MAP_BOTTOM_PADDING = 72;
const DESKTOP_MIN_FIT_ZOOM = 0.6;
const NARROW_MIN_FIT_ZOOM = 0.5;

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
      // Each cost lane is a single readable column. Two cards used to share
      // its 238px frame, but the second card bled into the next lane at every
      // breakpoint and made both quantity controls hard to operate.
      const size = forgeNodeSize(row.card.cardNumber);
      const x = lane.x + LANE_CARD_OFFSET;
      const y = MAP_TOP + (index * DECK_ROW_PITCH);
      positions.set(row.card.cardNumber, {
        x,
        y,
        cx: x + (size.width / 2),
        cy: y + (size.centerY || size.height / 2),
      });
      deepestDeckNode = Math.max(deepestDeckNode, y + size.height);
    });
  }

  // Suggestions remain at the end of the synergy field, but use a compact
  // two-column terminal so all additions can be read without horizontal or
  // vertical hunting. Every wire still terminates at its target card edge.
  const projectionQueue = suggestions
    .map((suggestion, index) => {
      const sourceId = suggestion.bestSourceCardNumber || focusCardNumber;
      const source = positions.get(sourceId);
      return {
        suggestion,
        index,
        desiredY: Math.max(MAP_TOP, (source?.cy || MAP_TOP + 95) - (forgeNodeSize("ghost:projection").height / 2)),
      };
    })
    .sort((left, right) => left.desiredY - right.desiredY || left.index - right.index);

  let deepestProjectionNode = MAP_TOP;
  for (const [index, { suggestion }] of projectionQueue.entries()) {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const nodeId = `ghost:${suggestion.card.cardNumber}`;
    const size = forgeNodeSize(nodeId);
    const x = GHOST_X + (column * GHOST_COLUMN_PITCH);
    const y = MAP_TOP + (row * (size.height + GHOST_GAP));
    positions.set(nodeId, { x, y, cx: x + (size.width / 2), cy: y + (size.centerY || size.height / 2) });
    deepestProjectionNode = Math.max(deepestProjectionNode, y + size.height);
  }

  return {
    height: Math.max(820, deepestDeckNode + MAP_BOTTOM_PADDING, deepestProjectionNode + MAP_BOTTOM_PADDING),
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
    : { width: 108, height: 190, centerY: 95 };
}

export function calculateForgeFitZoom({ viewportWidth }) {
  const availableWidth = Math.max(1, Number(viewportWidth || 0) - 32);
  const minimumReadableZoom = availableWidth < 480
    ? NARROW_MIN_FIT_ZOOM
    : DESKTOP_MIN_FIT_ZOOM;
  return clamp(
    availableWidth / FORGE_STAGE_WIDTH,
    minimumReadableZoom,
    1,
  );
}

export function calculateForgeFitScroll({ viewportWidth, zoom }) {
  const visibleWidth = Math.max(1, Number(viewportWidth || 0));
  const scaledStageWidth = FORGE_STAGE_WIDTH * Math.max(0, Number(zoom || 0));
  return {
    scrollLeft: Math.max(0, (scaledStageWidth - visibleWidth) / 2),
    // Always begin at the command header. A vertical centre point hides the
    // cost lanes on longer decks and makes the tactical map read as a pile.
    scrollTop: 0,
  };
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

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
