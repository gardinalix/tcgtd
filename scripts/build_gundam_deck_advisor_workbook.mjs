import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const outputDir = path.join(rootDir, "outputs");
const renderDir = path.join(rootDir, ".scratch", "renders");
const snapshotPath = path.join(dataDir, "gundam_deck_advisor_snapshot.json");
const outputPath = path.join(outputDir, "gundam-deck-advisor.xlsx");

const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8"));
const workbook = Workbook.create();
const formatNumber = new Intl.NumberFormat("en-US");

const palette = {
  navy: "#0E223B",
  steel: "#2D4A63",
  ice: "#F2F6FA",
  line: "#C6D3DE",
  red: "#C5443D",
  gold: "#D0A236",
  white: "#FFFFFF",
  text: "#1A2A36",
  paleBlue: "#DCE9F4",
  paleYellow: "#FFF3CC",
  paleGreen: "#E5F3EA",
};

const archetypeRows = snapshot.archetype_advisor_rows ?? [];
const cardRows = snapshot.card_advisor_rows ?? [];
const templateRows = snapshot.archetype_template_rows ?? [];
const colorPairRows = snapshot.color_pair_rows ?? [];
const resourceRows = snapshot.resource_rows ?? [];
const rulesRows = snapshot.official_rules ?? [];
const restrictionRows = snapshot.current_restrictions ?? [];
const sourcesRows = snapshot.sources ?? [];

const mainDeckLastRow = cardRows.length + 1;
const archetypeLastRow = archetypeRows.length + 1;
const templateLastRow = templateRows.length + 1;
const resourceLastRow = resourceRows.length + 1;

const summarySheet = workbook.worksheets.add("Summary");
buildSummarySheet(summarySheet);

const inputsSheet = workbook.worksheets.add("Inputs");
buildInputsSheet(inputsSheet);

const rulesSheet = workbook.worksheets.add("Rules");
buildRulesSheet(rulesSheet);

const archetypeSheet = workbook.worksheets.add("Archetype Advisor");
buildArchetypeAdvisorSheet(archetypeSheet);

const mainDeckSheet = workbook.worksheets.add("Main Deck Advisor");
buildMainDeckAdvisorSheet(mainDeckSheet);

const templatesSheet = workbook.worksheets.add("Archetype Templates");
buildDataSheet(templatesSheet, templateRows, [
  "archetype",
  "template_scope",
  "template_confidence",
  "template_decks",
  "role_class",
  "inclusion_rate",
  "avg_quantity",
  "card_number",
  "card_name",
  "color",
  "card_type",
  "synergy_tags",
  "traits",
]);

const colorPairSheet = workbook.worksheets.add("Color Pair Meta");
buildDataSheet(colorPairSheet, colorPairRows, [
  "color_combination",
  "recent_top8_decks",
  "recent_wins",
  "all_top8_decks",
  "all_wins",
  "recent_meta_score",
  "overall_meta_score",
  "top_archetypes",
]);

const resourceSheet = workbook.worksheets.add("Resource Guide");
buildDataSheet(resourceSheet, resourceRows, [
  "card_number",
  "card_name",
  "color",
  "card_type",
  "traits",
  "effect_preview",
  "where_to_get_it",
  "package_codes",
  "package_labels",
]);

const deckCheckSheet = workbook.worksheets.add("Deck Check");
buildDeckCheckSheet(deckCheckSheet);

const sourcesSheet = workbook.worksheets.add("Sources");
buildDataSheet(sourcesSheet, sourcesRows, [
  "source_category",
  "source_name",
  "status",
  "detail",
  "source_date",
  "source_url",
]);

const summaryInspect = await workbook.inspect({
  kind: "table",
  range: "Summary!A1:O32",
  include: "values,formulas",
  tableMaxRows: 32,
  tableMaxCols: 15,
});

const deckCheckInspect = await workbook.inspect({
  kind: "table",
  range: "Deck Check!A1:O34",
  include: "values,formulas",
  tableMaxRows: 34,
  tableMaxCols: 15,
});

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 120 },
  summary: "formula error scan",
});

