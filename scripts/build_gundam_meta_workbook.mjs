import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const outputDir = path.join(rootDir, "outputs");
const renderDir = path.join(rootDir, ".scratch", "renders");
const outputPath = path.join(outputDir, "gundam-meta-decks.xlsx");

const snapshot = JSON.parse(
  await fs.readFile(path.join(dataDir, "gundam_meta_snapshot.json"), "utf8"),
);
const results = snapshot.results ?? [];
const deckCards = snapshot.deck_cards ?? [];
const events = snapshot.events ?? [];
const sourceCoverage = snapshot.source_coverage ?? [];
const formatNumber = new Intl.NumberFormat("en-US");

const workbook = Workbook.create();

const palette = {
  navy: "#10243E",
  blue: "#1F5A96",
  sky: "#DCEAF7",
  ice: "#F3F8FC",
  gold: "#D5A021",
  line: "#C7D5E1",
  text: "#1B2A36",
  white: "#FFFFFF",
};

const winners = results.filter((row) => Number(row.placing_rank || 0) === 1);
const top8Results = results.filter((row) => {
  const rank = Number(row.placing_rank || 0);
  return Number.isFinite(rank) && rank > 0 && rank <= 8;
});
const archetypeStats = buildArchetypeStats(results);
const winningCardStats = buildWinningCardStats(deckCards, winners);
const winnerArchetypeChart = archetypeStats.slice(0, 10).map((row) => ({
  label: row.archetype,
  wins: row.first_place_decks,
  top8: row.top8_decks,
}));
const winningColors = summarizeCounts(
  winners
    .map((row) => String(row.color_combination || "").trim() || "(Unknown)")
    .filter(Boolean),
).slice(0, 8);

const summarySheet = workbook.worksheets.add("Summary");
buildSummarySheet(summarySheet);

const sourceCoverageSheet = workbook.worksheets.add("Source Coverage");
buildDataSheet(sourceCoverageSheet, sourceCoverage, [
  "source_name",
  "status",
  "coverage_level",
  "notes",
  "source_url",
]);

const eventsSheet = workbook.worksheets.add("Events");
buildDataSheet(eventsSheet, events, [
  "event_id",
  "source_name",
  "event_name",
  "event_date",
  "format_name",
  "event_type",
  "player_count",
  "organizer",
  "source_url",
  "source_page_title",
  "event_instance",
]);

const resultsSheet = workbook.worksheets.add("Results");
buildDataSheet(resultsSheet, results, [
  "result_id",
  "deck_id",
  "event_id",
  "source_name",
  "event_name",
  "event_date",
  "format_name",
  "event_type",
  "player_count",
  "player_name",
  "placing_label",
  "placing_rank",
  "archetype",
  "color_combination",
  "leader_name",
  "deck_url",
  "source_url",
  "has_decklist",
]);

const archetypeSheet = workbook.worksheets.add("Archetype Stats");
buildDataSheet(archetypeSheet, archetypeStats, [
  "archetype",
  "results_count",
  "first_place_decks",
  "top8_decks",
  "unique_events",
  "unique_players",
  "best_finish",
  "sources",
  "known_color_combinations",
]);

const winningCardsSheet = workbook.worksheets.add("Winning Cards");
buildDataSheet(winningCardsSheet, winningCardStats, [
  "card_number",
  "card_name",
  "card_type",
  "card_color",
  "winner_decks_using",
  "total_copies_in_winner_decks",
  "avg_copies_when_used",
]);

const deckCardsSheet = workbook.worksheets.add("Deck Cards");
buildDataSheet(deckCardsSheet, deckCards, [
  "deck_card_id",
  "deck_id",
  "event_id",
  "source_name",
  "event_name",
  "event_date",
  "player_name",
  "placing_label",
  "placing_rank",
  "archetype",
  "color_combination",
  "card_number",
  "card_name",
  "quantity",
  "card_type",
  "card_color",
  "package_code",
  "package_label",
]);

const sourcesSheet = workbook.worksheets.add("Sources");
buildDataSheet(sourcesSheet, snapshot.sources ?? [], [
  "record_type",
  "record_id",
  "source_url",
  "cache_file",
]);

const summaryInspect = await workbook.inspect({
  kind: "table",
  range: "Summary!A1:O30",
  include: "values,formulas",
  tableMaxRows: 30,
  tableMaxCols: 15,
});

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});

