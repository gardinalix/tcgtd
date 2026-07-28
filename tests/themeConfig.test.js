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
  }
});
