import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FILTERS, filterCards } from "../src/utils/cardFilters.js";

test("card search accepts a space in the collection code", () => {
  const cards = [
    { cardNumber: "GD06-033", cardName: "ZZ Gundam" },
    { cardNumber: "GD06-064", cardName: "Altron Gundam (EW)" },
    { cardNumber: "GD05-110", cardName: "Darkness Finger" },
  ];

  const search = (query) => filterCards(cards, { ...DEFAULT_FILTERS, search: query });

  assert.deepEqual(search("GD 06"), cards.slice(0, 2));
  assert.deepEqual(search("gd 06-033"), [cards[0]]);
  assert.deepEqual(search("GD06"), cards.slice(0, 2));
  assert.deepEqual(search("Darkness Finger"), [cards[2]]);
});