await fs.mkdir(renderDir, { recursive: true });
await saveRender(summarySheet, "A1:O30", path.join(renderDir, "meta-summary.png"));
await saveRender(sourceCoverageSheet, "A1:E12", path.join(renderDir, "meta-source-coverage-top.png"));
await saveRender(eventsSheet, "A1:K14", path.join(renderDir, "meta-events-top.png"));
await saveRender(resultsSheet, "A1:R14", path.join(renderDir, "meta-results-top.png"));
await saveRender(archetypeSheet, "A1:I16", path.join(renderDir, "meta-archetypes-top.png"));
await saveRender(winningCardsSheet, "A1:G16", path.join(renderDir, "meta-winning-cards-top.png"));
await saveRender(deckCardsSheet, "A1:R14", path.join(renderDir, "meta-deck-cards-top.png"));
await saveRender(sourcesSheet, "A1:D14", path.join(renderDir, "meta-sources-top.png"));

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
    B: 40,
    C: 8,
    D: 18,
    E: 14,
    F: 8,
    G: 18,
    H: 14,
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
  sheet.getRange("A1").values = [["Gundam Competitive Meta Workbook"]];
  sheet.getRange("A2").values = [[
    `Public source snapshot from ${snapshot.snapshot_generated_utc} | ${formatNumber.format(events.length)} events | ${formatNumber.format(results.length)} top-result rows | ${formatNumber.format(winners.length)} winners`,
  ]];
  styleTitle(sheet.getRange("A1:O1"));
  styleSubtitle(sheet.getRange("A2:O2"));

  addKpiCard(sheet, "A4:C6", "Events", events.length);
  addKpiCard(sheet, "D4:F6", "Top Results", results.length);
  addKpiCard(sheet, "G4:I6", "Winner Decks", winners.length);
  addKpiCard(sheet, "J4:L6", "Top 8 Rows", top8Results.length);
  addKpiCard(sheet, "M4:O6", "Archetypes", archetypeStats.length);

  addSectionHeader(sheet, "A8:B8", "Snapshot Metadata");
  const metadataRows = [
    ["Snapshot UTC", snapshot.snapshot_generated_utc],
    ["Active sources", sourceCoverage.filter((row) => row.status === "active").length],
    ["Tracked sources", sourceCoverage.length],
    ["Events with deck cards", new Set(deckCards.map((row) => row.event_id)).size],
    ["Deck-card rows", deckCards.length],
    ["Winner card rows", winningCardStats.length],
    ["Date range", summarizeDateRange(events.map((row) => row.event_date).filter(Boolean))],
  ];
  writeSimpleTable(sheet, "A9", metadataRows);

  addSectionHeader(sheet, "D8:E8", "Winner Colors");
  writeSimpleTable(
    sheet,
    "D9",
    winningColors.map((row) => [row.label, row.value]),
  );

  addSectionHeader(sheet, "G8:H8", "Top Winner Archetypes");
  writeSimpleTable(
    sheet,
    "G9",
    winnerArchetypeChart.map((row) => [row.label, row.wins]),
  );

  addSectionHeader(sheet, "A19:E19", "Usage Notes");
  const notes = [
    ["Purpose", "Separate competitive workbook for public event-result and decklist meta analysis"],
    ["Primary data", "Egman Events topping decklists plus recent public Limitless Gundam tournaments"],
    ["Winning stats", "Winning Cards aggregates only 1st-place decks from the current dataset"],
    ["Top-finish stats", "Archetype Stats counts all imported result rows, including non-winner top finishes"],
    ["Coverage", "Source Coverage flags which sites are active, metadata-only, or currently inactive"],
  ];
  writeSimpleTable(sheet, "A20", notes);

  addSectionHeader(sheet, "G19:H19", "Top Winning Cards");
  writeSimpleTable(
    sheet,
    "G20",
    winningCardStats.slice(0, 8).map((row) => [
      row.card_name || row.card_number,
      row.winner_decks_using,
    ]),
  );

  sheet.freezePanes.freezeRows(2);

  const winChart = sheet.charts.add("bar", {
    title: "Top Archetypes by Event Wins",
    categories: winnerArchetypeChart.map((row) => row.label),
    series: [
      {
        name: "Wins",
        values: winnerArchetypeChart.map((row) => row.wins),
      },
    ],
    hasLegend: false,
    barOptions: {
      direction: "column",
      grouping: "clustered",
      gapWidth: 60,
    },
    from: { row: 7, col: 9 },
    extent: { widthPx: 620, heightPx: 310 },
  });
  winChart.xAxis = { title: "Archetype" };
  winChart.yAxis = { title: "Wins" };
}

function buildArchetypeStats(rows) {
  const groups = new Map();
  for (const row of rows) {
    const archetype = normalizeArchetype(row.archetype);
    if (!groups.has(archetype)) {
      groups.set(archetype, {
        archetype,
        results_count: 0,
        first_place_decks: 0,
        top8_decks: 0,
        unique_events: new Set(),
        unique_players: new Set(),
        best_finish: null,
        sources: new Set(),
        known_color_combinations: new Set(),
      });
    }
    const entry = groups.get(archetype);
    const placingRank = Number(row.placing_rank || 0);
    entry.results_count += 1;
    if (placingRank === 1) {
      entry.first_place_decks += 1;
    }
    if (placingRank > 0 && placingRank <= 8) {
      entry.top8_decks += 1;
    }
    if (row.event_id) {
      entry.unique_events.add(row.event_id);
    }
    if (row.player_name) {
      entry.unique_players.add(row.player_name);
    }
    if (placingRank > 0) {
      entry.best_finish = entry.best_finish === null ? placingRank : Math.min(entry.best_finish, placingRank);
    }
    if (row.source_name) {
      entry.sources.add(row.source_name);
    }
    const color = String(row.color_combination || "").trim();
    if (color) {
      entry.known_color_combinations.add(color);
    }
  }

  return [...groups.values()]
    .map((row) => ({
      archetype: row.archetype,
      results_count: row.results_count,
      first_place_decks: row.first_place_decks,
      top8_decks: row.top8_decks,
      unique_events: row.unique_events.size,
      unique_players: row.unique_players.size,
      best_finish: row.best_finish ?? "",
      sources: [...row.sources].sort().join(", "),
      known_color_combinations: [...row.known_color_combinations].sort().join(", "),
    }))
    .sort((a, b) => {
      return (
        b.first_place_decks - a.first_place_decks ||
        b.top8_decks - a.top8_decks ||
        b.results_count - a.results_count ||
        a.archetype.localeCompare(b.archetype)
      );
    });
}

