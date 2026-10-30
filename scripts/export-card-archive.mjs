/**
 * Generate the full public GCG card catalog as an Excel workbook.
 * Uses the same export implementation as Card Intelligence Archive.
 *
 * Run: node scripts/export-card-archive.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCardArchiveRows, buildCardArchiveXlsx } from "../src/domain/cardArchiveExport.js";

const input = resolve("web/app-data.json");
const output = resolve("downloads/tcgtd-card-archive-all-printings.xlsx");
const data = JSON.parse(readFileSync(input, "utf8"));
const cards = [...(data.cards || []), ...(data.resourceCards || [])];
if (!cards.length) throw new Error("Card catalog is empty.");

const rows = buildCardArchiveRows(cards, { includeVariants: true });
const canonical = buildCardArchiveRows(cards, { includeVariants: false });
const expected = cards.reduce((count, card) => count + (card.printings?.length || 1), 0);

if (rows.length !== expected) {
  throw new Error("Printing count mismatch: expected " + expected + ", found " + rows.length);
}
if (new Set(rows.map((row) => row.printingId)).size !== rows.length) {
  throw new Error("Duplicate printing IDs detected.");
}
if (canonical.length !== new Set(cards.map((card) => card.cardNumber)).size) {
  throw new Error("Canonical cards count mismatch.");
}

const workbook = buildCardArchiveXlsx(rows, {
  includeVariants: true,
  scope: "Complete public GCG catalog",
  snapshot: data.generatedAt || data.cardSnapshotGeneratedAt || "",
});
mkdirSync(resolve("downloads"), { recursive: true });
writeFileSync(output, Buffer.from(workbook));
process.stdout.write(JSON.stringify({
  output,
  cards: canonical.length,
  printings: rows.length,
  resourceCards: data.resourceCards?.length || 0,
  size: workbook.byteLength,
}) + "\n");
