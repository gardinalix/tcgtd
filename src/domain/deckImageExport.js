const SHEET_WIDTH = 1800;
const SHEET_MARGIN = 64;
const CARD_GAP = 20;
const HEADER_HEIGHT = 296;
const FOOTER_HEIGHT = 92;
const TYPE_PRIORITY = new Map([
  ["UNIT", 0],
  ["PILOT", 1],
  ["COMMAND", 2],
  ["BASE", 3],
]);

const CARD_CHANNELS = {
  blue: "#46cfff",
  green: "#48f0ae",
  red: "#ff5275",
  purple: "#b987ff",
  white: "#e6f7ff",
  neutral: "#7b98a4",
};

export function buildDeckSheetModel({ deck = {}, rows = [], stats = {} } = {}) {
  const sourceDeck = deck.sourceDeck || {};
  const entries = [...rows]
    .filter((row) => row?.card?.cardNumber && Number(row.quantity || 0) > 0)
    .sort(compareDeckSheetRows)
    .map((row) => ({
      quantity: Number(row.quantity || 0),
      cardNumber: row.card.cardNumber,
      cardName: row.card.cardName || row.card.cardNumber,
      cardType: String(row.card.cardType || "CARD").toUpperCase(),
      color: row.card.color || "Neutral",
      colorChannel: normalizeDeckSheetColor(row.card.color),
      cost: row.card.cost ?? "—",
      level: row.card.level ?? "—",
      rarity: row.card.rarity || "—",
      imageUrl: row.card.imageUrl || "",
      remoteImageUrl: row.card.remoteImageUrl
        || row.card.printings?.find((printing) => printing.remoteImageUrl)?.remoteImageUrl
        || "",
    }));
  const colors = Object.entries(stats.colors || {}).map(([label, count]) => ({
    label,
    count: Number(count || 0),
    channel: normalizeDeckSheetColor(label),
  }));
  const types = Object.entries(stats.types || {}).map(([label, count]) => ({
    label,
    count: Number(count || 0),
  }));
  const curve = Object.entries(stats.curve || {})
    .map(([label, count]) => ({ label, count: Number(count || 0) }))
    .sort((left, right) => Number(left.label) - Number(right.label));

  return {
    title: deck.name || deck.title || "Untitled deck",
    author: deck.author || deck.playerName || sourceDeck.playerName || deck.sourceName || "Community pilot",
    event: deck.event || deck.eventName || sourceDeck.eventName || "Community deck archive",
    result: deck.result || deck.placingLabel || sourceDeck.placingLabel || "—",
    format: deck.formatName || deck.format || sourceDeck.formatName || sourceDeck.format || inferDeckFormat(entries) || "CURRENT",
    mainCount: Number(stats.mainCount || entries.reduce((total, entry) => total + entry.quantity, 0)),
    uniqueCount: entries.length,
    colors,
    types,
    curve,
    entries,
  };
}

export function getDeckSheetLayout(uniqueCount = 0) {
  const count = Math.max(1, Number(uniqueCount || 0));
  const columns = count <= 12 ? 4 : count <= 20 ? 5 : count <= 30 ? 6 : 8;
  const contentWidth = SHEET_WIDTH - (SHEET_MARGIN * 2);
  const cardWidth = Math.floor((contentWidth - (CARD_GAP * (columns - 1))) / columns);
  const artHeight = Math.round(cardWidth * 1.4);
  const tileHeight = artHeight + 68;
  const rowCount = Math.ceil(count / columns);
  const gridHeight = (rowCount * tileHeight) + ((rowCount - 1) * CARD_GAP);
  return {
    width: SHEET_WIDTH,
    height: HEADER_HEIGHT + gridHeight + FOOTER_HEIGHT,
    margin: SHEET_MARGIN,
    gap: CARD_GAP,
    columns,
    rowCount,
    cardWidth,
    artHeight,
    tileHeight,
    gridTop: HEADER_HEIGHT,
  };
}

