import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const outputDir = path.join(rootDir, "outputs");
const renderDir = path.join(rootDir, ".scratch", "renders");
const thumbnailDir = path.join(rootDir, ".scratch", "card-thumbnails");
const cardImageDir = path.join(rootDir, "web", "assets", "card-images");
const reportPath = path.join(dataDir, "gundam_card_keep_report.json");
const outputPath =
  process.env.GUNDAM_KEEP_OUTPUT_PATH ?? path.join(outputDir, "gundam-card-keep-priority.xlsx");

const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
const workbook = Workbook.create();
const formatNumber = new Intl.NumberFormat("en-US");
const imageDataUrlCache = new Map();

const palette = {
  ink: "#17212B",
  slate: "#243447",
  blue: "#1C5D99",
  teal: "#0F766E",
  gold: "#D9A441",
  cream: "#FFF7E6",
  ice: "#EEF7FA",
  gray: "#E8EDF2",
  line: "#C9D3DF",
  white: "#FFFFFF",
  danger: "#B42318",
  success: "#137333",
};

const tierFill = {
  S: "#1F4E79",
  A: "#2F855A",
  B: "#D69E2E",
  C: "#7B8794",
  D: "#B7C0CA",
};

const colorFill = {
  Blue: "#DCEBFA",
  Green: "#E2F4E8",
  Purple: "#EEE7F8",
  Red: "#FCE4E1",
  White: "#F5F6F7",
  "EX BASE": "#FFF4CF",
  RESOURCE: "#E9F4F1",
  Colorless: "#ECEFF3",
  Unknown: "#ECEFF3",
};

const summarySheet = workbook.worksheets.add("Summary");
buildSummarySheet(summarySheet);

const topByColorSheet = workbook.worksheets.add("Top By Color");
await buildDataSheet(topByColorSheet, report.top_by_color ?? [], topByColorColumns(), {
  tableName: "TopByColor",
  freezeColumns: 8,
});

for (const color of ["Blue", "Green", "Purple", "Red", "White"]) {
  const rows = (report.all_cards ?? [])
    .filter((row) => row.color === color)
    .sort(sortRankingRows);
  const sheet = workbook.worksheets.add(color);
  await buildDataSheet(sheet, rows, colorSheetColumns(), {
    tableName: `${color}Keep`,
    freezeColumns: 6,
  });
}

const otherRows = (report.all_cards ?? [])
  .filter((row) => !["Blue", "Green", "Purple", "Red", "White"].includes(row.color))
  .sort(sortRankingRows);
const otherSheet = workbook.worksheets.add("Other Colors");
await buildDataSheet(otherSheet, otherRows, colorSheetColumns(), {
  tableName: "OtherColorsKeep",
  freezeColumns: 6,
});

const allRankingsSheet = workbook.worksheets.add("All Rankings");
await buildDataSheet(allRankingsSheet, report.all_cards ?? [], allRankingColumns(), {
  tableName: "AllCardRankings",
  freezeColumns: 7,
});

const lowSignalSheet = workbook.worksheets.add("Low Signal");
await buildDataSheet(lowSignalSheet, report.low_signal_main_deck ?? [], lowSignalColumns(), {
  tableName: "LowSignalMainDeck",
  freezeColumns: 4,
});

const scoringSheet = workbook.worksheets.add("Scoring Model");
buildScoringSheet(scoringSheet);

const summaryInspect = await workbook.inspect({
  kind: "table",
  range: "Summary!A1:O34",
  include: "values,formulas",
  tableMaxRows: 34,
  tableMaxCols: 15,
});
const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});

await fs.mkdir(renderDir, { recursive: true });
await saveRender(summarySheet, "A1:O34", path.join(renderDir, "card-keep-summary.png"));
await saveRender(topByColorSheet, "A1:T22", path.join(renderDir, "card-keep-top-by-color.png"));
await saveRender(workbook.worksheets.getItem("Blue"), "A1:T22", path.join(renderDir, "card-keep-blue.png"));
await saveRender(scoringSheet, "A1:J28", path.join(renderDir, "card-keep-scoring.png"));

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(
  JSON.stringify(
    {
      workbook: outputPath,
      generated_at_utc: report.generated_at_utc,
      latest_event_date: report.latest_event_date,
      summaryInspect: summaryInspect.ndjson,
      formulaErrors: formulaErrors.ndjson,
    },
    null,
    2,
  ),
);

