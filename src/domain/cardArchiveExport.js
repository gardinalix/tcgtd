// Browser-only card catalog export. No account, API endpoint or third-party XLSX dependency.
export const ARCHIVE_COLUMNS = [
  ["cardNumber", "Card Number", 17],
  ["printingId", "Printing ID", 19],
  ["name", "Card Name", 34],
  ["set", "Set / Product", 32],
  ["color", "Color", 15],
  ["type", "Type", 17],
  ["rarity", "Rarity", 13],
  ["variant", "Variant", 16],
  ["level", "Level", 10],
  ["cost", "Cost", 10],
  ["ap", "AP", 10],
  ["hp", "HP", 10],
  ["traits", "Traits", 38],
  ["effect", "Effect", 68],
  ["obtained", "Where to Get", 42],
  ["image", "Image URL", 75],
  ["detail", "Official Card URL", 75],
  ["tcgUsd", "TCGplayer USD", 19],
  ["marketBrl", "MarketZeon BRL", 20],
  ["ligaBrl", "LigaGundam BRL", 20],
  ["priceDate", "Price Checked (UTC)", 25],
];

function nonEmpty(value) {
  return value === undefined || value === null ? "" : value;
}

function numberOrBlank(value) {
  return value === undefined || value === null || value === "" || !Number.isFinite(Number(value))
    ? "" : Number(value);
}

function cardRow(card, printing, isCanonical) {
  const id = isCanonical ? card.cardNumber : (printing.detailSearchId || card.detailSearchId || card.cardNumber);
  const src = isCanonical ? card : printing;
  // Printed editions may have a different price from the canonical card (including the base printing).
  const price = isCanonical ? card : printing;
  const variant = isCanonical ? "Canonical" : (printing.isParallelVariant || String(printing.rarity || "").includes("+") ? "Parallel / Alt" : id === card.cardNumber ? "Base" : "Reprint / Variant");
  return {
    cardNumber: card.cardNumber,
    printingId: id,
    name: card.cardName,
    set: isCanonical ? (card.whereToGetIt || card.packageLabels?.[0] || "") : (printing.packageLabel || printing.whereToGetIt || ""),
    color: card.color,
    type: card.cardType,
    rarity: nonEmpty(src.rarity || card.rarity),
    variant,
    level: numberOrBlank(card.level),
    cost: numberOrBlank(card.cost),
    ap: numberOrBlank(card.ap),
    hp: numberOrBlank(card.hp),
    traits: Array.isArray(card.traits) ? card.traits.join(", ") : nonEmpty(card.traits),
    effect: nonEmpty(card.effectPreview),
    obtained: nonEmpty(src.whereToGetIt || card.whereToGetIt),
    image: nonEmpty(src.remoteImageUrl || (isCanonical ? card.printings?.[0]?.remoteImageUrl : "") || src.imageUrl || ""),
    detail: nonEmpty(src.detailUrl || card.detailUrl),
    tcgUsd: numberOrBlank(price.marketPriceUsd),
    marketBrl: numberOrBlank(price.marketZeonLowPriceBrl),
    ligaBrl: numberOrBlank(price.ligaGundamLowPriceBrl),
    priceDate: nonEmpty(price.priceLastCheckedUtc),
  };
}

/**
 * One row per canonical card, or one row per individual official printing.
 * visibleIds applies to printing-level filters; visibleNumbers applies to canonical mode.
 */
