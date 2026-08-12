import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";

test("document metadata exposes an absolute canonical social card", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /property="og:url" content="https:\/\/tcgtd\.com\.br\/"/);
  assert.match(html, /property="og:image" content="https:\/\/tcgtd\.com\.br\/assets\/og-tcg-tactical-database-v2\.png"/);
  assert.match(html, /property="og:image:width" content="1672"/);
  assert.match(html, /property="og:image:height" content="941"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /rel="canonical" href="https:\/\/tcgtd\.com\.br\/"/);
  assert.doesNotMatch(html, /__SITE_ORIGIN__/);
});

test("deployment worker canonicalizes the www hostname", async () => {
  const response = await worker.fetch(new Request("https://www.tcgtd.com.br/community/events?country=BR"), {});
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://tcgtd.com.br/community/events?country=BR");
});

test("deployment worker serves SPA routes and resolves absolute social metadata", async () => {
  const env = {
    ASSETS: {
      async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === "/") {
          return new Response(
            '<html><meta property="og:image" content="__SITE_ORIGIN__/assets/og.png"></html>',
            { headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        return new Response(null, { status: 307, headers: { location: "/" } });
      },
    },
  };

  const response = await worker.fetch(new Request("https://deck.example/decks", {
    headers: { accept: "text/html" },
  }), env);

  assert.equal(response.status, 200);
  assert.match(await response.text(), /https:\/\/deck\.example\/assets\/og\.png/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
});

test("deployment worker preserves static assets and applies safe caching", async () => {
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
  assert.match(response.headers.get("cache-control"), /max-age=86400/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await response.text(), "image-bytes");
});

test("health endpoint reports release and persistence readiness", async () => {
  const withoutDatabase = await worker.fetch(new Request("https://deck.example/api/health"), {});
  assert.equal(withoutDatabase.status, 200);
  assert.deepEqual((await withoutDatabase.json()).persistence, "unavailable");

  const withDatabase = await worker.fetch(new Request("https://deck.example/api/health"), { DB: {} });
  const payload = await withDatabase.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.persistence, "online");
  assert.equal(payload.release.channel, "public-alpha");
});

test("deck assistant status reports whether a remote provider is configured", async () => {
  const missing = await worker.fetch(new Request("https://deck.example/api/deck-assistant"), {});
  assert.deepEqual(await missing.json(), { configured: false, provider: "none", model: "", authenticated: false, requiresAuthentication: true, accessPolicy: "premium" });

  const configured = await worker.fetch(new Request("https://deck.example/api/deck-assistant"), {
    GEMINI_API_KEY: "test-secret",
  });
  assert.deepEqual(await configured.json(), {
    configured: true,
    provider: "gemini",
    model: "gemini-3.6-flash",
    authenticated: false,
    requiresAuthentication: true,
    accessPolicy: "premium",
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
  assert.equal(payload.user.plan, "free");
  assert.equal(payload.user.premium, false);
});

test("platform session synchronizes the hosted pilot and resolves an active tier", async () => {
  const database = createD1Mock({ provider: "patreon", tier: "newtype", status: "active", expiration: null });
  const response = await worker.fetch(new Request("https://deck.example/api/auth/session", {
    headers: {
      "oai-authenticated-user-id": "user_456",
      "oai-authenticated-user-email": "newtype@example.com",
      "oai-authenticated-user-full-name": "Amuro%20Ray",
      "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
    },
  }), { DB: database });
  const payload = await response.json();
  assert.equal(payload.user.publicName, "Amuro Ray");
  assert.equal(payload.user.plan, "newtype");
  assert.equal(payload.user.premium, true);
  assert.deepEqual(payload.user.entitlements, ["forge.remote_ai", "meta.advanced", "statistics.advanced"]);
  assert.match(database.writes[0].sql, /INSERT INTO users/);
});

test("feedback endpoint validates and persists an alpha report", async () => {
  const database = createD1Mock();
  const response = await worker.fetch(new Request("https://deck.example/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      category: "layout",
      message: "The mobile tactical header overlaps the content grid.",
      contactEmail: "pilot@example.com",
      pagePath: "/cards",
      locale: "en",
    }),
  }), { DB: database });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).ok, true);
  assert.match(database.writes.at(-1).sql, /INSERT INTO feedback/);
  assert.equal(database.writes.at(-1).args[2], "layout");
});