function buildSummarySheet(sheet) {
  sheet.showGridLines = false;
  applyColumnWidths(sheet, {
    A: 16,
    B: 22,
    C: 16,
    D: 16,
    E: 16,
    F: 14,
    G: 16,
    H: 16,
    I: 16,
    J: 16,
    K: 18,
    L: 18,
    M: 18,
    N: 18,
    O: 18,
  });

  sheet.getRange("A1:O1").merge();
  sheet.getRange("A1").values = [["Gundam Card Keep Priority"]];
  styleTitle(sheet.getRange("A1:O1"));

  sheet.getRange("A2:O2").merge();
  sheet.getRange("A2").values = [[
    `Official card database + imported meta/events | Generated ${formatUtc(report.generated_at_utc)} | Latest event ${report.latest_event_date || "n/a"}`,
  ]];
  styleSubtitle(sheet.getRange("A2:O2"));

  const counts = report.counts ?? {};
  addKpiCard(sheet, "A4:C6", "Official Cards", counts.official_unique_cards ?? 0);
  addKpiCard(sheet, "D4:F6", "Events", counts.events ?? 0);
  addKpiCard(sheet, "G4:I6", "Deck Results", counts.results ?? 0);
  addKpiCard(sheet, "J4:L6", "Cards With Meta Use", counts.cards_with_meta_usage ?? 0);
  addKpiCard(sheet, "M4:O6", "Winner Decks", counts.winner_decks ?? 0);

  addSectionHeader(sheet, "A8:G8", "Color Summary");
  const colorColumns = [
    "color",
    "official_cards",
    "meta_played_cards",
    "s_tier",
    "a_tier",
    "b_tier",
    "top_card",
  ];
  const colorRows = (report.color_summary ?? []).map((row) => colorColumns.map((column) => normalizeCellValue(row[column])));
  writeMatrix(sheet, "A9", [displayHeaders(colorColumns), ...colorRows]);
  styleInlineTable(sheet, "A9", colorColumns.length, colorRows.length + 1);

  addSectionHeader(sheet, "I8:O8", "How To Use");
  const notes = [
    ["S", "Keep a playset first; these are meta staples or near-staples."],
    ["A", "Keep a playset if you play, lend, or brew this color."],
    ["B", "Keep 2-4 for specific shells and future pivots."],
    ["C", "Keep a small package if the archetype interests you."],
    ["D", "Low imported meta signal; keep for collection/art/casual reasons."],
  ];
  writeMatrix(sheet, "I9", [["Tier", "Default collection action"], ...notes]);
  styleInlineTable(sheet, "I9", 2, notes.length + 1);
  sheet.getRange("J9:J14").format.columnWidth = 58;

  addSectionHeader(sheet, "A19:O19", "Top Keep Targets By Color");
  const topRows = [];
  for (const colorSummary of report.color_summary ?? []) {
    const color = colorSummary.color;
    if (!["Blue", "Green", "Purple", "Red", "White"].includes(color)) {
      continue;
    }
    const topCards = (report.top_by_color ?? [])
      .filter((row) => row.color === color)
      .slice(0, 5)
      .map((row) => `${row.card_number} ${row.card_name} (${row.keep_tier})`);
    topRows.push([color, ...topCards]);
  }
  writeMatrix(sheet, "A20", [
    ["Color", "1", "2", "3", "4", "5"],
    ...topRows,
  ]);
  styleInlineTable(sheet, "A20", 6, topRows.length + 1);
  sheet.getRange("B20:F26").format.columnWidth = 34;
  sheet.getRange("B21:F26").format.wrapText = true;

  addSectionHeader(sheet, "I19:O19", "Tier Counts Chart Helper");
  const chartRows = (report.color_summary ?? [])
    .filter((row) => ["Blue", "Green", "Purple", "Red", "White"].includes(row.color))
    .map((row) => [row.color, row.s_tier, row.a_tier, row.b_tier, row.c_tier]);
  writeMatrix(sheet, "I20", [["Color", "S", "A", "B", "C"], ...chartRows]);
  styleInlineTable(sheet, "I20", 5, chartRows.length + 1);

  try {
    const chart = sheet.charts.add("bar", sheet.getRange(`I20:M${20 + chartRows.length}`));
    chart.title = "Keep Tiers By Color";
    chart.hasLegend = true;
    chart.setPosition("I28", "O43");
  } catch {
    // The helper range still carries the same chart-ready data if chart export is unavailable.
  }

  sheet.freezePanes.freezeRows(2);
}