await fs.mkdir(renderDir, { recursive: true });
await saveRender(summarySheet, "A1:O32", path.join(renderDir, "deck-advisor-summary.png"));
await saveRender(inputsSheet, "A1:L28", path.join(renderDir, "deck-advisor-inputs.png"));
await saveRender(rulesSheet, "A1:F18", path.join(renderDir, "deck-advisor-rules.png"));
await saveRender(archetypeSheet, "A1:V16", path.join(renderDir, "deck-advisor-archetypes.png"));
await saveRender(mainDeckSheet, "A1:Z16", path.join(renderDir, "deck-advisor-main-deck.png"));
await saveRender(templatesSheet, "A1:M18", path.join(renderDir, "deck-advisor-templates.png"));
await saveRender(colorPairSheet, "A1:H16", path.join(renderDir, "deck-advisor-color-pairs.png"));
await saveRender(resourceSheet, "A1:I16", path.join(renderDir, "deck-advisor-resource-guide.png"));
await saveRender(deckCheckSheet, "A1:O34", path.join(renderDir, "deck-advisor-deck-check.png"));
await saveRender(sourcesSheet, "A1:F16", path.join(renderDir, "deck-advisor-sources.png"));

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(
  JSON.stringify(
    {
      workbook: outputPath,
      summaryInspect: summaryInspect.ndjson,
      deckCheckInspect: deckCheckInspect.ndjson,
      formulaErrors: formulaErrors.ndjson,
    },
    null,
    2,
  ),
);

function buildSummarySheet(sheet) {
  applyColumnWidths(sheet, {
    A: 18,
    B: 36,
    C: 8,
    D: 18,
    E: 24,
    F: 8,
    G: 18,
    H: 14,
    I: 8,
    J: 16,
    K: 14,
    L: 14,
    M: 14,
    N: 14,
    O: 14,
  });

  sheet.getRange("A1:O1").merge();
  sheet.getRange("A2:O2").merge();
  sheet.getRange("A1").values = [["Gundam Deck Advisor"]];
  sheet.getRange("A2").values = [[
    `Cross-reference build from official card data plus public meta results | Snapshot ${snapshot.snapshot_generated_utc} | Recent window ${snapshot.recent_window_days} days`,
  ]];
  styleTitle(sheet.getRange("A1:O1"));
  styleSubtitle(sheet.getRange("A2:O2"));

  addKpiCard(sheet, "A4:C6", "Main Deck Cards", snapshot.counts.main_deck_cards);
  addKpiCard(sheet, "D4:F6", "Tracked Archetypes", snapshot.counts.archetypes);
  addKpiCard(sheet, "G4:I6", "Template Rows", snapshot.counts.template_rows);
  addKpiCard(sheet, "J4:L6", "Resource Cards", snapshot.counts.resource_cards);
  addKpiCard(sheet, "M4:O6", "Restricted Cards", restrictionRows.length);

  addSectionHeader(sheet, "A8:B8", "How To Use");
  writeSimpleTable(sheet, "A9", [
    ["1", "Edit the blue input cells on the Inputs tab."],
    ["2", "Sort Archetype Advisor and Main Deck Advisor by Advisor Score."],
    ["3", "Use Archetype Templates to translate top archetypes into core/support/tech cards."],
    ["4", "Paste a draft into Deck Check to validate the 50-card main deck and 10-card resource deck."],
  ]);

  addSectionHeader(sheet, "D8:E8", "Current Rules");
  writeSimpleTable(sheet, "D9", [
    ["Main deck", "50 cards"],
    ["Colors", "Up to 2"],
    ["Resource deck", "10 resource cards"],
    ["Default copy limit", "4 of the same card number"],
    [
      "Current restriction",
      restrictionRows.length > 0
        ? `${restrictionRows[0].card_number} ${restrictionRows[0].card_name} max ${restrictionRows[0].max_copies}`
        : "None recorded",
    ],
  ]);

  addSectionHeader(sheet, "G8:H8", "Top Color Pairs");
  writeSimpleTable(
    sheet,
    "G9",
    colorPairRows.slice(0, 7).map((row) => [row.color_combination, row.recent_top8_decks || row.all_top8_decks]),
  );

  addSectionHeader(sheet, "A19:B19", "Top Archetypes");
  writeSimpleTable(
    sheet,
    "A20",
    archetypeRows.slice(0, 8).map((row) => [row.archetype, row.recent_top8_decks || row.all_top8_decks]),
  );

  addSectionHeader(sheet, "D19:E19", "Inputs Defaults");
  writeSimpleTable(sheet, "D20", [
    ["Primary color", snapshot.defaults.primary_color],
    ["Secondary color", snapshot.defaults.secondary_color || "(blank)"],
    ["Archetype keyword", snapshot.defaults.archetype_keyword || "(blank)"],
    ["Template archetype", snapshot.defaults.template_archetype || "(blank)"],
  ]);

  addSectionHeader(sheet, "G19:H19", "Snapshot");
  writeSimpleTable(sheet, "G20", [
    ["Meta snapshot", snapshot.meta_snapshot_generated_utc || "(not recorded)"],
    ["Latest event date", snapshot.latest_event_date || "(unknown)"],
    ["Recent cutoff", snapshot.recent_cutoff_date || "(unknown)"],
    ["Decklists imported", formatNumber.format(snapshot.counts.decklists)],
  ]);

  sheet.freezePanes.freezeRows(2);

  const chartRows = [...archetypeRows]
    .sort((a, b) => b.recent_top8_decks - a.recent_top8_decks || b.all_top8_decks - a.all_top8_decks)
    .slice(0, 10);
  const chart = sheet.charts.add("bar", {
    title: "Top Archetypes in the Recent Window",
    categories: chartRows.map((row) => row.archetype),
    series: [
      {
        name: "Recent top 8 decks",
        values: chartRows.map((row) => row.recent_top8_decks),
      },
    ],
    hasLegend: false,
    barOptions: {
      direction: "column",
      grouping: "clustered",
      gapWidth: 55,
    },
    from: { row: 7, col: 9 },
    extent: { widthPx: 620, heightPx: 320 },
  });
  chart.xAxis = { title: "Archetype" };
  chart.yAxis = { title: "Recent top 8 decks" };
}