test("feedback endpoint rejects underspecified reports", async () => {
  const response = await worker.fetch(new Request("https://deck.example/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ category: "bug", message: "Too short" }),
  }), { DB: createD1Mock() });
  assert.equal(response.status, 400);
});

test("community schedule administration stays private while the public calendar remains readable", async () => {
  const publicResponse = await worker.fetch(new Request("https://deck.example/api/community/schedules"), {});
  assert.equal(publicResponse.status, 200);
  assert.deepEqual(await publicResponse.json(), { available: false, schedules: [], exceptions: [] });

  const blocked = await worker.fetch(new Request("https://deck.example/api/community/schedules", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ venueName: "Moki Toys", name: "Weekly", weekday: 1 }),
  }), { DB: createCommunityD1Mock() });
  assert.equal(blocked.status, 401);
  assert.equal((await blocked.json()).code, "authentication_required");

  const managed = await worker.fetch(new Request("https://deck.example/api/community/schedules/manage", {
    headers: {
      "oai-authenticated-user-id": "schedule-admin",
      "oai-authenticated-user-email": "owner@example.com",
    },
  }), { DB: createCommunityD1Mock(), COMMUNITY_SCHEDULE_ADMIN_EMAILS: "owner@example.com" });
  assert.equal(managed.status, 200);
  assert.deepEqual(await managed.json(), { available: true, schedules: [], exceptions: [] });
});

test("community schedule creation writes a venue and a recurring schedule for an allowlisted manager", async () => {
  const database = createCommunityD1Mock();
  const response = await worker.fetch(new Request("https://deck.example/api/community/schedules", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "oai-authenticated-user-id": "schedule-admin",
      "oai-authenticated-user-email": "owner@example.com",
    },
    body: JSON.stringify({
      venueName: "Moki Toys",
      city: "Sao Paulo",
      country: "Brasil",
      name: "Gundam Weekly",
      weekday: 1,
      startTime: "19:30",
      registrationUrl: "https://example.com/register",
    }),
  }), { DB: database, COMMUNITY_SCHEDULE_ADMIN_EMAILS: "owner@example.com" });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).ok, true);
  assert.equal(database.writes.length, 2);
  assert.match(database.writes[0].sql, /INSERT INTO community_venues/);
  assert.match(database.writes[1].sql, /INSERT INTO community_weekly_schedules/);
  assert.equal(database.writes[1].args[2], "Gundam Weekly");
  assert.equal(database.writes[1].args[3], 1);
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

test("deck assistant protects configured AI from authenticated free accounts", async () => {
  const response = await worker.fetch(new Request("https://deck.example/api/deck-assistant", {
    method: "POST",
    headers: { "content-type": "application/json", "oai-authenticated-user-id": "free_pilot" },
    body: JSON.stringify({ message: "Analyze", context: { cards: [] } }),
  }), { GEMINI_API_KEY: "test-secret", DB: createD1Mock() });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "premium_required");
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
    }), { GEMINI_API_KEY: "test-secret", FORGE_AI_ALLOW_FREE: "true" });
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

function createD1Mock(subscription = null) {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/FROM subscriptions/.test(sql)) return subscription;
              if (/FROM users/.test(sql)) return null;
              return null;
            },
            async run() {
              writes.push({ sql, args });
              return { success: true };
            },
          };
        },
      };
    },
  };
}

function createCommunityD1Mock() {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/SELECT id FROM community_venues/.test(sql)) return null;
              if (/SELECT id FROM community_weekly_schedules/.test(sql)) return { id: args[0] };
              return null;
            },
            async all() {
              return { results: [] };
            },
            async run() {
              writes.push({ sql, args });
              return { success: true, meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}
