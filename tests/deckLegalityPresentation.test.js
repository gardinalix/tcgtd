import assert from "node:assert/strict";
import test from "node:test";
import { getDeckLegalityPresentation } from "../src/services/deckDesigner/deckLegalityPresentation.js";
import { compactDeckDesign } from "../src/services/deckDesigner/index.js";

test("deck legality readout distinguishes legal, illegal, and missing validation", () => {
  assert.deepEqual(
    getDeckLegalityPresentation({ legal: true }),
    {
      className: "is-legal",
      label: "LEGAL",
      detail: "This deck passes the current rules check.",
    },
  );

  assert.deepEqual(
    getDeckLegalityPresentation({ legal: false, issues: ["Copy limit exceeded."] }),
    {
      className: "is-illegal",
      label: "ILLEGAL",
      detail: "Copy limit exceeded.",
    },
  );

  assert.equal(getDeckLegalityPresentation(undefined).label, "NOT CHECKED");
  assert.notEqual(getDeckLegalityPresentation(undefined).className, "is-illegal");
});

test("compact Designer reports preserve their legality result", () => {
  const legality = {
    legal: true,
    issues: [],
    violations: [],
    rulesEffectiveDate: "2026-07-24",
  };

  assert.deepEqual(compactDeckDesign({ legality }).legality, legality);
});
