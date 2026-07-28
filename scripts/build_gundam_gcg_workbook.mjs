import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const outputDir = path.join(rootDir, "outputs");
const renderDir = path.join(rootDir, ".scratch", "renders");
const outputPath = path.join(outputDir, "gundam-card-game-database.xlsx");

const snapshot = JSON.parse(
  await fs.readFile(path.join(dataDir, "gundam_gcg_snapshot.json"), "utf8"),
);
const formatNumber = new Intl.NumberFormat("en-US");
const previews = snapshot.previews ?? [];

const workbook = Workbook.create();
const derivedData = deriveProductCardMappings(snapshot);

const palette = {
  navy: "#0B2239",
  slate: "#2F4858",
  steel: "#5B7284",
  mist: "#E8EEF3",
  ice: "#F4F7FA",
  gold: "#C9A227",
  white: "#FFFFFF",
  line: "#C9D4DD",
  text: "#1D2A33",
};

const cardTypeCounts = countBy(snapshot.cards, "type");
const packageKindCardCounts = countBy(snapshot.cards, "package_kind");
const previewStatusCounts = countBy(previews, "preview_status");
const topPackages = [...snapshot.packages]
  .map((row) => ({
    label: row.package_label,
    value: Number(row.cards_found || 0),
  }))
  .sort((a, b) => b.value - a.value)
  .slice(0, 10);

const summarySheet = workbook.worksheets.add("Summary");
buildSummarySheet(summarySheet);

const packagesSheet = workbook.worksheets.add("Packages");
buildDataSheet(packagesSheet, snapshot.packages, [
  "package_id",
  "package_label",
  "package_code",
  "package_kind",
  "cards_expected",
  "cards_found",
  "cards_search_url",
]);

const productsSheet = workbook.worksheets.add("Products");
buildDataSheet(productsSheet, derivedData.productsEnriched, [
  "list_page",
  "category",
  "product_name",
  "product_code",
  "product_kind",
  "release_date",
  "msrp",
  "contains_cards_official",
  "linked_card_printings",
  "linked_preview_reveals",
  "linked_package_present",
  "product_url",
  "image_url",
]);

const previewsSheet = workbook.worksheets.add("Previews");
buildDataSheet(previewsSheet, previews, [
  "preview_id",
  "classification",
  "preview_status",
  "confidence",
  "source_type",
  "source_title",
  "source_date",
  "section_heading",
  "card_number_hint",
  "card_name_hint",
  "product_code",
  "product_name",
  "product_release_date",
  "matched_released_card",
  "matched_released_printings",
  "context_text",
  "source_url",
  "product_url",
  "image_url",
]);

const cardsSheet = workbook.worksheets.add("Cards");
buildDataSheet(cardsSheet, snapshot.cards, [
  "detail_search_id",
  "card_number",
  "variant_code",
  "is_parallel_variant",
  "card_name",
  "rarity",
  "block_icon",
  "level",
  "cost",
  "color",
  "type",
  "effect_text",
  "zone",
  "trait",
  "link",
  "ap",
  "hp",
  "source_title",
  "where_to_get_it",
  "package_id",
  "package_label",
  "package_code",
  "package_kind",
  "detail_url",
  "cards_search_url",
  "product_url",
  "image_url",
]);

const faqsSheet = workbook.worksheets.add("FAQs");
buildDataSheet(faqsSheet, snapshot.faqs, [
  "detail_search_id",
  "card_number",
  "card_name",
  "faq_number",
  "faq_updated_date",
  "question",
  "answer",
  "detail_url",
]);

const sourcesSheet = workbook.worksheets.add("Sources");
buildDataSheet(sourcesSheet, snapshot.sources, [
  "record_type",
  "record_id",
  "source_url",
  "cache_file",
]);

const summaryInspect = await workbook.inspect({
  kind: "table",
  range: "Summary!A1:O32",
  include: "values,formulas",
  tableMaxRows: 32,
  tableMaxCols: 15,
});

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});