function buildScoringSheet(sheet) {
  sheet.showGridLines = false;
  applyColumnWidths(sheet, {
    A: 20,
    B: 80,
    C: 22,
    D: 80,
    E: 18,
    F: 20,
    G: 20,
    H: 20,
    I: 20,
    J: 20,
  });

  sheet.getRange("A1:J1").merge();
  sheet.getRange("A1").values = [["Scoring Model And Assumptions"]];
  styleTitle(sheet.getRange("A1:J1"));

  sheet.getRange("A3:B3").values = [["Item", "Definition"]];
  styleInlineHeader(sheet.getRange("A3:B3"));
  const notes = (report.scoring_notes ?? []).map((note, index) => [`Note ${index + 1}`, note]);
  writeMatrix(sheet, "A4", notes);
  sheet.getRange(`A4:B${3 + notes.length}`).format.borders = { preset: "outside", style: "thin", color: palette.line };
  sheet.getRange(`B4:B${3 + notes.length}`).format.wrapText = true;

  sheet.getRange("D3:F3").values = [["Tier", "Meaning", "Default Action"]];
  styleInlineHeader(sheet.getRange("D3:F3"));
  const tierRows = (report.tier_definitions ?? []).map((row) => [
    row.tier,
    row.meaning,
    row.default_action,
  ]);
  writeMatrix(sheet, "D4", tierRows);
  styleTierRows(sheet, "D4", tierRows.length, 3);

  const sourceRows = Object.entries(report.source_files ?? {}).map(([name, sourcePath]) => [name, sourcePath]);
  sheet.getRange("A13:B13").values = [["Source File", "Path"]];
  styleInlineHeader(sheet.getRange("A13:B13"));
  writeMatrix(sheet, "A14", sourceRows);
  sheet.getRange(`A14:B${13 + sourceRows.length}`).format.borders = { preset: "outside", style: "thin", color: palette.line };
  sheet.getRange(`B14:B${13 + sourceRows.length}`).format.wrapText = true;

  const modelRows = [
    ["Winner decks", "Strongest signal; first-place cards push the score sharply upward."],
    ["Top 8 decks", "Rewards repeated competitive finishes without overfitting to one winner."],
    ["Deck adoption", "Cards appearing across many decklists rank higher than isolated tech."],
    ["Copy count", "Cards used as 3-4 copies beat one-of tech at similar placement levels."],
    ["Event size", "Larger events apply a modest score multiplier."],
    ["Recency", "Recent events receive more influence; older results are not discarded."],
    ["Archetype breadth", "Broadly adopted staples get a bump over narrow package cards."],
  ];
  sheet.getRange("D13:E13").values = [["Signal", "Interpretation"]];
  styleInlineHeader(sheet.getRange("D13:E13"));
  writeMatrix(sheet, "D14", modelRows);
  sheet.getRange(`D14:E${13 + modelRows.length}`).format.borders = { preset: "outside", style: "thin", color: palette.line };
  sheet.getRange(`E14:E${13 + modelRows.length}`).format.wrapText = true;

  sheet.freezePanes.freezeRows(3);
}

function topByColorColumns() {
  return [
    "color",
    "color_rank",
    "keep_tier",
    "keep_recommendation",
    "suggested_min_copies",
    "keep_score",
    "card_number",
    "card_image",
    "card_name",
    "tcgplayer_product_id",
    "market_price_usd",
    "market_price_brl_x5",
    "price_status",
    "price_last_checked_utc",
    "tcgplayer_url",
    "type",
    "rarity",
    "deck_count",
    "winner_decks",
    "top8_decks",
    "total_copies",
    "average_copies",
    "archetype_count",
    "top_archetypes",
    "restriction",
    "last_seen",
    "package_codes",
    "keep_reason",
  ];
}