function buildWinningCardStats(deckRows, winnerRows) {
  const winnerDeckIds = new Set(winnerRows.map((row) => row.deck_id));
  const groups = new Map();

  for (const row of deckRows) {
    if (!winnerDeckIds.has(row.deck_id)) {
      continue;
    }
    const cardNumber = String(row.card_number || "").trim().toUpperCase();
    if (!cardNumber) {
      continue;
    }
    if (!groups.has(cardNumber)) {
      groups.set(cardNumber, {
        card_number: cardNumber,
        card_name: String(row.card_name || "").trim(),
        card_type: String(row.card_type || "").trim(),
        card_color: String(row.card_color || "").trim(),
        winnerDecks: new Set(),
        totalCopies: 0,
      });
    }
    const entry = groups.get(cardNumber);
    entry.winnerDecks.add(row.deck_id);
    entry.totalCopies += Number(row.quantity || 0);
    if (!entry.card_name && row.card_name) {
      entry.card_name = row.card_name;
    }
    if (!entry.card_type && row.card_type) {
      entry.card_type = row.card_type;
    }
    if (!entry.card_color && row.card_color) {
      entry.card_color = row.card_color;
    }
  }

  return [...groups.values()]
    .map((row) => ({
      card_number: row.card_number,
      card_name: row.card_name,
      card_type: row.card_type,
      card_color: row.card_color,
      winner_decks_using: row.winnerDecks.size,
      total_copies_in_winner_decks: row.totalCopies,
      avg_copies_when_used:
        row.winnerDecks.size > 0 ? Number((row.totalCopies / row.winnerDecks.size).toFixed(2)) : 0,
    }))
    .sort((a, b) => {
      return (
        b.winner_decks_using - a.winner_decks_using ||
        b.total_copies_in_winner_decks - a.total_copies_in_winner_decks ||
        a.card_number.localeCompare(b.card_number)
      );
    });
}

function summarizeCounts(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function summarizeDateRange(values) {
  if (!values.length) {
    return "";
  }
  const sorted = [...values].sort();
  return `${sorted[0]} to ${sorted[sorted.length - 1]}`;
}

function normalizeArchetype(value) {
  const cleaned = String(value || "").trim();
  return cleaned || "(Unclassified)";
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
      // Keep the workbook usable even if table creation fails.
    }
  }

  for (const urlColumnName of ["source_url", "deck_url"]) {
    if (!columns.includes(urlColumnName)) {
      continue;
    }
    const columnIndexZeroBased = columns.indexOf(urlColumnName);
    const columnLetter = toColumn(columnIndexZeroBased);
    sheet.getRange(`${columnLetter}2:${columnLetter}${matrix.length}`).format.font = {
      color: "#0B5CAD",
    };
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
  sheet.getRange(labelRange).format.fill = palette.blue;
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
  if (rows.length === 0) {
    return;
  }
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
  range.format.fill = palette.sky;
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

function applyColumnWidths(sheet, widths) {
  for (const [column, width] of Object.entries(widths)) {
    sheet.getRange(`${column}:${column}`).format.columnWidth = width;
  }
}

function applyDataSheetWidths(sheet, columns) {
  const widthByColumnName = {
    event_id: 18,
    source_name: 14,
    event_name: 34,
    event_date: 14,
    format_name: 14,
    event_type: 16,
    player_count: 12,
    organizer: 20,
    source_url: 32,
    source_page_title: 28,
    event_instance: 10,
    result_id: 18,
    deck_id: 18,
    player_name: 20,
    placing_label: 12,
    placing_rank: 10,
    archetype: 24,
    color_combination: 16,
    leader_name: 18,
    deck_url: 32,
    has_decklist: 12,
    results_count: 12,
    first_place_decks: 12,
    top8_decks: 10,
    unique_events: 12,
    unique_players: 12,
    best_finish: 10,
    sources: 18,
    known_color_combinations: 20,
    card_number: 14,
    card_name: 28,
    card_type: 16,
    card_color: 12,
    winner_decks_using: 12,
    total_copies_in_winner_decks: 14,
    avg_copies_when_used: 12,
    deck_card_id: 18,
    quantity: 10,
    package_code: 12,
    package_label: 24,
    status: 18,
    coverage_level: 24,
    notes: 52,
    record_type: 20,
    record_id: 18,
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