export function getDeckSheetTileRect(index, layout) {
  const column = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  return {
    x: layout.margin + (column * (layout.cardWidth + layout.gap)),
    y: layout.gridTop + (row * (layout.tileHeight + layout.gap)),
    width: layout.cardWidth,
    height: layout.tileHeight,
  };
}

export function deckSheetFilename(title = "deck") {
  const safeTitle = String(title || "deck")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "deck";
  return `${safeTitle}-tcgtd-deck-sheet.png`;
}

export async function renderDeckSheetPng(input) {
  if (typeof document === "undefined") throw new Error("Deck sheet rendering requires a browser.");
  const model = buildDeckSheetModel(input);
  const layout = getDeckSheetLayout(model.uniqueCount);
  await document.fonts?.ready;

  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas rendering is unavailable in this browser.");

  const primaryChannel = model.colors[0]?.channel || "blue";
  const secondaryChannel = model.colors[1]?.channel || primaryChannel;
  const primary = CARD_CHANNELS[primaryChannel] || CARD_CHANNELS.blue;
  const secondary = CARD_CHANNELS[secondaryChannel] || primary;
  drawSheetBackground(context, layout, primary, secondary);

  const [brandMark, cardImages] = await Promise.all([
    loadDeckSheetImage("/assets/brand/tcgtd-orbital-mark-v3.svg"),
    loadCardImages(model.entries),
  ]);
  drawSheetHeader(context, model, layout, primary, secondary, brandMark);
  model.entries.forEach((entry, index) => {
    drawCardTile(context, entry, getDeckSheetTileRect(index, layout), cardImages[index]);
  });
  drawSheetFooter(context, model, layout, primary);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The PNG encoder did not return an image."));
    }, "image/png");
  });
}

export function downloadDeckSheetBlob(blob, title) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = deckSheetFilename(title);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function compareDeckSheetRows(left, right) {
  const leftPriority = TYPE_PRIORITY.get(String(left?.card?.cardType || "").toUpperCase()) ?? 9;
  const rightPriority = TYPE_PRIORITY.get(String(right?.card?.cardType || "").toUpperCase()) ?? 9;
  return leftPriority - rightPriority
    || Number(left?.card?.cost ?? 99) - Number(right?.card?.cost ?? 99)
    || String(left?.card?.cardNumber || "").localeCompare(String(right?.card?.cardNumber || ""));
}

function inferDeckFormat(entries) {
  return entries
    .map((entry) => entry.cardNumber.match(/\bGD\d{2}\b/i)?.[0])
    .filter(Boolean)
    .sort()
    .at(-1)?.toUpperCase();
}

function normalizeDeckSheetColor(value) {
  const color = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (color.includes("blue") || color.includes("azul")) return "blue";
  if (color.includes("red") || color.includes("vermelh")) return "red";
  if (color.includes("green") || color.includes("verde")) return "green";
  if (color.includes("purple") || color.includes("rox")) return "purple";
  if (color.includes("white") || color.includes("branc")) return "white";
  return "neutral";
}

async function loadCardImages(entries) {
  const results = new Array(entries.length).fill(null);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(6, entries.length) }, async () => {
    while (cursor < entries.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await loadDeckSheetImage(entries[index].imageUrl)
        || await loadDeckSheetImage(entries[index].remoteImageUrl);
    }
  });
  await Promise.all(workers);
  return results;
}

