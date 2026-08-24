import path from "node:path";
import { PATHS, fileMetadata, readJson } from "../lib.mjs";

export const manualAdapter = {
  id: "manual-registry",
  async discover() {
    return [path.join(PATHS.sources, "tournaments.json")];
  },
  async fetch() {
    const filePath = path.join(PATHS.sources, "tournaments.json");
    return { tournaments: await readJson(filePath, []), metadata: await fileMetadata(filePath) };
  },
  parse(payload) {
    return Array.isArray(payload.tournaments) ? payload.tournaments : [];
  },
  async normalize() {
    throw new Error("manualAdapter is normalized by the central data engine to reconcile it with source discoveries.");
  },
};
