import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";

test("deployment worker serves SPA routes and resolves absolute social metadata", async () => {
  const env = {
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/index.html") {
          return new Response(
            '<html><meta property="og:image" content="__SITE_ORIGIN__/assets/og.png"></html>',
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        return new Response("Not found", { status: 404 });
      },
    },
  };

  const response = await worker.fetch(new Request("https://deck.example/decks", {
    headers: { accept: "text/html" },
  }), env);

  assert.equal(response.status, 200);
  assert.match(await response.text(), /https:\/\/deck\.example\/assets\/og\.png/);
});

test("deployment worker passes static assets through unchanged", async () => {
  const env = {
    ASSETS: {
      async fetch() {
        return new Response("image-bytes", { headers: { "content-type": "image/png" } });
      },
    },
  };

  const response = await worker.fetch(new Request("https://deck.example/assets/og.png"), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(await response.text(), "image-bytes");
});

