import test from "node:test";
import assert from "node:assert/strict";
import { BENCH_GLASS, rectangleToQuad } from "../src/domain/benchProjection.js";

function project(matrix, x, y) {
  const w = matrix[3] * x + matrix[7] * y + matrix[15];
  return [(matrix[0] * x + matrix[4] * y + matrix[12]) / w,
    (matrix[1] * x + matrix[5] * y + matrix[13]) / w];
}
function near(actual, expected) {
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6, `${actual} != ${expected}`));
}

test("flat glass keeps undistorted text and translates pointer coordinates", () => {
  const matrix = rectangleToQuad(300, 200, [[40, 20], [340, 20], [340, 220], [40, 220]]);
  near(project(matrix, 0, 0), [40, 20]);
  near(project(matrix, 150, 100), [190, 120]);
  near(project(matrix, 300, 200), [340, 220]);
});

test("every pane meets all four glass corners at desktop and tablet sizes", () => {
  for (const [width, height] of [[1024, 500], [1672, 552], [2560, 620]]) {
    for (const quad of Object.values(BENCH_GLASS)) {
      const corners = quad.map(([x, y]) => [x * width, y * height]);
      const matrix = rectangleToQuad(400, 230, corners);
      [[0, 0], [400, 0], [400, 230], [0, 230]].forEach(([x, y], i) => near(project(matrix, x, y), corners[i]));
      const center = project(matrix, 200, 115);
      assert.ok(center.every(Number.isFinite));
      assert.ok(center[0] > Math.min(...corners.map(p => p[0])) && center[0] < Math.max(...corners.map(p => p[0])));
    }
  }
});

test("collapsed geometry never emits an invalid CSS matrix", () => {
  assert.equal(rectangleToQuad(0, 100, BENCH_GLASS.feed), null);
  assert.equal(rectangleToQuad(100, 100, [[0, 0], [0, 0], [0, 0], [0, 0]]), null);
});