await fs.mkdir(renderDir, { recursive: true });
await saveRender(summarySheet, "A1:O32", path.join(renderDir, "summary.png"));
await saveRender(cardsSheet, "A1:L18", path.join(renderDir, "cards-top.png"));
await saveRender(productsSheet, "A1:I18", path.join(renderDir, "products-top.png"));
await saveRender(previewsSheet, "A1:M18", path.join(renderDir, "previews-top.png"));

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(
  JSON.stringify(
    {
      workbook: outputPath,
      summaryInspect: summaryInspect.ndjson,
      formulaErrors: formulaErrors.ndjson,
    },
    null,
    2,
  ),
);

function buildSummarySheet(sheet) {
  applyColumnWidths(sheet, {
    A: 18,
    B: 42,
    C: 8,
    D: 18,
    E: 14,
    F: 8,
    G: 18,
    H: 16,
    I: 8,
    J: 14,
    K: 14,
    L: 14,
    M: 14,
    N: 14,
    O: 14,
  });
  sheet.getRange("A1:O1").merge();
  sheet.getRange("A2:O2").merge();
  sheet.getRange("A1").values = [["Gundam Card Game Database"]];
  sheet.getRange("A2").values = [[
    `Official English (US) snapshot from ${snapshot.snapshot_generated_utc} | ${formatNumber.format(snapshot.cards_count)} card printings | ${formatNumber.format(snapshot.unique_card_numbers)} unique card numbers`,
  ]];
  styleTitle(sheet.getRange("A1:O1"));
  styleSubtitle(sheet.getRange("A2:O2"));

  addKpiCard(sheet, "A4:C6", "Card Printings", snapshot.cards_count, "#,##0");
  addKpiCard(sheet, "D4:F6", "Unique Cards", snapshot.unique_card_numbers, "#,##0");
  addKpiCard(sheet, "G4:I6", "Products", snapshot.product_count, "#,##0");
  addKpiCard(sheet, "J4:L6", "Official FAQs", snapshot.faq_count, "#,##0");
  addKpiCard(sheet, "M4:O6", "Packages", snapshot.package_count, "#,##0");

  addSectionHeader(sheet, "A8:B8", "Snapshot Metadata");
  const metadataRows = [
    ["Source region", snapshot.source_region],
    ["Source root", snapshot.source_root],
    ["Snapshot UTC", snapshot.snapshot_generated_utc.replace("T", " ").replace("+00:00", " UTC")],
    ["Parallel printings", snapshot.cards_count - snapshot.unique_card_numbers],
    ["Unique products", snapshot.product_count],
    ["Card-bearing products", derivedData.cardBearingProducts.length],
    ["Official preview reveals", previews.length],
    ["Preview-only rows", previewStatusCounts.preview_only || 0],
    ["Preview rows matched to released cards", previewStatusCounts.released_match_found || 0],
    ["Source pages cached", snapshot.sources.length],
  ];
  writeSimpleTable(sheet, "A9", metadataRows);

  addSectionHeader(sheet, "D8:E8", "Cards by Package Kind");
  writeSimpleTable(
    sheet,
    "D9",
    Object.entries(packageKindCardCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => [label, value]),
  );

  addSectionHeader(sheet, "G8:H8", "Cards by Type");
  writeSimpleTable(
    sheet,
    "G9",
    Object.entries(cardTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => [label, value]),
  );

  addSectionHeader(sheet, "A20:E20", "Usage Notes");
  const notes = [
    ["Scope", "Official English (US) catalog snapshot only"],
    ["Granularity", "Each card printing/variant is a separate row on Cards"],
    ["Join key", "Use card_number for base card joins; detail_search_id for printing-level joins"],
    ["Products", "Products sheet tracks official catalog entries and prices shown on list pages"],
    ["Previews", "Previews sheet stores official pre-release reveals from product/news pages only"],
    ["FAQs", "FAQs sheet stores official card FAQ entries from card detail pages"],
  ];
  writeSimpleTable(sheet, "A21", notes);

  addSectionHeader(sheet, "G20:H20", "Top Packages");
  writeSimpleTable(sheet, "G21", topPackages.map((row) => [row.label, row.value]));

  sheet.freezePanes.freezeRows(2);

  const chart = sheet.charts.add("bar", {
    title: "Top 10 Packages by Card Printings",
    categories: topPackages.map((row) => row.label),
    series: [
      {
        name: "Card printings",
        values: topPackages.map((row) => row.value),
      },
    ],
    hasLegend: false,
    barOptions: {
      direction: "column",
      grouping: "clustered",
      gapWidth: 60,
    },
    from: { row: 7, col: 9 },
    extent: { widthPx: 620, heightPx: 340 },
  });
  chart.xAxis = { title: "Package" };
  chart.yAxis = { title: "Printings" };
}

