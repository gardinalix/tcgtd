import assert from "node:assert/strict";
import test from "node:test";
import { injectWebAnalytics } from "../worker/index.js";

const TOKEN = "bc40a2d1b5834453aba85c1b9a3054da";
const HTML = "<!doctype html><html><body><main>TCGTD</main></body></html>";

test("web analytics stays disabled without a configured runtime token", () => {
  assert.equal(injectWebAnalytics(HTML, ""), HTML);
  assert.equal(injectWebAnalytics(HTML, "invalid token"), HTML);
});

test("web analytics leaves local Vite previews untouched", () => {
  assert.equal(injectWebAnalytics("<main>Vite preview</main>", TOKEN), "<main>Vite preview</main>");
});

test("web analytics injects Cloudflare's SPA-aware beacon once in hosted HTML", () => {
  const injected = injectWebAnalytics(HTML, TOKEN);
  assert.match(injected, /id="cloudflare-web-analytics"/);
  assert.match(injected, /type="module"/);
  assert.match(injected, /https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/);
  assert.match(injected, new RegExp(TOKEN));
  assert.equal(injectWebAnalytics(injected, TOKEN), injected);
});