async function loadDeckSheetImage(source) {
  if (!source) return null;
  const url = resolveDeckSheetAssetUrl(source);
  try {
    const response = await fetch(url, { cache: "force-cache", mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (typeof createImageBitmap === "function") return await createImageBitmap(blob);
    return await loadHtmlImage(URL.createObjectURL(blob), true);
  } catch {
    return null;
  }
}

function resolveDeckSheetAssetUrl(source) {
  const value = String(source || "").trim();
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const path = `/${value.replace(/^\.?\//, "")}`;
  return new URL(path, window.location.origin).href;
}

function loadHtmlImage(url, revoke = false) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (revoke) URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      if (revoke) URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

function drawSheetBackground(context, layout, primary, secondary) {
  const gradient = context.createLinearGradient(0, 0, layout.width, layout.height);
  gradient.addColorStop(0, "#020812");
  gradient.addColorStop(.55, "#06131b");
  gradient.addColorStop(1, "#01050a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, layout.width, layout.height);

  context.save();
  context.globalAlpha = .09;
  context.strokeStyle = primary;
  context.lineWidth = 1;
  for (let x = 0; x <= layout.width; x += 64) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, layout.height);
    context.stroke();
  }
  for (let y = 0; y <= layout.height; y += 64) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(layout.width, y);
    context.stroke();
  }
  context.restore();

  context.save();
  context.translate(layout.width - 92, 54);
  context.globalAlpha = .16;
  context.strokeStyle = secondary;
  context.lineWidth = 3;
  [104, 144, 196].forEach((radius, index) => {
    context.beginPath();
    context.arc(0, 0, radius, Math.PI * (.64 + index * .08), Math.PI * (1.83 - index * .05));
    context.stroke();
  });
  context.restore();

  context.fillStyle = primary;
  context.fillRect(0, 0, layout.width, 8);
  context.fillStyle = secondary;
  context.fillRect(Math.round(layout.width * .68), 0, Math.round(layout.width * .32), 8);
}

function drawSheetHeader(context, model, layout, primary, secondary, brandMark) {
  const left = layout.margin;
  const brandSize = 112;
  if (brandMark) {
    context.drawImage(brandMark, left, 38, brandSize, brandSize);
  } else {
    drawFallbackMark(context, left + (brandSize / 2), 38 + (brandSize / 2), primary);
  }

  context.fillStyle = primary;
  context.font = "800 22px Rajdhani, Arial, sans-serif";
  context.letterSpacing = "3px";
  context.fillText("TCG TACTICAL DATABASE // DECK DOSSIER", left + 138, 62);

  context.fillStyle = "#f0fbff";
  context.font = "800 58px Rajdhani, Arial, sans-serif";
  drawWrappedText(context, model.title, left + 138, 117, 960, 64, 2);

  context.fillStyle = "#7895a1";
  context.font = "700 20px Rajdhani, Arial, sans-serif";
  const identity = `${model.author}  //  ${model.event}`;
  context.fillText(trimCanvasText(context, identity, 980), left + 138, 237);

  const tags = model.colors.length ? model.colors.map((color) => color.label.toUpperCase()).join(" / ") : "COLOR OPEN";
  drawChip(context, left + 138, 252, tags, primary);
  drawChip(context, left + 380, 252, model.format, secondary);

  const telemetryX = 1254;
  const telemetryY = 44;
  const telemetryWidth = layout.width - telemetryX - layout.margin;
  context.fillStyle = "rgba(2, 11, 18, .9)";
  context.fillRect(telemetryX, telemetryY, telemetryWidth, 206);
  context.strokeStyle = hexToRgba(primary, .45);
  context.lineWidth = 2;
  context.strokeRect(telemetryX, telemetryY, telemetryWidth, 206);
  context.fillStyle = primary;
  context.font = "800 17px Rajdhani, Arial, sans-serif";
  context.fillText("TACTICAL TELEMETRY", telemetryX + 22, telemetryY + 29);
  drawMetric(context, telemetryX + 22, telemetryY + 52, "MAIN DECK", String(model.mainCount).padStart(2, "0"), primary);
  drawMetric(context, telemetryX + 196, telemetryY + 52, "UNIQUE", String(model.uniqueCount).padStart(2, "0"), secondary);
  drawMetric(context, telemetryX + 22, telemetryY + 121, "RESULT", String(model.result), "#efc84a");
  drawCurve(context, model.curve, telemetryX + 196, telemetryY + 121, telemetryWidth - 218, 58, primary);
}

