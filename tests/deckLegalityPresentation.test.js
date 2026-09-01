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

  const counterPlan = { active: true, targetArchetype: "Strike Freedom Gundam" };
  const compact = compactDeckDesign({
    legality,
    counterPlan,
    rows: [{ card: { cardNumber: "TEST-001" }, counterScore: 0.75, counterReasons: ["pressure setup turns"] }],
  });

  assert.deepEqual(compact.legality, legality);
  assert.deepEqual(compact.counterPlan, counterPlan);
  assert.equal(compact.cardRecommendations[0].counterScore, 0.75);
});
