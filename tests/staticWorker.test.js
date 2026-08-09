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

test("deck assistant status reports whether a remote provider is configured", async () => {
  const missing = await worker.fetch(new Request("https://deck.example/api/deck-assistant"), {});
  assert.deepEqual(await missing.json(), { configured: false, provider: "none", model: "", authenticated: false, requiresAuthentication: true });

  const configured = await worker.fetch(new Request("https://deck.example/api/deck-assistant"), {
    GEMINI_API_KEY: "test-secret",
  });
  assert.deepEqual(await configured.json(), {
    configured: true,
    provider: "gemini",
    model: "gemini-3.6-flash",
    authenticated: false,
    requiresAuthentication: true,
  });
});

test("platform session maps hosted identity headers without exposing credentials", async () => {
  const response = await worker.fetch(new Request("https://deck.example/api/auth/session", {
    headers: {
      "oai-authenticated-user-id": "user_123",
      "oai-authenticated-user-email": "pilot@example.com",
      "oai-authenticated-user-full-name": "Test Pilot",
    },
  }), {});
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.user.id, "user_123");
  assert.equal(payload.user.publicName, "Test Pilot");
  assert.equal(payload.user.provider, "chatgpt");
});

test("deck assistant rejects anonymous remote analysis", async () => {
  const response = await worker.fetch(new Request("https://deck.example/api/deck-assistant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "Analyze", context: { cards: [] } }),
  }), { GEMINI_API_KEY: "test-secret" });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "authentication_required");
});

test("deck assistant uses Gemini structured output when its server key is configured", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamRequest;
  globalThis.fetch = async (url, init) => {
    upstreamRequest = { url, init };
    return new Response(JSON.stringify({
      id: "interaction-test",
      model: "gemini-3.6-flash",
      steps: [{
        type: "model_output",
        content: [{
          type: "text",
          text: JSON.stringify({
            message: "A curva precisa de mais cartas de custo baixo.",
            evidenceType: "inference",
            caveats: ["A amostra de meta é pequena."],
            suggestion: null,
          }),
        }],
      }],
    }), { headers: { "content-type": "application/json" } });
  };

  try {
    const response = await worker.fetch(new Request("https://deck.example/api/deck-assistant", {
      method: "POST",
      headers: { "content-type": "application/json", "oai-authenticated-user-id": "user_test" },
      body: JSON.stringify({
        message: "Analise a curva",
        context: { cards: [], deckName: "Teste" },
      }),
    }), { GEMINI_API_KEY: "test-secret" });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.provider, "gemini");
    assert.equal(payload.model, "gemini-3.6-flash");
    assert.match(payload.message, /curva/i);
    assert.equal(upstreamRequest.url, "https://generativelanguage.googleapis.com/v1beta/interactions");
    assert.equal(upstreamRequest.init.headers["x-goog-api-key"], "test-secret");
    const upstreamBody = JSON.parse(upstreamRequest.init.body);
    assert.equal(upstreamBody.response_format.mime_type, "application/json");
    assert.match(upstreamBody.input, /Analise a curva/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