function buildInputsSheet(sheet) {
  applyColumnWidths(sheet, {
    A: 24,
    B: 18,
    C: 38,
    E: 18,
    F: 28,
    H: 18,
    I: 28,
    K: 18,
    L: 28,
  });

  sheet.getRange("A1:L1").merge();
  sheet.getRange("A2:L2").merge();
  sheet.getRange("A1").values = [["Inputs"]];
  sheet.getRange("A2").values = [[
    "Edit the highlighted cells in column B, then sort the advisor tabs by Advisor Score to tune your build direction.",
  ]];
  styleTitle(sheet.getRange("A1:L1"));
  styleSubtitle(sheet.getRange("A2:L2"));

  const inputRows = [
    ["Primary color", snapshot.defaults.primary_color, "Start with the color you want the deck to revolve around."],
    ["Secondary color", snapshot.defaults.secondary_color, "Leave blank or Any if you want to stay flexible."],
    ["Archetype keyword", snapshot.defaults.archetype_keyword, "Partial text is okay. Example: Wing, Zeon, Unicorn."],
    ["Trait keyword", snapshot.defaults.trait_keyword, "Optional trait target. Example: White Base Team, Zeon."],
    ["Synergy tag", snapshot.defaults.synergy_tag, "Examples: blocker, draw, link, repair, removal, search."],
    ["Preferred card type", snapshot.defaults.preferred_card_type, "Any, UNIT, PILOT, COMMAND, or BASE."],
    ["Meta weight", snapshot.defaults.meta_weight, "Higher values favor cards/archetypes already winning events."],
    ["Synergy weight", snapshot.defaults.synergy_weight, "Higher values favor your chosen colors, traits, and tags."],
    ["Template archetype", snapshot.defaults.template_archetype, "Use this when filtering Archetype Templates or planning a test list."],
  ];
  sheet.getRange("A4:C13").values = [
    ["Input", "Value", "How it is used"],
    ...inputRows,
  ];
  const headerRange = sheet.getRange("A4:C4");
  headerRange.format.fill = palette.steel;
  headerRange.format.font = { color: palette.white, bold: true };
  sheet.getRange("A4:C13").format.borders = { preset: "outside", style: "thin", color: palette.line };
  sheet.getRange("A5:A13").format.font = { bold: true, color: palette.text };
  sheet.getRange("B5:B13").format.fill = palette.paleBlue;
  sheet.getRange("B5:B13").format.font = { bold: true, color: palette.text };
  sheet.getRange("C5:C13").format.fill = palette.ice;

  addSectionHeader(sheet, "A14:C14", "Scoring Notes");
  writeSimpleTable(sheet, "A15", [
    ["Meta blend", "65% recent performance, 35% all imported top-finish performance."],
    ["Synergy fit", "Average of color, type, trait, tag, and archetype fit signals."],
    ["Advisor score", "Weighted blend of Meta and Synergy using your values in B11 and B12."],
    ["Tip", "Weights do not need to sum to 100 because the formula normalizes them."],
  ]);

  addSectionHeader(sheet, "E4:F4", "Colors");
  writeList(sheet, "E5", snapshot.input_options.colors ?? []);
  addSectionHeader(sheet, "H4:I4", "Synergy Tags");
  writeList(sheet, "H5", snapshot.input_options.synergy_tags ?? []);
  addSectionHeader(sheet, "K4:L4", "Card Types");
  writeList(sheet, "K5", snapshot.input_options.card_types ?? []);

  addSectionHeader(sheet, "E16:F16", "Example Archetypes");
  writeList(sheet, "E17", snapshot.input_options.archetypes ?? []);
  addSectionHeader(sheet, "H16:I16", "Example Traits");
  writeList(sheet, "H17", snapshot.input_options.traits ?? []);

  sheet.freezePanes.freezeRows(2);
}