function colorSheetColumns() {
  return [
    "keep_tier",
    "keep_recommendation",
    "suggested_min_copies",
    "keep_score",
    "card_number",
    "card_image",
    "card_name",
    "tcgplayer_product_id",
    "market_price_usd",
    "market_price_brl_x5",
    "price_status",
    "price_last_checked_utc",
    "tcgplayer_url",
    "type",
    "rarity",
    "deck_count",
    "winner_decks",
    "top4_decks",
    "top8_decks",
    "total_copies",
    "average_copies",
    "archetype_count",
    "top_archetypes",
    "top_color_pairs",
    "best_finish",
    "restriction",
    "restriction_effective_date",
    "last_seen",
    "package_codes",
    "source_title",
    "effect_text",
  ];
}

function allRankingColumns() {
  return [
    "color",
    "keep_tier",
    "keep_recommendation",
    "suggested_min_copies",
    "keep_score",
    "card_number",
    "card_image",
    "card_name",
    "tcgplayer_product_id",
    "market_price_usd",
    "market_price_brl_x5",
    "price_status",
    "price_last_checked_utc",
    "tcgplayer_url",
    "type",
    "rarity",
    "level",
    "cost",
    "ap",
    "hp",
    "trait",
    "deck_count",
    "winner_decks",
    "top4_decks",
    "top8_decks",
    "event_count",
    "total_copies",
    "average_copies",
    "archetype_count",
    "top_archetypes",
    "top_color_pairs",
    "top_sources",
    "best_finish",
    "restriction",
    "restriction_effective_date",
    "last_seen",
    "package_codes",
    "printing_count",
    "is_parallel_available",
    "effect_text",
  ];
}

function lowSignalColumns() {
  return [
    "color",
    "card_number",
    "card_image",
    "card_name",
    "tcgplayer_product_id",
    "market_price_usd",
    "market_price_brl_x5",
    "price_status",
    "tcgplayer_url",
    "type",
    "rarity",
    "package_codes",
    "source_title",
    "keep_recommendation",
    "suggested_min_copies",
    "effect_text",
  ];
}

async function buildDataSheet(sheet, rows, columns, options = {}) {
  sheet.showGridLines = false;
  const matrix = [displayHeaders(columns), ...rows.map((row) => columns.map((column) => normalizeCellValue(row[column], column)))];
  const lastCell = toCell(columns.length - 1, matrix.length);
  sheet.getRange(`A1:${lastCell}`).values = matrix;

  styleInlineHeader(sheet.getRange(`A1:${toCell(columns.length - 1, 1)}`));
  if (rows.length > 0) {
    const bodyRange = sheet.getRange(`A2:${lastCell}`);
    bodyRange.format.borders = { preset: "outside", style: "thin", color: palette.line };
    bodyRange.format.wrapText = true;
    applyTierFormatting(sheet, columns, rows.length);
    applyScoreFormatting(sheet, columns, rows.length);
    applyPriceFormatting(sheet, columns, rows.length);
    applyDateFormatting(sheet, columns, rows.length);
    applyLinkFormatting(sheet, columns, rows.length);
    applyPriceStatusFormatting(sheet, columns, rows.length);
    applyColorFormatting(sheet, columns, rows.length);
    try {
      sheet.tables.add(`A1:${lastCell}`, true, options.tableName);
    } catch {
      // Filters are nice-to-have; keep the report usable if table creation fails.
    }
  }

  applyDataWidths(sheet, columns);
  if (columns.includes("card_image")) {
    await addCardImages(sheet, rows, columns);
  }
  sheet.freezePanes.freezeRows(1);
  if (options.freezeColumns) {
    sheet.freezePanes.freezeColumns(options.freezeColumns);
  }
}

async function addCardImages(sheet, rows, columns) {
  const imageColumnIndex = columns.indexOf("card_image");
  if (imageColumnIndex < 0 || rows.length === 0) {
    return;
  }

  const rowHeightRange = sheet.getRange(`A2:A${rows.length + 1}`);
  rowHeightRange.format.rowHeightPx = 158;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const cardNumber = String(row.card_number ?? "").trim();
    if (!cardNumber) {
      continue;
    }
    const image = await readCardImageDataUrl(cardNumber);
    if (!image) {
      continue;
    }

    sheet.images.add({
      dataUrl: image.dataUrl,
      anchor: {
        from: {
          row: index + 1,
          col: imageColumnIndex,
          rowOffsetPx: 4,
          colOffsetPx: 10,
        },
        extent: {
          widthPx: 108,
          heightPx: 150,
        },
      },
    });
  }
}

