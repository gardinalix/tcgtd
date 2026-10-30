import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ARCHIVE_COLUMNS,
  buildCardArchiveRows,
  buildCardArchiveXlsx,
} from "../src/domain/cardArchiveExport.js";

const data = JSON.parse(await readFile(new URL("../web/app-data.json", import.meta.url), "utf8"));
const cards = [...data.cards, ...data.resourceCards];

function unzipStored(bytes) {
  const buffer = Buffer.from(bytes);
  const entries = new Map();
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    assert.equal(method, 0, "Files in browser-generated XLSX must use ZIP STORE");
    const length = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
    const begin = offset + 30 + nameLength + extraLength;
    entries.set(name, buffer.subarray(begin, begin + length).toString("utf8"));
    offset = begin + length;
  }
  assert.equal(buffer.readUInt32LE(offset), 0x02014b50, "A central ZIP directory must exist");
  const eocd = buffer.length - 22;
  assert.equal(buffer.readUInt32LE(eocd), 0x06054b50, "A ZIP end-of-central-directory record must exist");
  assert.equal(buffer.readUInt16LE(eocd + 10), entries.size);
  return entries;
}

test("public card archive exports every official printing without dropping Resources", () => {
  const expectedPrintings = cards.reduce((sum, card) => sum + (card.printings?.length || 1), 0);
  const all = buildCardArchiveRows(cards, { includeVariants: true });
  const base = buildCardArchiveRows(cards, { includeVariants: false });
  assert.equal(all.length, expectedPrintings);
  assert.equal(base.length, new Set(cards.map((card) => card.cardNumber)).size);
  assert.equal(new Set(all.map((row) => row.printingId)).size, all.length);
  assert.equal(new Set(base.map((row) => row.cardNumber)).size, base.length);
  assert(all.some((row) => row.type === "RESOURCE"));
  assert(all.some((row) => row.variant === "Parallel / Alt"));
  assert(all.some((row) => row.variant === "Base"));
  assert.equal(all.every((row) => row.cardNumber && row.name && row.printingId), true);
});

test("print-specific prices must not be replaced by canonical prices", () => {
  const card = cards.find((item) => item.cardNumber === "GD01-118");
  assert(card?.printings?.length > 1);
  const sample = buildCardArchiveRows([card], { includeVariants: true });
  const basePrint = sample.find((row) => row.printingId === "GD01-118");
  const source = card.printings.find((printing) => printing.detailSearchId === "GD01-118");
  assert.equal(basePrint.tcgUsd, source.marketPriceUsd);
  assert.equal(basePrint.image, source.remoteImageUrl);
});

test("current filtered results work for printings and canonical cards", () => {
  const card = cards.find((item) => item.printings?.length > 1);
  const id = card.printings[1].detailSearchId;
  const printResults = buildCardArchiveRows(cards, { includeVariants: true, visibleIds: [id] });
  assert.equal(printResults.length, 1);
  assert.equal(printResults[0].printingId, id);
  const canonicalResults = buildCardArchiveRows(cards, { includeVariants: false, visibleNumbers: [card.cardNumber] });
  assert.equal(canonicalResults.length, 1);
  assert.equal(canonicalResults[0].cardNumber, card.cardNumber);
});

test("Excel workbook is a structurally complete ZIP containing both worksheets", () => {
  const rows = buildCardArchiveRows(cards, { includeVariants: true });
  const xlsx = buildCardArchiveXlsx(rows, { snapshot: data.cardSnapshotGeneratedAt });
  const entries = unzipStored(xlsx);
  for (const name of [
    "[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels", "xl/styles.xml",
    "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml",
  ]) assert(entries.has(name), name + " must be present");
  const sheet = entries.get("xl/worksheets/sheet1.xml");
  const about = entries.get("xl/worksheets/sheet2.xml");
  assert(sheet.includes('autoFilter ref="A1:U' + (rows.length + 1) + '"'));
  assert(sheet.includes("Printing ID"));
  assert(sheet.includes("Gundam"));
  assert(about.includes("Card data snapshot (UTC)"));
  assert.equal(ARCHIVE_COLUMNS.length, 21);
  assert.equal((sheet.match(/<row /g) || []).length, rows.length + 1);
});

test("spreadsheet values escape XML and stay inline strings rather than formulas", () => {
  const sample = [{ ...buildCardArchiveRows([cards[0]], { includeVariants: false })[0], name: 'X&<Y>"=SUM(1,1)' }];
  const entries = unzipStored(buildCardArchiveXlsx(sample));
  const xml = entries.get("xl/worksheets/sheet1.xml");
  assert(xml.includes("X&amp;&lt;Y&gt;&quot;=SUM(1,1)"));
  assert(xml.includes('t="inlineStr"'));
});
