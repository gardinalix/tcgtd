import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

test("the home hero visibly renders the selected mecha", () => {
  const launchCss = readFileSync(fileURLToPath(new URL("../src/launch.css", import.meta.url)), "utf8");
  const heroImageRule = launchCss.match(/\.launch-hero__visual img\s*\{([\s\S]*?)\}/)?.[1] || "";

  assert.match(heroImageRule, /display:\s*block/);
  assert.doesNotMatch(heroImageRule, /display:\s*none/);
  assert.match(heroImageRule, /opacity:\s*0\.9/);
});

test("the production orbital brand mark is available to the header and boot sequence", () => {
  const logoUrl = new URL("../web/assets/brand/tcgtd-orbital-mark-v2.png", import.meta.url);
  assert.equal(existsSync(fileURLToPath(logoUrl)), true);

  const header = readFileSync(fileURLToPath(new URL("../src/components/layout/SiteHeader.jsx", import.meta.url)), "utf8");
  const app = readFileSync(fileURLToPath(new URL("../src/App.jsx", import.meta.url)), "utf8");
  assert.match(header, /tcgtd-orbital-mark-v2\.png/);
  assert.match(app, /tcgtd-orbital-mark-v2\.png/);
});