function writeMatrix(sheet, anchorCell, matrix) {
  if (!matrix.length) {
    return;
  }
  const startCol = columnIndex(anchorCell);
  const startRow = rowIndex(anchorCell);
  const width = Math.max(...matrix.map((row) => row.length));
  const height = matrix.length;
  const normalized = matrix.map((row) => {
    const next = [...row];
    while (next.length < width) {
      next.push("");
    }
    return next;
  });
  const endCell = cellFromParts(startCol + width - 1, startRow + height - 1);
  sheet.getRange(`${anchorCell}:${endCell}`).values = normalized;
}

function styleInlineTable(sheet, anchorCell, columnCount, rowCount) {
  const startCol = columnIndex(anchorCell);
  const startRow = rowIndex(anchorCell);
  const endCell = cellFromParts(startCol + columnCount - 1, startRow + rowCount - 1);
  styleInlineHeader(sheet.getRange(`${anchorCell}:${cellFromParts(startCol + columnCount - 1, startRow)}`));
  if (rowCount > 1) {
    const bodyRange = sheet.getRange(`${cellFromParts(startCol, startRow + 1)}:${endCell}`);
    bodyRange.format.borders = { preset: "outside", style: "thin", color: palette.line };
    bodyRange.format.wrapText = true;
  }
}

function styleTierRows(sheet, anchorCell, rowCount, columnCount) {
  const startCol = columnIndex(anchorCell);
  const startRow = rowIndex(anchorCell);
  const endCell = cellFromParts(startCol + columnCount - 1, startRow + rowCount - 1);
  sheet.getRange(`${anchorCell}:${endCell}`).format.borders = { preset: "outside", style: "thin", color: palette.line };
  for (let index = 0; index < rowCount; index += 1) {
    const tierCell = cellFromParts(startCol, startRow + index);
    const tier = sheet.getRange(tierCell).values?.[0]?.[0];
    const range = sheet.getRange(`${tierCell}:${cellFromParts(startCol, startRow + index)}`);
    range.format.fill = tierFill[tier] ?? palette.gray;
    range.format.font = { color: tier === "D" ? palette.ink : palette.white, bold: true };
  }
  sheet.getRange(`${cellFromParts(startCol + 2, startRow)}:${cellFromParts(startCol + 2, startRow + rowCount - 1)}`).format.wrapText = true;
}

function applyTierFormatting(sheet, columns, rowCount) {
  const tierIndex = columns.indexOf("keep_tier");
  if (tierIndex < 0) {
    return;
  }
  const tierColumn = toColumn(tierIndex);
  for (let row = 2; row <= rowCount + 1; row += 1) {
    const cell = sheet.getRange(`${tierColumn}${row}`);
    const tier = cell.values?.[0]?.[0];
    cell.format.fill = tierFill[tier] ?? palette.gray;
    cell.format.font = { color: tier === "D" ? palette.ink : palette.white, bold: true };
    cell.format.alignment = { horizontal: "center", vertical: "center" };
  }
}

function applyScoreFormatting(sheet, columns, rowCount) {
  const scoreIndex = columns.indexOf("keep_score");
  if (scoreIndex < 0 || rowCount <= 0) {
    return;
  }
  const scoreColumn = toColumn(scoreIndex);
  const range = sheet.getRange(`${scoreColumn}2:${scoreColumn}${rowCount + 1}`);
  range.format.numberFormat = "0.0";
  try {
    range.conditionalFormats.addColorScale({
      minColor: "#F1F5F9",
      midColor: "#FCD34D",
      maxColor: "#166534",
    });
  } catch {
    // Keep numeric scores visible if conditional formatting is unavailable.
  }
}

function applyPriceFormatting(sheet, columns, rowCount) {
  for (const column of ["market_price_usd", "market_price_brl_x5"]) {
    const index = columns.indexOf(column);
    if (index < 0 || rowCount <= 0) {
      continue;
    }
    const letter = toColumn(index);
    const range = sheet.getRange(`${letter}2:${letter}${rowCount + 1}`);
    range.format.numberFormat = column === "market_price_usd" ? "$0.00" : '"R$" 0.00';
  }
}

