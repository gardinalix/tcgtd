import assert from "node:assert/strict";
import test from "node:test";
import { effectiveBrlPrice, formatBrl, formatUsd, getPriceTelemetry } from "../src/domain/cards.js";

test("BRL and USD labels use their native decimal conventions", () => {
  assert.equal(formatBrl(1234.5), "R$ 1.234,50");
  assert.equal(formatUsd(1234.5), "US$ 1,234.50");
});

test("market telemetry prioritizes the lowest synchronized Brazilian listing", () => {
  const card = {
    priceStatus: "ok",
    marketPriceBrlFx: 43.34,
    marketPriceUsd: 8.53,
    ligaGundamLowPriceBrl: 1.94,
    ligaGundamBestShop: "Liga marketplace",
    marketZeonLowPriceBrl: 2,
    marketZeonBestShop: "Local store",
  };
  const signal = getPriceTelemetry(card);
  assert.equal(signal.kind, "market");
  assert.equal(signal.sourceCode, "LIGA");
  assert.equal(signal.value, 1.94);
  assert.deepEqual(signal.comparison.map((item) => item.code), ["LIGA", "MZ", "REF"]);
  assert.equal(effectiveBrlPrice(card), 1.94);
});

test("TCG conversion is clearly classified as a reference, not a local listing", () => {
  const signal = getPriceTelemetry({ priceStatus: "ok", marketPriceBrlFx: 12.5, marketPriceUsd: 2.5 });
  assert.equal(signal.kind, "reference");
  assert.equal(signal.sourceCode, "REF");
  assert.equal(signal.value, 12.5);
});

test("missing prices produce a stable unavailable readout", () => {
  const signal = getPriceTelemetry({ priceStatus: "tcgcsv_not_found" });
  assert.equal(signal.kind, "unavailable");
  assert.equal(signal.value, null);
  assert.deepEqual(signal.comparison, []);
});