export function buildCardArchiveRows(cards, options = {}) {
  const { includeVariants = true, visibleIds = null, visibleNumbers = null } = options;
  const idFilter = visibleIds ? new Set(visibleIds) : null;
  const numberFilter = visibleNumbers ? new Set(visibleNumbers) : null;
  const seen = new Set();
  const rows = [];

  for (const card of cards || []) {
    if (!card?.cardNumber) continue;
    if (!includeVariants) {
      if (numberFilter && !numberFilter.has(card.cardNumber)) continue;
      if (seen.has(card.cardNumber)) continue;
      seen.add(card.cardNumber);
      rows.push(cardRow(card, null, true));
      continue;
    }
    const printings = Array.isArray(card.printings) && card.printings.length
      ? card.printings : [card];
    for (const printing of printings) {
      const id = printing.detailSearchId || card.cardNumber;
      if (idFilter && !idFilter.has(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(cardRow(card, printing, false));
    }
  }
  return rows.sort((a, b) => a.cardNumber.localeCompare(b.cardNumber, undefined, { numeric: true })
    || a.printingId.localeCompare(b.printingId, undefined, { numeric: true }));
}

function xmlEscape(input) {
  return String(nonEmpty(input)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnLetter(index) {
  let i = index + 1;
  let text = "";
  while (i > 0) {
    i -= 1;
    text = String.fromCharCode(65 + i % 26) + text;
    i = Math.floor(i / 26);
  }
  return text;
}

function worksheetXml(header, data, widths, moneyColumns = {}) {
  const endCell = columnLetter(header.length - 1) + String(data.length + 1);
  const columns = widths.map((width, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + width + '" customWidth="1"/>').join("");
  const rows = [header, ...data].map((values, rowIndex) => {
    const cells = values.map((value, columnIndex) => {
      const cell = columnLetter(columnIndex) + (rowIndex + 1);
      const isMoney = moneyColumns[columnIndex];
      let style = rowIndex === 0 ? 1 : rowIndex % 2 === 0 ? 2 : 0;
      if (rowIndex && isMoney === "USD") style = rowIndex % 2 === 0 ? 4 : 3;
      if (rowIndex && isMoney === "BRL") style = rowIndex % 2 === 0 ? 6 : 5;
      if (rowIndex && typeof value === "number" && Number.isFinite(value)) {
        return '<c r="' + cell + '" s="' + style + '" t="n"><v>' + value + '</v></c>';
      }
      return '<c r="' + cell + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEscape(value) + '</t></is></c>';
    }).join("");
    return '<row r="' + (rowIndex + 1) + '" ht="' + (rowIndex === 0 ? 30 : 21) + '" customHeight="1">' + cells + '</row>';
  }).join("");

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<dimension ref="A1:' + endCell + '"/>'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    + '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="21"/>'
    + '<cols>' + columns + '</cols><sheetData>' + rows + '</sheetData>'
    + '<autoFilter ref="A1:' + endCell + '"/></worksheet>';
}

const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0.00"/>'
  + '<numFmt numFmtId="165" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>'
  + '<fonts count="2"><font><sz val="10"/><color rgb="FF14223B"/><name val="Aptos"/></font>'
  + '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts>'
  + '<fills count="4"><fill><patternFill patternType="none"/></fill>'
  + '<fill><patternFill patternType="gray125"/></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FF10223C"/><bgColor indexed="64"/></patternFill></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FFEAF4FB"/><bgColor indexed="64"/></patternFill></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="7">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>'
  + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="165" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>'
  + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function zipStored(entries) {
  const encode = new TextEncoder();
  const parts = [];
  const directory = [];
  let offset = 0;
  let directoryBytes = 0;
  for (const [name, value] of entries) {
    const nameBytes = encode.encode(name);
    const data = encode.encode(value);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034B50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    parts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014B50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    directory.push(central);
    offset += local.length;
    directoryBytes += central.length;
  }
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054B50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, directoryBytes, true);
  ev.setUint32(16, offset, true);
  const total = offset + directoryBytes + end.length;
  const output = new Uint8Array(total);
  let at = 0;
  for (const part of [...parts, ...directory, end]) {
    output.set(part, at);
    at += part.length;
  }
  return output;
}

export function buildCardArchiveXlsx(rows, options = {}) {
  const { includeVariants = true, snapshot = "", scope = "All cards" } = options;
  const header = ARCHIVE_COLUMNS.map((column) => column[1]);
  const data = rows.map((row) => ARCHIVE_COLUMNS.map((column) => nonEmpty(row[column[0]])));
  const guide = [
    ["Property", "Value"],
    ["Database", "TCG Tactical Database / Card Intelligence Archive"],
    ["Export scope", scope],
    ["Include all printings", includeVariants ? "Yes — base, promotional and parallel art" : "No — one canonical row per card"],
    ["Rows", rows.length],
    ["Card data snapshot (UTC)", snapshot],
    ["Card details", "https://www.gundam-gcg.com/en/cards/"],
    ["Notes", "Blank price cells mean that no printing-specific price was synchronized."],
    ["License", "Card images and card names belong to their respective rights holders."],
  ];
  const cardsXml = worksheetXml(header, data, ARCHIVE_COLUMNS.map((column) => column[2]), { 17: "USD", 18: "BRL", 19: "BRL" });
  const guideXml = worksheetXml(guide[0], guide.slice(1), [33, 90]);
  const entries = [
    ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '</Types>'],
    ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>'],
    ["xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
      + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets><sheet name="Cards" sheetId="1" r:id="rId1"/><sheet name="About" sheetId="2" r:id="rId2"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '</Relationships>'],
    ["xl/styles.xml", STYLES_XML],
    ["xl/worksheets/sheet1.xml", cardsXml],
    ["xl/worksheets/sheet2.xml", guideXml],
  ];
  return zipStored(entries);
}

export function downloadCardArchive(rows, options = {}) {
  if (!rows.length) throw new Error("No cards match the selected export scope.");
  const bytes = buildCardArchiveXlsx(rows, options);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const suffix = options.includeVariants === false ? "canonical" : "all-printings";
  link.href = url;
  link.download = "tcgtd-card-archive-" + suffix + ".xlsx";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