function buildRulesSheet(sheet) {
  const ruleRows = rulesRows.map((row) => ({
    rule_area: row.rule_area,
    rule_value: row.rule_value,
    classification: row.classification,
    note: row.note,
    source_date: row.source_date,
    source_url: row.source_url,
  }));
  const restrictionData = restrictionRows.map((row) => ({
    rule_area: `Restriction: ${row.card_number}`,
    rule_value: `${row.card_name} max ${row.max_copies} copies`,
    classification: row.restriction_type,
    note: `${row.note} Effective ${row.effective_date}.`,
    source_date: row.source_date,
    source_url: row.source_url,
  }));
  buildDataSheet(sheet, [...ruleRows, ...restrictionData], [
    "rule_area",
    "rule_value",
    "classification",
    "note",
    "source_date",
    "source_url",
  ]);
}

function buildArchetypeAdvisorSheet(sheet) {
  const columns = [
    "advisor_score",
    "meta_blend_score",
    "synergy_fit_score",
    "archetype",
    "common_color_combination",
    "template_confidence",
    "template_scope",
    "recent_decklists",
    "recent_top8_decks",
    "recent_wins",
    "all_decklists",
    "all_top8_decks",
    "all_wins",
    "recent_meta_score",
    "overall_meta_score",
    "color_fit",
    "trait_fit",
    "tag_fit",
    "archetype_fit",
    "signature_traits",
    "signature_tags",
    "core_cards_preview",
  ];
  const rows = archetypeRows.map((row) => ({
    advisor_score: "",
    meta_blend_score: "",
    synergy_fit_score: "",
    ...row,
    color_fit: "",
    trait_fit: "",
    tag_fit: "",
    archetype_fit: "",
  }));
  buildDataSheet(sheet, rows, columns);

  const formulaMatrix = [];
  for (let row = 2; row <= archetypeLastRow; row += 1) {
    formulaMatrix.push([
      `=IF((Inputs!$B$11+Inputs!$B$12)=0,0,ROUND(((Inputs!$B$11*B${row})+(Inputs!$B$12*C${row}))/(Inputs!$B$11+Inputs!$B$12),1))`,
      `=ROUND((N${row}*0.65)+(O${row}*0.35),1)`,
      `=ROUND(AVERAGE(P${row}:S${row}),1)`,
      `=IF(OR(Inputs!$B$5="",Inputs!$B$5="Any"),50,IF(AND(ISNUMBER(SEARCH(LOWER(Inputs!$B$5),LOWER(E${row}))),OR(Inputs!$B$6="",Inputs!$B$6="Any",ISNUMBER(SEARCH(LOWER(Inputs!$B$6),LOWER(E${row}))))),100,IF(ISNUMBER(SEARCH(LOWER(Inputs!$B$5),LOWER(E${row}))),70,0)))`,
      `=IF(OR(Inputs!$B$8="",Inputs!$B$8="Any"),50,IF(ISNUMBER(SEARCH(LOWER(Inputs!$B$8),LOWER(T${row}))),100,0))`,
      `=IF(OR(Inputs!$B$9="",Inputs!$B$9="Any"),50,IF(ISNUMBER(SEARCH(LOWER(Inputs!$B$9),LOWER(U${row}))),100,0))`,
      `=IF(OR(Inputs!$B$7="",Inputs!$B$7="Any"),50,IF(ISNUMBER(SEARCH(LOWER(Inputs!$B$7),LOWER(D${row}))),100,0))`,
    ]);
  }
  writeFormulaMatrix(sheet.getRange(`A2:C${archetypeLastRow}`), formulaMatrix.map((row) => row.slice(0, 3)));
  writeFormulaMatrix(sheet.getRange(`P2:S${archetypeLastRow}`), formulaMatrix.map((row) => row.slice(3)));

  styleScoreColumns(sheet, ["A", "B", "C", "P", "Q", "R", "S"], archetypeLastRow);
}