function applyDateFormatting(sheet, columns, rowCount) {
  const index = columns.indexOf("price_last_checked_utc");
  if (index < 0 || rowCount <= 0) {
    return;
  }
  const letter = toColumn(index);
  sheet.getRange(`${letter}2:${letter}${rowCount + 1}`).format.numberFormat = "yyyy-mm-dd hh:mm";
}

function applyLinkFormatting(sheet, columns, rowCount) {
  for (const column of ["tcgplayer_url"]) {
    const index = columns.indexOf(column);
    if (index < 0 || rowCount <= 0) {
      continue;
    }
    const letter = toColumn(index);
    sheet.getRange(`${letter}2:${letter}${rowCount + 1}`).format.font = {
      color: "#0B5CAD",
      underline: "single",
    };
  }
}

function applyPriceStatusFormatting(sheet, columns, rowCount) {
  const index = columns.indexOf("price_status");
  if (index < 0 || rowCount <= 0) {
    return;
  }
  const letter = toColumn(index);
  for (let row = 2; row <= rowCount + 1; row += 1) {
    const cell = sheet.getRange(`${letter}${row}`);
    const status = String(cell.values?.[0]?.[0] ?? "");
    if (status === "ok") {
      cell.format.fill = "#DCFCE7";
      cell.format.font = { color: palette.success, bold: true };
    } else if (status.includes("missing_credentials") || status === "needs_mapping") {
      cell.format.fill = "#FEF3C7";
      cell.format.font = { color: "#92400E", bold: true };
    } else if (status) {
      cell.format.fill = "#FEE2E2";
      cell.format.font = { color: palette.danger, bold: true };
    }
  }
}

function applyColorFormatting(sheet, columns, rowCount) {
  const colorIndex = columns.indexOf("color");
  if (colorIndex < 0) {
    return;
  }
  const colorColumn = toColumn(colorIndex);
  for (let row = 2; row <= rowCount + 1; row += 1) {
    const cell = sheet.getRange(`${colorColumn}${row}`);
    const color = cell.values?.[0]?.[0];
    cell.format.fill = colorFill[color] ?? palette.gray;
    cell.format.font = { color: palette.ink, bold: true };
  }
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
  sheet.getRange(labelRange).format.fill = palette.blue;
  sheet.getRange(labelRange).format.font = { color: palette.white, bold: true };
  sheet.getRange(labelRange).format.alignment = { horizontal: "center", vertical: "center" };
  sheet.getRange(valueRange).format.fill = palette.ice;
  sheet.getRange(valueRange).format.font = { color: palette.ink, bold: true, size: 20 };
  sheet.getRange(valueRange).format.numberFormat = numberFormat;
  sheet.getRange(valueRange).format.alignment = { horizontal: "center", vertical: "center" };
}

function addSectionHeader(sheet, rangeAddress, title) {
  const [start] = rangeAddress.split(":");
  sheet.getRange(rangeAddress).merge();
  sheet.getRange(start).values = [[title]];
  const range = sheet.getRange(rangeAddress);
  range.format.fill = palette.gold;
  range.format.font = { color: palette.ink, bold: true };
  range.format.borders = { preset: "outside", style: "thin", color: palette.line };
  range.format.alignment = { horizontal: "center", vertical: "center" };
}

function styleTitle(range) {
  range.format.fill = palette.ink;
  range.format.font = { color: palette.white, bold: true, size: 20 };
  range.format.alignment = { horizontal: "center", vertical: "center" };
}

function styleSubtitle(range) {
  range.format.fill = palette.cream;
  range.format.font = { color: palette.ink };
  range.format.borders = { preset: "outside", style: "thin", color: palette.line };
  range.format.alignment = { horizontal: "center", vertical: "center" };
}

function styleInlineHeader(range) {
  range.format.fill = palette.slate;
  range.format.font = { color: palette.white, bold: true };
  range.format.borders = { preset: "outside", style: "thin", color: palette.line };
  range.format.alignment = { horizontal: "center", vertical: "center" };
  range.format.wrapText = true;
}

