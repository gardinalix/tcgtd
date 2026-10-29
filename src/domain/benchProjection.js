// Glass corners in the instrument-bench artwork, normalized to its full bounds.
// Clockwise: top left, top right, bottom right, bottom left.
export const BENCH_GLASS = {
  radar: [[.068, .17], [.292, .205], [.292, .595], [.036, .615]],
  feed: [[.355, .17], [.645, .17], [.645, .588], [.355, .588]],
  signals: [[.708, .205], [.932, .17], [.964, .615], [.708, .595]],
};

// Project a rectangle onto a convex quadrilateral. CSS uses column-major order;
// the last row carries perspective so both glyphs and pointer hit areas agree.
export function rectangleToQuad(width, height, [p0, p1, p2, p3]) {
  const dx1 = p1[0] - p2[0], dx2 = p3[0] - p2[0];
  const dy1 = p1[1] - p2[1], dy2 = p3[1] - p2[1];
  const sx = p0[0] - p1[0] + p2[0] - p3[0];
  const sy = p0[1] - p1[1] + p2[1] - p3[1];
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (width <= 0 || height <= 0 || Math.abs(denominator) < 1e-8) return null;
  const g = (sx * dy2 - dx2 * sy) / denominator;
  const h = (dx1 * sy - sx * dy1) / denominator;
  return [
    (p1[0] - p0[0] + g * p1[0]) / width,
    (p1[1] - p0[1] + g * p1[1]) / width, 0, g / width,
    (p3[0] - p0[0] + h * p3[0]) / height,
    (p3[1] - p0[1] + h * p3[1]) / height, 0, h / height,
    0, 0, 1, 0, p0[0], p0[1], 0, 1,
  ];
}