function buildDataSheet(sheet, rows, columns) {
  const matrix = [columns, ...rows.map((row) => columns.map((column) => normalizeCellValue(row[column])))];
  const lastCell = toCell(columns.length - 1, matrix.length);
  sheet.getRange(`A1:${lastCell}`).values = matrix;

  const headerRange = sheet.getRange(`A1:${toCell(columns.length - 1, 1)}`);
  headerRange.format.fill = palette.navy;
  headerRange.format.font = { color: palette.white, bold: true };
  headerRange.format.borders = { preset: "outside", style: "thin", color: palette.line };

  const bodyRange = sheet.getRange(`A2:${lastCell}`);
  bodyRange.format.borders = { preset: "outside", style: "thin", color: palette.line };

  if (rows.length > 0) {
    try {
      sheet.tables.add(`A1:${lastCell}`, true);
    } catch {
      // Keep the workbook usable even if table creation fails on a future artifact-tool version.
    }
  }

  if (columns.includes("source_url")) {
    const urlColumn = columns.indexOf("source_url");
    const start = toColumn(urlColumn);
    sheet.getRange(`${start}2:${start}${matrix.length}`).format.font = { color: "#0B5CAD" };
  }

  if (columns.includes("detail_url")) {
    const urlColumn = columns.indexOf("detail_url");
    const start = toColumn(urlColumn);
    sheet.getRange(`${start}2:${start}${matrix.length}`).format.font = { color: "#0B5CAD" };
  }

  if (columns.includes("product_url")) {
    const urlColumn = columns.indexOf("product_url");
    const start = toColumn(urlColumn);
    sheet.getRange(`${start}2:${start}${matrix.length}`).format.font = { color: "#0B5CAD" };
  }

  applyDataSheetWidths(sheet, columns);
  sheet.freezePanes.freezeRows(1);
}

function addKpiCard(sheet, rangeAddress, label, value, numberFormat = "#,##0") {
  const [start, end] = rangeAddress.split(":");
  const labelRange = `${start}:${toColumn(columnIndex(end))}${rowIndex(start)}`;
  const valueRange = `${toColumn(columnIndex(start))}${rowIndex(start) + 1}:${end}`;
  sheet.getRange(labelRange).merge();
  sheet.getRange(valueRange).merge();
  sheet.getRange(start).values = [[label]];
  sheet.getRange(cellFromParts(columnIndex(start), rowIndex(start) + 1)).values = [[value]];
  const outer = sheet.getRange(rangeAddress);
  outer.format.borders = { preset: "outside", style: "thin", color: palette.line };
  sheet.getRange(labelRange).format.fill = palette.slate;
  sheet.getRange(labelRange).format.font = { color: palette.white, bold: true };
  sheet.getRange(labelRange).format.alignment = { horizontal: "center", vertical: "center" };
  sheet.getRange(valueRange).format.fill = palette.ice;
  sheet.getRange(valueRange).format.font = { color: palette.text, bold: true, size: 20 };
  sheet.getRange(valueRange).format.numberFormat = numberFormat;
  sheet.getRange(valueRange).format.alignment = { horizontal: "center", vertical: "center" };
}