function buildMainDeckAdvisorSheet(sheet) {
  const columns = [
    "advisor_score",
    "meta_blend_score",
    "synergy_fit_score",
    "card_number",
    "card_name",
    "color",
    "card_type",
    "level",
    "cost",
    "copy_limit",
    "restriction_note",
    "recent_meta_score",
    "overall_meta_score",
    "color_fit",
    "type_fit",
    "trait_fit",
    "tag_fit",
    "archetype_fit",
    "top_archetypes",
    "top_color_pairs",
    "synergy_tags",
    "traits",
    "link_targets",
    "effect_preview",
    "where_to_get_it",
    "package_codes",
  ];
  const rows = cardRows.map((row) => ({
    advisor_score: "",
    meta_blend_score: "",
    synergy_fit_score: "",
    ...row,
    color_fit: "",
    type_fit: "",
    trait_fit: "",
    tag_fit: "",
    archetype_fit: "",
  }));
  buildDataSheet(sheet, rows, columns);

  const formulaAtoC = [];
  const formulaNtoR = [];
  for (let row = 2; row <= mainDeckLastRow; row += 1) {
    formulaAtoC.push([
      `=IF((Inputs!$B$11+Inputs!$B$12)=0,0,ROUND(((Inputs!$B$11*B${row})+(Inputs!$B$12*C${row}))/(Inputs!$B$11+Inputs!$B$12),1))`,
      `=ROUND((L${row}*0.65)+(M${row}*0.35),1)`,
      `=ROUND(AVERAGE(N${row}:R${row}),1)`,
    ]);
    formulaNtoR.push([
      `=IF(OR(Inputs!$B$5="",Inputs!$B$5="Any"),50,IF(OR(F${row}="Neutral",F${row}="-"),30,IF(F${row}=Inputs!$B$5,100,IF(AND(Inputs!$B$6<>"",Inputs!$B$6<>"Any",F${row}=Inputs!$B$6),85,0))))`,
      `=IF(OR(Inputs!$B$10="",Inputs!$B$10="Any"),50,IF(G${row}=Inputs!$B$10,100,0))`,
      `=IF(OR(Inputs!$B$8="",Inputs!$B$8="Any"),50,IF(ISNUMBER(SEARCH(LOWER(Inputs!$B$8),LOWER(V${row}))),100,0))`,
      `=IF(OR(Inputs!$B$9="",Inputs!$B$9="Any"),50,IF(ISNUMBER(SEARCH(LOWER(Inputs!$B$9),LOWER(U${row}))),100,0))`,
      `=IF(OR(Inputs!$B$7="",Inputs!$B$7="Any"),50,IF(ISNUMBER(SEARCH(LOWER(Inputs!$B$7),LOWER(S${row}))),100,0))`,
    ]);
  }
  writeFormulaMatrix(sheet.getRange(`A2:C${mainDeckLastRow}`), formulaAtoC);
  writeFormulaMatrix(sheet.getRange(`N2:R${mainDeckLastRow}`), formulaNtoR);

  styleScoreColumns(sheet, ["A", "B", "C", "N", "O", "P", "Q", "R"], mainDeckLastRow);
}

