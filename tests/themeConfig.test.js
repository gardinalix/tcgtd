import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { THEME_OPTIONS } from "../src/data/themeConfig.js";

test("every Gundam theme uses a full-size, uncropped source image", () => {
  for (const theme of THEME_OPTIONS) {
    assert.doesNotMatch(theme.gundamImage, /-hud\.png$/);

    const assetUrl = new URL(`../web${theme.gundamImage}`, import.meta.url);
    assert.equal(
      existsSync(fileURLToPath(assetUrl)),
      true,
      `Missing image for ${theme.gundamName}: ${theme.gundamImage}`,
    );

    const backdropUrl = new URL(`../web${theme.backdropImage}`, import.meta.url);
    assert.equal(
      existsSync(fileURLToPath(backdropUrl)),
      true,
      `Missing cockpit backdrop for ${theme.gundamName}: ${theme.backdropImage}`,
    );
  }
});

test("every Gundam theme defines a complete and visibly distinct HUD palette", () => {
  const primaryColors = new Set();

  for (const theme of THEME_OPTIONS) {
    assert.match(theme.palette.primary, /^#[0-9a-f]{6}$/i);
    assert.match(theme.palette.secondary, /^#[0-9a-f]{6}$/i);
    assert.match(theme.palette.accentRgb, /^\d{1,3}, \d{1,3}, \d{1,3}$/);
    assert.ok(theme.backgroundPosition);
    assert.ok(theme.backgroundSize);
    primaryColors.add(theme.palette.primary.toLowerCase());
  }

  assert.equal(primaryColors.size, THEME_OPTIONS.length);
});