function applyDataWidths(sheet, columns) {
  const widths = {
    color: 13,
    color_rank: 10,
    keep_tier: 10,
    keep_recommendation: 24,
    suggested_min_copies: 12,
    keep_score: 12,
    card_number: 14,
    card_image: 20,
    card_name: 28,
    tcgplayer_product_id: 16,
    market_price_usd: 14,
    market_price_brl_x5: 14,
    price_status: 22,
    price_last_checked_utc: 22,
    tcgplayer_url: 36,
    type: 14,
    rarity: 12,
    level: 10,
    cost: 10,
    ap: 10,
    hp: 10,
    trait: 28,
    deck_count: 12,
    winner_decks: 13,
    top4_decks: 12,
    top8_decks: 12,
    event_count: 12,
    total_copies: 13,
    average_copies: 12,
    archetype_count: 14,
    top_archetypes: 46,
    top_color_pairs: 36,
    top_sources: 30,
    best_finish: 12,
    last_seen: 14,
    restriction: 18,
    restriction_effective_date: 14,
    package_codes: 18,
    package_labels: 30,
    source_title: 28,
    printing_count: 12,
    is_parallel_available: 12,
    keep_reason: 54,
    effect_text: 72,
  };
  columns.forEach((column, index) => {
    const letter = toColumn(index);
    sheet.getRange(`${letter}:${letter}`).format.columnWidth = widths[column] ?? 16;
  });
}

function applyColumnWidths(sheet, widths) {
  for (const [column, width] of Object.entries(widths)) {
    sheet.getRange(`${column}:${column}`).format.columnWidth = width;
  }
}

async function saveRender(sheet, range, targetPath) {
  const blob = await workbook.render({
    sheetName: sheet.name,
    range,
    scale: 1,
  });
  const buffer = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile(targetPath, buffer);
}

async function readCardImageDataUrl(cardNumber) {
  if (imageDataUrlCache.has(cardNumber)) {
    return imageDataUrlCache.get(cardNumber);
  }

  const candidates = [
    { filePath: path.join(thumbnailDir, `${cardNumber}.jpg`), mime: "image/jpeg" },
    { filePath: path.join(cardImageDir, `${cardNumber}.webp`), mime: "image/webp" },
    { filePath: path.join(cardImageDir, `${cardNumber}.png`), mime: "image/png" },
    { filePath: path.join(cardImageDir, `${cardNumber}.jpg`), mime: "image/jpeg" },
    { filePath: path.join(cardImageDir, `${cardNumber}.jpeg`), mime: "image/jpeg" },
  ];

  for (const candidate of candidates) {
    try {
      const bytes = await fs.readFile(candidate.filePath);
      const result = {
        dataUrl: `data:${candidate.mime};base64,${bytes.toString("base64")}`,
        filePath: candidate.filePath,
      };
      imageDataUrlCache.set(cardNumber, result);
      return result;
    } catch {
      // Try the next supported image extension.
    }
  }

  imageDataUrlCache.set(cardNumber, null);
  return null;
}

function displayHeaders(columns) {
  const overrides = {
    tcgplayer_product_id: "TCGplayer Product ID",
    tcgplayer_url: "TCGplayer URL",
    market_price_usd: "Market Price USD",
    market_price_brl_x5: "Market Price BRL x5",
    price_last_checked_utc: "Price Last Checked UTC",
  };
  return columns.map((column) =>
    overrides[column] ??
    column
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  );
}

function normalizeCellValue(value, column = "") {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (["market_price_usd", "market_price_brl_x5"].includes(column)) {
    if (value === "") {
      return "";
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : "";
  }
  if (column === "tcgplayer_product_id") {
    return String(value);
  }
  return value;
}

function sortRankingRows(a, b) {
  const tierRank = { S: 0, A: 1, B: 2, C: 3, D: 4 };
  const tierDelta = (tierRank[a.keep_tier] ?? 9) - (tierRank[b.keep_tier] ?? 9);
  if (tierDelta !== 0) {
    return tierDelta;
  }
  return Number(b.keep_score ?? 0) - Number(a.keep_score ?? 0);
}

function formatUtc(value) {
  if (!value) {
    return "n/a";
  }
  return String(value).replace("T", " ").replace("+00:00", " UTC").replace("Z", " UTC");
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
    .reduce((sum, character) => sum * 26 + character.charCodeAt(0) - 64, 0) - 1;
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