function buildDeckCheckSheet(sheet) {
  applyColumnWidths(sheet, {
    A: 12,
    B: 20,
    C: 24,
    D: 12,
    E: 14,
    F: 10,
    G: 14,
    H: 28,
    J: 12,
    K: 20,
    L: 24,
    M: 12,
    N: 14,
    O: 14,
  });

  sheet.getRange("A1:O1").merge();
  sheet.getRange("A2:O2").merge();
  sheet.getRange("A1").values = [["Deck Check"]];
  sheet.getRange("A2").values = [[
    "Paste card numbers into the main and resource tables below. The sheet validates main-deck size, color count, card type legality, and current copy limits.",
  ]];
  styleTitle(sheet.getRange("A1:O1"));
  styleSubtitle(sheet.getRange("A2:O2"));

  addSectionHeader(sheet, "A4:B4", "Main Deck Summary");
  writeLabeledCell(sheet, "A5", "Total cards", "=SUM(A16:A75)", true);
  writeLabeledCell(sheet, "A6", "Unique colors", '=SUMPRODUCT(IFERROR((D16:D75<>"")/COUNTIF(D16:D75,D16:D75&""),0))', true);
  writeLabeledCell(sheet, "A7", "Invalid cards", '=COUNTIF(G16:G75,"Not found")', true);
  writeLabeledCell(sheet, "A8", "Copy issues", '=COUNTIF(G16:G75,"Over limit")', true);
  writeLabeledCell(sheet, "A9", "Invalid types", '=COUNTIF(G16:G75,"Invalid type")', true);
  writeLabeledCell(sheet, "A10", "Status", '=IF(B5=0,"Needs cards",IF(AND(B5=50,B6<=2,B7=0,B8=0,B9=0),"Legal main deck","Needs fixes"))', true);

  addSectionHeader(sheet, "J4:K4", "Resource Deck Summary");
  writeLabeledCell(sheet, "J5", "Total cards", "=SUM(J16:J30)", true);
  writeLabeledCell(sheet, "J6", "Invalid cards", '=COUNTIF(O16:O30,"Not found")+COUNTIF(O16:O30,"Not resource")', true);
  writeLabeledCell(sheet, "J7", "Status", '=IF(K5=0,"Needs cards",IF(AND(K5=10,K6=0),"Legal resource deck","Check resource deck"))', true);
  writeLabeledCell(sheet, "J8", "Rule note", "Resource deck uses RESOURCE cards only", false);

  sheet.getRange("A14:H14").values = [[
    "Qty",
    "Card Number",
    "Card Name",
    "Color",
    "Type",
    "Copy Limit",
    "Status",
    "Restriction Note",
  ]];
  styleTableHeader(sheet.getRange("A14:H14"));
  sheet.getRange("J14:O14").values = [[
    "Qty",
    "Card Number",
    "Card Name",
    "Color",
    "Type",
    "Status",
  ]];
  styleTableHeader(sheet.getRange("J14:O14"));

  for (let row = 16; row <= 75; row += 1) {
    writeFormula(sheet.getRange(`C${row}`), `=IF($B${row}="","",IFERROR(INDEX('Main Deck Advisor'!$E$2:$E$${mainDeckLastRow},MATCH($B${row},'Main Deck Advisor'!$D$2:$D$${mainDeckLastRow},0)),""))`);
    writeFormula(sheet.getRange(`D${row}`), `=IF($B${row}="","",IFERROR(INDEX('Main Deck Advisor'!$F$2:$F$${mainDeckLastRow},MATCH($B${row},'Main Deck Advisor'!$D$2:$D$${mainDeckLastRow},0)),""))`);
    writeFormula(sheet.getRange(`E${row}`), `=IF($B${row}="","",IFERROR(INDEX('Main Deck Advisor'!$G$2:$G$${mainDeckLastRow},MATCH($B${row},'Main Deck Advisor'!$D$2:$D$${mainDeckLastRow},0)),""))`);
    writeFormula(sheet.getRange(`F${row}`), `=IF($B${row}="","",IFERROR(INDEX('Main Deck Advisor'!$J$2:$J$${mainDeckLastRow},MATCH($B${row},'Main Deck Advisor'!$D$2:$D$${mainDeckLastRow},0)),""))`);
    writeFormula(sheet.getRange(`H${row}`), `=IF($B${row}="","",IFERROR(INDEX('Main Deck Advisor'!$K$2:$K$${mainDeckLastRow},MATCH($B${row},'Main Deck Advisor'!$D$2:$D$${mainDeckLastRow},0)),""))`);
    writeFormula(
      sheet.getRange(`G${row}`),
      `=IF($B${row}="","",IF($C${row}="","Not found",IF(ISNUMBER(MATCH($E${row},{"UNIT","PILOT","COMMAND","BASE"},0)),IF(SUMIF($B$16:$B$75,$B${row},$A$16:$A$75)<=$F${row},"OK","Over limit"),"Invalid type")))`,
    );
  }

  for (let row = 16; row <= 30; row += 1) {
    writeFormula(sheet.getRange(`L${row}`), `=IF($K${row}="","",IFERROR(INDEX('Resource Guide'!$B$2:$B$${resourceLastRow},MATCH($K${row},'Resource Guide'!$A$2:$A$${resourceLastRow},0)),""))`);
    writeFormula(sheet.getRange(`M${row}`), `=IF($K${row}="","",IFERROR(INDEX('Resource Guide'!$C$2:$C$${resourceLastRow},MATCH($K${row},'Resource Guide'!$A$2:$A$${resourceLastRow},0)),""))`);
    writeFormula(sheet.getRange(`N${row}`), `=IF($K${row}="","",IFERROR(INDEX('Resource Guide'!$D$2:$D$${resourceLastRow},MATCH($K${row},'Resource Guide'!$A$2:$A$${resourceLastRow},0)),""))`);
    writeFormula(sheet.getRange(`O${row}`), `=IF($K${row}="","",IF($L${row}="","Not found",IF($N${row}="RESOURCE","OK","Not resource")))`);
  }

  sheet.getRange("A14:H75").format.borders = { preset: "outside", style: "thin", color: palette.line };
  sheet.getRange("J14:O30").format.borders = { preset: "outside", style: "thin", color: palette.line };
  sheet.getRange("A16:B75").format.fill = palette.paleBlue;
  sheet.getRange("J16:K30").format.fill = palette.paleBlue;
  sheet.getRange("C16:H75").format.fill = palette.ice;
  sheet.getRange("L16:O30").format.fill = palette.ice;
  sheet.freezePanes.freezeRows(14);
}

