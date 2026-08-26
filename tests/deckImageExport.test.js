import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildDeckSheetModel,
  deckSheetFilename,
  getDeckSheetLayout,
  getDeckSheetTileRect,
} from "../src/domain/deckImageExport.js";

const deckViewSource = fs.readFileSync(new URL("../src/pages/DeckViewPage.jsx", import.meta.url), "utf8");
const forgeSource = fs.readFileSync(new URL("../src/components/decks/ZeroForge.jsx", import.meta.url), "utf8");
const designerSource = fs.readFileSync(new URL("../src/components/decks/DeckDesigner.jsx", import.meta.url), "utf8");
const exportLayerSource = fs.readFileSync(new URL("../src/components/decks/DeckImageExportLayer.jsx", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("../src/ops-hud.css", import.meta.url), "utf8");

function createRows(count) {
  return Array.from({ length: count }, (_, index) => ({
    quantity: index % 4 + 1,
    card: {
      cardNumber: `GD05-${String(index + 1).padStart(3, "0")}`,
      cardName: `Card ${index + 1}`,
      cardType: index % 4 === 0 ? "COMMAND" : "UNIT",
      color: index % 2 ? "Azul" : "Vermelho",
      cost: index % 7,
      imageUrl: `./assets/card-images/GD05-${String(index + 1).padStart(3, "0")}.webp`,
    },
  }));
}

test("deck sheet model preserves the tactical deck identity and image sources", () => {
  const model = buildDeckSheetModel({
    deck: { name: "Strike Freedom", author: "Pilot 01", event: "Field Test", result: "1" },
    rows: createRows(15),
    stats: { mainCount: 50, colors: { Azul: 28, Vermelho: 22 }, curve: { 1: 12, 3: 18 } },
  });
  assert.equal(model.title, "Strike Freedom");
  assert.equal(model.author, "Pilot 01");
  assert.equal(model.mainCount, 50);
  assert.equal(model.uniqueCount, 15);
  assert.deepEqual(model.colors.map((color) => color.channel), ["blue", "red"]);
  assert.ok(model.entries.every((entry) => entry.imageUrl.startsWith("./assets/card-images/")));
  assert.equal(model.entries[0].cardType, "UNIT");
});

test("a fifteen-card deck sheet uses a five-column non-overlapping grid", () => {
  const layout = getDeckSheetLayout(15);
  const tiles = Array.from({ length: 15 }, (_, index) => getDeckSheetTileRect(index, layout));
  assert.equal(layout.columns, 5);
  assert.equal(layout.rowCount, 3);
  for (const tile of tiles) {
    assert.ok(tile.x >= layout.margin);
    assert.ok(tile.x + tile.width <= layout.width - layout.margin);
    assert.ok(tile.y >= layout.gridTop);
    assert.ok(tile.y + tile.height <= layout.height - 92);
  }
  for (let left = 0; left < tiles.length; left += 1) {
    for (let right = left + 1; right < tiles.length; right += 1) {
      const a = tiles[left];
      const b = tiles[right];
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y;
      assert.equal(overlaps, false);
    }
  }
});

test("deck sheet filenames are share-safe and identify the TCGTD format", () => {
  assert.equal(deckSheetFilename("Decisões do Piloto"), "decisoes-do-piloto-tcgtd-deck-sheet.png");
});

test("deck sheet model accepts Designer reports as deck identity", () => {
  const model = buildDeckSheetModel({
    deck: {
      title: "GQuuuuuuX Control",
      sourceDeck: { playerName: "Pilot 02", eventName: "Regional", placingLabel: "TOP 8" },
    },
    rows: createRows(2),
  });
  assert.equal(model.title, "GQuuuuuuX Control");
  assert.equal(model.author, "Pilot 02");
  assert.equal(model.event, "Regional");
  assert.equal(model.result, "TOP 8");
});

test("the deck dossier exposes a branded browser-only PNG export bay", () => {
  assert.match(deckViewSource, /EXPORTAR IMAGEM/);
  assert.match(deckViewSource, /<DeckImageExportLayer/);
  assert.match(exportLayerSource, /renderDeckSheetPng/);
  assert.match(exportLayerSource, /new ClipboardItem\(\{ "image\/png": renderState\.blob \}\)/);
  assert.match(exportLayerSource, /COPIAR IMAGEM/);
  assert.match(exportLayerSource, /Nenhuma decklist ou imagem é enviada para um serviço externo/);
  assert.match(cssSource, /Tactical Deck Sheet export bay/);
  assert.match(cssSource, /\.deck-sheet-console__preview img \{[\s\S]*?width: 100%;[\s\S]*?height: 100%;[\s\S]*?object-fit: contain;/);
});

test("Forge and Designer expose the same branded image export", () => {
  assert.match(forgeSource, /<DeckImageExportLayer/);
  assert.match(forgeSource, /EXPORT IMAGE/);
  assert.match(designerSource, /<DeckImageExportLayer/);
  assert.match(designerSource, /onExportImage/);
});