function addSectionHeader(sheet, rangeAddress, title) {
  const [start] = rangeAddress.split(":");
  sheet.getRange(rangeAddress).merge();
  sheet.getRange(start).values = [[title]];
  const range = sheet.getRange(rangeAddress);
  range.format.fill = palette.gold;
  range.format.font = { color: palette.navy, bold: true };
  range.format.borders = { preset: "outside", style: "thin", color: palette.line };
  range.format.alignment = { horizontal: "center", vertical: "center" };
}

function writeSimpleTable(sheet, anchorCell, rows) {
  const startCol = columnIndex(anchorCell);
  const startRow = rowIndex(anchorCell);
  const matrix = rows.map(([label, value]) => [label, value]);
  const endCell = cellFromParts(startCol + 1, startRow + matrix.length - 1);
  sheet.getRange(`${anchorCell}:${endCell}`).values = matrix;
  sheet.getRange(`${anchorCell}:${endCell}`).format.borders = {
    preset: "outside",
    style: "thin",
    color: palette.line,
  };
  const labelCol = toColumn(startCol);
  const valueCol = toColumn(startCol + 1);
  sheet.getRange(`${labelCol}${startRow}:${labelCol}${startRow + matrix.length - 1}`).format.font = {
    bold: true,
    color: palette.text,
  };
  sheet.getRange(`${valueCol}${startRow}:${valueCol}${startRow + matrix.length - 1}`).format.fill =
    palette.ice;
}

function styleTitle(range) {
  range.format.fill = palette.navy;
  range.format.font = { color: palette.white, bold: true, size: 20 };
  range.format.alignment = { horizontal: "center", vertical: "center" };
}

function styleSubtitle(range) {
  range.format.fill = palette.mist;
  range.format.font = { color: palette.text };
  range.format.borders = { preset: "outside", style: "thin", color: palette.line };
  range.format.alignment = { horizontal: "center", vertical: "center" };
}

async function saveRender(sheet, range, targetPath) {
  const blob = await workbook.render({
    sheetName: sheet.name,
    range,
    scale: 2,
  });
  const buffer = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile(targetPath, buffer);
}

function normalizeCellValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return value;
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const label = row[key] || "(Blank)";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function deriveProductCardMappings(snapshotData) {
  const packageCodes = new Set(
    snapshotData.packages
      .map((row) => String(row.package_code || "").trim().toUpperCase())
      .filter(Boolean),
  );

  const productUrlCounts = new Map();
  for (const card of snapshotData.cards) {
    const productUrl = String(card.product_url || "").trim();
    if (!productUrl) {
      continue;
    }
    productUrlCounts.set(productUrl, (productUrlCounts.get(productUrl) || 0) + 1);
  }

  const previewUrlCounts = new Map();
  const previewCodeCounts = new Map();
  for (const preview of snapshotData.previews ?? []) {
    const productUrl = String(preview.product_url || "").trim();
    if (productUrl) {
      previewUrlCounts.set(productUrl, (previewUrlCounts.get(productUrl) || 0) + 1);
    }
    const productCode = String(preview.product_code || "").trim().toUpperCase();
    if (productCode) {
      previewCodeCounts.set(productCode, (previewCodeCounts.get(productCode) || 0) + 1);
    }
  }

  const productsEnriched = snapshotData.products.map((product) => {
    const productCode = String(product.product_code || "").trim().toUpperCase();
    const productUrl = String(product.product_url || "").trim();
    const linkedCardPrintings = productUrl ? productUrlCounts.get(productUrl) || 0 : 0;
    const linkedPreviewReveals = productUrl
      ? previewUrlCounts.get(productUrl) || 0
      : previewCodeCounts.get(productCode) || 0;
    const linkedPackagePresent = Boolean(productCode && packageCodes.has(productCode));
    const containsCardsOfficial =
      linkedCardPrintings > 0 || linkedPackagePresent || looksLikeCardBearingProduct(product);

    return {
      ...product,
      contains_cards_official: containsCardsOfficial ? "TRUE" : "FALSE",
      linked_card_printings: linkedCardPrintings,
      linked_preview_reveals: linkedPreviewReveals,
      linked_package_present: linkedPackagePresent ? "TRUE" : "FALSE",
    };
  });

  return {
    productsEnriched,
    cardBearingProducts: productsEnriched.filter(
      (product) => product.contains_cards_official === "TRUE",
    ),
  };
}