function writeLabeledCell(sheet, anchorCell, label, valueOrFormula, isFormula) {
  const startCol = columnIndex(anchorCell);
  const startRow = rowIndex(anchorCell);
  const labelCell = cellFromParts(startCol, startRow);
  const valueCell = cellFromParts(startCol + 1, startRow);
  sheet.getRange(`${labelCell}:${valueCell}`).format.borders = {
    preset: "outside",
    style: "thin",
    color: palette.line,
  };
  sheet.getRange(labelCell).values = [[label]];
  sheet.getRange(labelCell).format.font = { bold: true, color: palette.text };
  sheet.getRange(valueCell).format.fill = palette.ice;
  if (isFormula) {
    writeFormula(sheet.getRange(valueCell), valueOrFormula);
  } else {
    sheet.getRange(valueCell).values = [[valueOrFormula]];
  }
}

function writeFormula(range, formula) {
  writeFormulaMatrix(range, [[formula]]);
}

function writeFormulaMatrix(range, formulas) {
  try {
    range.formulas = formulas;
  } catch {
    range.values = formulas;
  }
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
      // Keep the sheet usable if the workbook version rejects table creation.
    }
  }

  for (const urlColumnName of ["source_url"]) {
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

function writeList(sheet, anchorCell, values) {
  const rows = values.map((value) => [value]);
  if (!rows.length) {
    return;
  }
  const startCol = columnIndex(anchorCell);
  const startRow = rowIndex(anchorCell);
  const endCell = cellFromParts(startCol, startRow + rows.length - 1);
  sheet.getRange(`${anchorCell}:${endCell}`).values = rows;
  sheet.getRange(`${anchorCell}:${endCell}`).format.borders = {
    preset: "outside",
    style: "thin",
    color: palette.line,
  };
  sheet.getRange(`${anchorCell}:${endCell}`).format.fill = palette.ice;
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
  sheet.getRange(labelRange).format.fill = palette.red;
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
  if (!rows.length) {
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

function styleScoreColumns(sheet, columns, lastRow) {
  for (const column of columns) {
    const range = sheet.getRange(`${column}2:${column}${lastRow}`);
    range.format.fill = palette.paleGreen;
    range.format.numberFormat = "0.0";
  }
}

function styleTableHeader(range) {
  range.format.fill = palette.steel;
  range.format.font = { color: palette.white, bold: true };
  range.format.borders = { preset: "outside", style: "thin", color: palette.line };
}

function styleTitle(range) {
  range.format.fill = palette.navy;
  range.format.font = { color: palette.white, bold: true, size: 20 };
  range.format.alignment = { horizontal: "center", vertical: "center" };
}

function styleSubtitle(range) {
  range.format.fill = palette.paleBlue;
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
    advisor_score: 12,
    meta_blend_score: 12,
    synergy_fit_score: 12,
    archetype: 24,
    common_color_combination: 16,
    template_confidence: 14,
    template_scope: 20,
    recent_decklists: 12,
    recent_top8_decks: 12,
    recent_wins: 10,
    all_decklists: 12,
    all_top8_decks: 12,
    all_wins: 10,
    recent_meta_score: 12,
    overall_meta_score: 12,
    color_fit: 10,
    type_fit: 10,
    trait_fit: 10,
    tag_fit: 10,
    archetype_fit: 12,
    signature_traits: 26,
    signature_tags: 24,
    core_cards_preview: 34,
    card_number: 14,
    card_name: 28,
    color: 12,
    card_type: 14,
    level: 8,
    cost: 8,
    copy_limit: 10,
    restriction_note: 28,
    top_archetypes: 30,
    top_color_pairs: 24,
    synergy_tags: 24,
    traits: 28,
    link_targets: 22,
    effect_preview: 44,
    where_to_get_it: 32,
    package_codes: 16,
    package_labels: 28,
    template_decks: 12,
    role_class: 12,
    inclusion_rate: 12,
    avg_quantity: 12,
    color_combination: 18,
    rule_area: 20,
    rule_value: 24,
    classification: 16,
    note: 42,
    source_date: 14,
    source_url: 34,
    source_category: 16,
    source_name: 28,
    status: 18,
    detail: 40,
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