function drawCardTile(context, entry, rect, image) {
  const channel = CARD_CHANNELS[entry.colorChannel] || CARD_CHANNELS.neutral;
  context.save();
  context.fillStyle = "rgba(2, 9, 15, .96)";
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  context.strokeStyle = hexToRgba(channel, .62);
  context.lineWidth = 2;
  context.strokeRect(rect.x, rect.y, rect.width, rect.height);

  const inset = 6;
  const imageX = rect.x + inset;
  const imageY = rect.y + inset;
  const imageWidth = rect.width - (inset * 2);
  const imageHeight = rect.height - 68 - inset;
  context.fillStyle = "#06121a";
  context.fillRect(imageX, imageY, imageWidth, imageHeight);
  if (image) drawContainedImage(context, image, imageX, imageY, imageWidth, imageHeight);
  else drawMissingCard(context, entry, imageX, imageY, imageWidth, imageHeight, channel);

  const badgeWidth = Math.max(74, Math.round(rect.width * .29));
  const badgeHeight = 52;
  const badgeX = rect.x + rect.width - badgeWidth - 12;
  const badgeY = rect.y + imageHeight - 42;
  context.fillStyle = "rgba(1, 6, 10, .94)";
  context.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
  context.strokeStyle = channel;
  context.lineWidth = 2;
  context.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);
  context.fillStyle = "#f5fdff";
  context.font = `900 ${Math.max(27, Math.round(rect.width * .105))}px Rajdhani, Arial, sans-serif`;
  context.textAlign = "center";
  context.fillText(`${entry.quantity}X`, badgeX + (badgeWidth / 2), badgeY + 37);
  context.textAlign = "left";

  const footerY = rect.y + rect.height - 62;
  context.fillStyle = hexToRgba(channel, .1);
  context.fillRect(rect.x + 1, footerY, rect.width - 2, 61);
  context.fillStyle = channel;
  context.font = "800 15px Rajdhani, Arial, sans-serif";
  context.fillText(`${entry.cardNumber}  //  ${entry.cardType}`, rect.x + 12, footerY + 20);
  context.fillStyle = "#e5f9ff";
  context.font = "800 19px Rajdhani, Arial, sans-serif";
  context.fillText(trimCanvasText(context, entry.cardName.toUpperCase(), rect.width - 24), rect.x + 12, footerY + 45);
  context.restore();
}

function drawSheetFooter(context, model, layout, primary) {
  const y = layout.height - FOOTER_HEIGHT;
  context.fillStyle = "rgba(1, 7, 12, .96)";
  context.fillRect(0, y, layout.width, FOOTER_HEIGHT);
  context.strokeStyle = hexToRgba(primary, .34);
  context.beginPath();
  context.moveTo(layout.margin, y);
  context.lineTo(layout.width - layout.margin, y);
  context.stroke();
  context.fillStyle = "#e7fbff";
  context.font = "800 22px Rajdhani, Arial, sans-serif";
  context.fillText("READ THE FIELD. BUILD THE ADVANTAGE.", layout.margin, y + 38);
  context.fillStyle = "#66828d";
  context.font = "700 16px Rajdhani, Arial, sans-serif";
  context.fillText("Independent community project · Card artwork belongs to its respective rights holders.", layout.margin, y + 64);
  context.textAlign = "right";
  context.fillStyle = primary;
  context.font = "900 24px Rajdhani, Arial, sans-serif";
  context.fillText("TCGTD.COM.BR", layout.width - layout.margin, y + 44);
  context.textAlign = "left";
}

function drawMetric(context, x, y, label, value, tone) {
  context.fillStyle = "#65808c";
  context.font = "800 14px Rajdhani, Arial, sans-serif";
  context.fillText(label, x, y + 14);
  context.fillStyle = tone;
  context.font = "900 38px Rajdhani, Arial, sans-serif";
  context.fillText(trimCanvasText(context, value, 146), x, y + 52);
}