function looksLikeCardBearingProduct(product) {
  const productName = String(product.product_name || "").trim().toLowerCase();
  if (!productName) {
    return false;
  }

  const nonCardAccessoryTerms = [
    "sleeve",
    "sleeves",
    "card case",
    "deck case",
    "damage counter",
    "dice",
  ];
  if (nonCardAccessoryTerms.some((term) => productName.includes(term))) {
    return false;
  }

  const cardBearingTerms = [
    "card set",
    "card collection",
    "resource card",
    "deck build box",
  ];
  return cardBearingTerms.some((term) => productName.includes(term));
}

function applyColumnWidths(sheet, widths) {
  for (const [column, width] of Object.entries(widths)) {
    sheet.getRange(`${column}:${column}`).format.columnWidth = width;
  }
}

function applyDataSheetWidths(sheet, columns) {
  const widthByColumnName = {
    detail_search_id: 18,
    card_number: 12,
    variant_code: 10,
    is_parallel_variant: 12,
    card_name: 24,
    rarity: 10,
    block_icon: 10,
    level: 8,
    cost: 8,
    color: 10,
    type: 14,
    effect_text: 46,
    zone: 16,
    trait: 22,
    link: 20,
    ap: 8,
    hp: 8,
    source_title: 22,
    where_to_get_it: 30,
    package_id: 10,
    package_label: 26,
    package_code: 10,
    package_kind: 16,
    detail_url: 28,
    cards_search_url: 28,
    product_url: 28,
    image_url: 28,
    list_page: 9,
    category: 16,
    product_name: 36,
    product_code: 12,
    product_kind: 18,
    release_date: 16,
    msrp: 14,
    contains_cards_official: 12,
    linked_card_printings: 12,
    linked_preview_reveals: 12,
    linked_package_present: 12,
    preview_id: 18,
    classification: 22,
    preview_status: 16,
    confidence: 10,
    source_type: 18,
    source_title: 30,
    source_date: 16,
    section_heading: 24,
    card_number_hint: 16,
    card_name_hint: 24,
    product_release_date: 18,
    matched_released_card: 12,
    matched_released_printings: 12,
    context_text: 48,
    package_label: 26,
    cards_expected: 12,
    cards_found: 12,
    cards_search_url: 28,
    faq_number: 12,
    faq_updated_date: 16,
    question: 40,
    answer: 52,
    record_type: 18,
    record_id: 14,
    source_url: 32,
    cache_file: 36,
  };

  columns.forEach((column, index) => {
    const width = widthByColumnName[column] ?? 14;
    const columnLetter = toColumn(index);
    sheet.getRange(`${columnLetter}:${columnLetter}`).format.columnWidth = width;
  });
}

function toColumn(index) {
  let current = index + 1;
  let result = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function toCell(columnIndexZeroBased, rowNumber) {
  return `${toColumn(columnIndexZeroBased)}${rowNumber}`;
}

function columnIndex(cellAddress) {
  const match = cellAddress.match(/[A-Z]+/i);
  if (!match) {
    throw new Error(`Invalid cell address: ${cellAddress}`);
  }
  return match[0]
    .toUpperCase()
    .split("")
    .reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1;
}

function rowIndex(cellAddress) {
  const match = cellAddress.match(/\d+/);
  if (!match) {
    throw new Error(`Invalid cell address: ${cellAddress}`);
  }
  return Number(match[0]);
}

function cellFromParts(columnIndexZeroBased, rowNumber) {
  return `${toColumn(columnIndexZeroBased)}${rowNumber}`;
}
