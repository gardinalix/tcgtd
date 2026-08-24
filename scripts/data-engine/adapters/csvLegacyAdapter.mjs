import fs from "node:fs/promises";
import path from "node:path";
import { ROOT, fileMetadata, parseCsv } from "../lib.mjs";

const INPUTS = Object.freeze({
  events: "meta_events.csv",
  results: "meta_results.csv",
  deckCards: "meta_deck_cards.csv",
});

/** Compatibility adapter: CSV is accepted only as import input, never served to the frontend. */
export const csvLegacyAdapter = {
  id: "csv-legacy",
  async discover() {
    return Object.values(INPUTS).map((name) => path.join(ROOT, "data", name));
  },
  async fetch() {
    const files = Object.fromEntries(await Promise.all(Object.entries(INPUTS).map(async ([key, name]) => {
      const filePath = path.join(ROOT, "data", name);
      return [key, { filePath, text: await fs.readFile(filePath, "utf8"), metadata: await fileMetadata(filePath) }];
    })));
    return files;
  },
  parse(payload) {
    return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, parseCsv(value.text)]));
  },
  async normalize() {
    throw new Error("csvLegacyAdapter is normalized by the central data engine to keep cross-file references consistent.");
  },
};