function drawCurve(context, curve, x, y, width, height, tone) {
  const entries = curve.length ? curve.slice(0, 7) : [{ label: "—", count: 0 }];
  const max = Math.max(1, ...entries.map((entry) => entry.count));
  const gap = 6;
  const barWidth = Math.max(8, Math.floor((width - (gap * (entries.length - 1))) / entries.length));
  context.fillStyle = "#65808c";
  context.font = "800 13px Rajdhani, Arial, sans-serif";
  context.fillText("COST CURVE", x, y + 12);
  entries.forEach((entry, index) => {
    const barHeight = Math.max(3, Math.round((entry.count / max) * (height - 28)));
    const barX = x + (index * (barWidth + gap));
    context.fillStyle = hexToRgba(tone, .18);
    context.fillRect(barX, y + 20, barWidth, height - 20);
    context.fillStyle = tone;
    context.fillRect(barX, y + height - barHeight, barWidth, barHeight);
    context.fillStyle = "#b9d1da";
    context.font = "800 11px Rajdhani, Arial, sans-serif";
    context.textAlign = "center";
    context.fillText(entry.label, barX + (barWidth / 2), y + height + 14);
  });
  context.textAlign = "left";
}

function drawChip(context, x, y, text, tone) {
  context.font = "800 15px Rajdhani, Arial, sans-serif";
  const width = Math.min(220, Math.ceil(context.measureText(String(text)).width) + 28);
  context.fillStyle = hexToRgba(tone, .08);
  context.fillRect(x, y, width, 28);
  context.strokeStyle = hexToRgba(tone, .5);
  context.strokeRect(x, y, width, 28);
  context.fillStyle = tone;
  context.fillText(trimCanvasText(context, String(text).toUpperCase(), width - 18), x + 9, y + 19);
}

function drawFallbackMark(context, centerX, centerY, tone) {
  context.save();
  context.translate(centerX, centerY);
  context.strokeStyle = tone;
  context.lineWidth = 4;
  [18, 36, 52].forEach((radius) => {
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.stroke();
  });
  context.fillStyle = tone;
  context.beginPath();
  context.arc(0, 0, 9, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawMissingCard(context, entry, x, y, width, height, tone) {
  context.save();
  context.fillStyle = "#07151e";
  context.fillRect(x, y, width, height);
  context.strokeStyle = hexToRgba(tone, .22);
  context.lineWidth = 1;
  for (let offset = -height; offset < width; offset += 30) {
    context.beginPath();
    context.moveTo(x + offset, y + height);
    context.lineTo(x + offset + height, y);
    context.stroke();
  }
  context.fillStyle = tone;
  context.font = "900 22px Rajdhani, Arial, sans-serif";
  context.textAlign = "center";
  context.fillText(entry.cardNumber, x + (width / 2), y + (height / 2));
  context.textAlign = "left";
  context.restore();
}

function drawContainedImage(context, image, x, y, width, height) {
  const sourceWidth = image.width || image.naturalWidth;
  const sourceHeight = image.height || image.naturalHeight;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const renderWidth = sourceWidth * scale;
  const renderHeight = sourceHeight * scale;
  context.drawImage(image, x + ((width - renderWidth) / 2), y + ((height - renderHeight) / 2), renderWidth, renderHeight);
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) visible[maxLines - 1] = trimCanvasText(context, `${visible[maxLines - 1]}…`, maxWidth);
  visible.forEach((line, index) => context.fillText(line, x, y + (index * lineHeight)));
}

function trimCanvasText(context, text, maxWidth) {
  const value = String(text || "");
  if (context.measureText(value).width <= maxWidth) return value;
  let shortened = value;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened.trim()}…`;
}

function hexToRgba(hex, alpha) {
  const value = String(hex || "#46cfff").replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((char) => `${char}${char}`).join("") : value;
  const number = Number.parseInt(normalized, 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}
