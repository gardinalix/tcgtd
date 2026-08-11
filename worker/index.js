/**
 * Cloudflare Worker entry point used by Sites deployments.
 * Local development continues to use the existing Vite server.
 */
import {
  DECK_ASSISTANT_RESPONSE_SCHEMA,
  FORGE_ASSISTANT_MODEL,
  FORGE_ASSISTANT_SYSTEM_PROMPT,
  GEMINI_ASSISTANT_MODEL,
  GEMINI_DECK_ASSISTANT_SCHEMA,
} from "./deckAssistantConfig.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return handleHealth(request, env);
    }
    if (url.pathname === "/api/auth/session") {
      return handlePlatformSession(request, env);
    }
    if (url.pathname === "/api/feedback") {
      return handleFeedback(request, env);
    }
    if (url.pathname === "/api/deck-assistant") {
      return handleDeckAssistant(request, env);
    }
    const isSpaNavigation = request.method === "GET"
      && request.headers.get("accept")?.includes("text/html");
    const assetRequest = isSpaNavigation
      ? new Request(new URL("/index.html", url), request)
      : request;
    const response = await env.ASSETS.fetch(assetRequest);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return securedAssetResponse(response, url.pathname);

    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.set("cache-control", "no-cache");
    headers.set("x-robots-tag", "noindex, nofollow");
    applySecurityHeaders(headers);
    const html = (await response.text()).replaceAll("__SITE_ORIGIN__", url.origin);
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

const RELEASE = Object.freeze({ channel: "public-alpha", version: "alpha.1", releasedAt: "2026-08-10" });
const MAX_ASSISTANT_BODY_BYTES = 180_000;
const MAX_FEEDBACK_BODY_BYTES = 16_000;
const FORGE_RATE_LIMIT = 12;
const FORGE_RATE_WINDOW_MS = 10 * 60 * 1_000;
const FEEDBACK_RATE_LIMIT = 4;
const FEEDBACK_RATE_WINDOW_MS = 15 * 60 * 1_000;
const forgeRateBuckets = new Map();
const feedbackRateBuckets = new Map();
const FEEDBACK_CATEGORIES = new Set(["bug", "data", "layout", "rights", "suggestion"]);

export function handleHealth(request, env = {}) {
  if (request.method !== "GET") return json({ message: "Método não permitido." }, 405, { Allow: "GET" });
  return json({
    ok: true,
    service: "tcg-tactical-database",
    release: RELEASE,
    persistence: env.DB ? "online" : "unavailable",
    forge: resolveAssistantProvider(env) ? "configured" : "local-only",
  });
}

export async function handlePlatformSession(request, env = {}) {
  if (request.method !== "GET") return json({ message: "Método não permitido." }, 405, { Allow: "GET" });
  const user = platformUserFromRequest(request);
  if (!user) return json({ user: null });

  let access = freeAccess();
  if (env.DB) {
    try {
      access = await synchronizeUser(env.DB, user);
    } catch {
      access = freeAccess();
    }
  }
  return json({ user: { ...user, ...access } });
}

export async function handleFeedback(request, env = {}) {
  if (request.method === "GET") {
    return json({
      available: Boolean(env.DB),
      release: RELEASE,
      categories: [...FEEDBACK_CATEGORIES],
    });
  }
  if (request.method !== "POST") return json({ message: "Método não permitido." }, 405, { Allow: "GET, POST" });
  if (!env.DB) return json({ message: "O canal de feedback ainda não está disponível." }, 503);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_FEEDBACK_BODY_BYTES) return json({ message: "Relatório acima do limite permitido." }, 413);

  let input;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_FEEDBACK_BODY_BYTES) {
      return json({ message: "Relatório acima do limite permitido." }, 413);
    }
    input = JSON.parse(raw);
  } catch {
    return json({ message: "Relatório inválido." }, 400);
  }

  if (String(input?.website || "").trim()) {
    return json({ ok: true, received: true }, 202);
  }

  const category = FEEDBACK_CATEGORIES.has(input?.category) ? input.category : "bug";
  const message = String(input?.message || "").trim();
  const contactEmail = String(input?.contactEmail || "").trim().toLowerCase();
  const pagePath = sanitizePagePath(input?.pagePath);
  const locale = input?.locale === "en" ? "en" : "pt-BR";
  if (message.length < 20 || message.length > 3_000) {
    return json({ message: "Descreva o relatório usando entre 20 e 3000 caracteres." }, 400);
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return json({ message: "Informe um e-mail válido ou deixe o campo vazio." }, 400);
  }

  const platformUser = platformUserFromRequest(request);
  const rateKey = platformUser?.id
    ? `user:${platformUser.id}`
    : `anonymous:${request.headers.get("cf-connecting-ip") || "local"}`;
  const rateLimit = consumeRateLimit(feedbackRateBuckets, rateKey, FEEDBACK_RATE_LIMIT, FEEDBACK_RATE_WINDOW_MS);
  if (!rateLimit.allowed) {
    return json({ message: "Muitos relatórios em sequência. Aguarde antes de transmitir novamente." }, 429, {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  try {
    if (platformUser) await synchronizeUser(env.DB, platformUser);
    const id = createId("feedback");
    const createdAt = new Date().toISOString();
    await env.DB.prepare(`
      INSERT INTO feedback (
        id, user_id, category, message, contact_email, page_path, locale, release_channel, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)
    `).bind(
      id,
      platformUser?.id || null,
      category,
      message,
      contactEmail.slice(0, 254),
      pagePath,
      locale,
      RELEASE.channel,
      createdAt,
    ).run();
    return json({ ok: true, id, receivedAt: createdAt }, 201);
  } catch {
    return json({ message: "O canal recebeu a transmissão, mas não conseguiu registrá-la. Tente novamente." }, 503);
  }
}

export async function handleDeckAssistant(request, env) {
  const provider = resolveAssistantProvider(env);
  const platformUser = platformUserFromRequest(request);
  if (request.method === "GET") {
    return json({
      configured: Boolean(provider),
      provider: provider?.name || "none",
      model: provider?.model || "",
      authenticated: Boolean(platformUser),
      requiresAuthentication: env.FORGE_AI_ALLOW_ANONYMOUS !== "true",
      accessPolicy: env.FORGE_AI_ALLOW_FREE === "true" ? "authenticated" : "premium",
    });
  }
  if (request.method !== "POST") return json({ message: "Método não permitido." }, 405, { Allow: "GET, POST" });
  const access = await authorizeForgeRequest(request, env, platformUser);
  if (!access.allowed) {
    const premiumRequired = access.code === "premium_required";
    return json({
      message: premiumRequired
        ? "A análise remota da FORJA exige um entitlement premium ativo. A forja local continua disponível."
        : "Entre no sistema para acessar a análise remota da FORJA.",
      code: premiumRequired ? "premium_required" : "authentication_required",
      ...(premiumRequired ? {} : { signInUrl: "/signin-with-chatgpt?return_to=/decks" }),
    }, premiumRequired ? 403 : 401);
  }
  const rateLimit = consumeForgeRateLimit(access.key);
  if (!rateLimit.allowed) {
    return json({
      message: "Limite temporário da FORJA atingido. Aguarde antes de transmitir novamente.",
      code: "rate_limited",
    }, 429, { "Retry-After": String(rateLimit.retryAfterSeconds) });
  }
  if (!provider) {
    return json({
      message: "O provedor remoto da FORJA ainda não está configurado.",
      code: "provider_not_configured",
    }, 503);
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_ASSISTANT_BODY_BYTES) return json({ message: "Contexto do deck excede o limite permitido." }, 413);

  let input;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_ASSISTANT_BODY_BYTES) {
      return json({ message: "Contexto do deck excede o limite permitido." }, 413);
    }
    input = JSON.parse(raw);
  } catch {
    return json({ message: "Requisição inválida." }, 400);
  }

  const message = String(input?.message || "").trim().slice(0, 2_000);
  const context = sanitizeContext(input?.context);
  if (!message || !context) return json({ message: "Mensagem e contexto estruturado são obrigatórios." }, 400);

  const conversation = sanitizeConversation(input?.conversation);
  try {
    return provider.name === "gemini"
      ? await runGeminiAssistant(env, provider.model, message, context, conversation)
      : await runOpenAIAssistant(env, provider.model, message, context, conversation);
  } catch {
    return json({
      message: "Não foi possível alcançar o provedor de IA da FORJA.",
      code: "provider_unreachable",
    }, 502);
  }
}

function platformUserFromRequest(request) {
  const id = request.headers.get("oai-authenticated-user-id") || "";
  if (!id) return null;
  const email = request.headers.get("oai-authenticated-user-email") || "";
  const encodedName = request.headers.get("oai-authenticated-user-full-name") || "";
  const nameEncoding = request.headers.get("oai-authenticated-user-full-name-encoding") || "";
  let fullName = encodedName;
  if (encodedName && nameEncoding === "percent-encoded-utf-8") {
    try {
      fullName = decodeURIComponent(encodedName);
    } catch {
      fullName = encodedName;
    }
  }
  fullName ||= email.split("@")[0] || "Pilot";
  return {
    id,
    email,
    displayName: fullName,
    publicName: fullName,
    username: email.split("@")[0] || `pilot-${id.slice(-8)}`,
    role: "user",
    provider: "chatgpt",
    providerId: id,
    emailVerified: Boolean(email),
  };
}

async function authorizeForgeRequest(request, env, platformUser) {
  if (platformUser) {
    if (env.FORGE_AI_ALLOW_FREE === "true") return { allowed: true, key: `user:${platformUser.id}` };
    if (!env.DB) return { allowed: false, key: "", code: "premium_required" };
    try {
      const access = await synchronizeUser(env.DB, platformUser);
      if (access.entitlements.includes("forge.remote_ai")) {
        return { allowed: true, key: `user:${platformUser.id}` };
      }
    } catch {
      return { allowed: false, key: "", code: "premium_required" };
    }
    return { allowed: false, key: "", code: "premium_required" };
  }
  if (env.FORGE_AI_ALLOW_ANONYMOUS === "true") {
    return { allowed: true, key: `anonymous:${request.headers.get("cf-connecting-ip") || "local"}` };
  }
  return { allowed: false, key: "", code: "authentication_required" };
}

function consumeForgeRateLimit(key, now = Date.now()) {
  return consumeRateLimit(forgeRateBuckets, key, FORGE_RATE_LIMIT, FORGE_RATE_WINDOW_MS, now);
}

function consumeRateLimit(buckets, key, limit, windowMs, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1_000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function freeAccess() {
  return { plan: "free", premium: false, entitlements: [] };
}

function accessFromSubscription(subscription) {
  if (!subscription || subscription.status !== "active") return freeAccess();
  const expiration = subscription.expiration ? Date.parse(subscription.expiration) : null;
  if (Number.isFinite(expiration) && expiration <= Date.now()) return freeAccess();
  const tier = ["supporter", "newtype", "master"].includes(subscription.tier) ? subscription.tier : "free";
  if (tier === "free") return freeAccess();
  return {
    plan: tier,
    premium: true,
    entitlements: tier === "supporter"
      ? ["forge.remote_ai"]
      : ["forge.remote_ai", "meta.advanced", "statistics.advanced"],
  };
}

async function synchronizeUser(db, user) {
  const now = new Date().toISOString();
  const existing = await db.prepare(`
    SELECT id, email, nickname, provider, last_seen_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(user.id).first();

  if (!existing) {
    await db.prepare(`
      INSERT INTO users (id, email, nickname, provider, created_at, updated_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(user.id, user.email, user.publicName, user.provider, now, now, now).run();
  } else {
    const lastSeenAt = Date.parse(existing.last_seen_at || "");
    const stale = !Number.isFinite(lastSeenAt) || Date.now() - lastSeenAt >= 24 * 60 * 60 * 1_000;
    const changed = existing.email !== user.email || existing.nickname !== user.publicName || existing.provider !== user.provider;
    if (stale || changed) {
      await db.prepare(`
        UPDATE users
        SET email = ?, nickname = ?, provider = ?, updated_at = ?, last_seen_at = ?
        WHERE id = ?
      `).bind(user.email, user.publicName, user.provider, now, now, user.id).run();
    }
  }

  const subscription = await db.prepare(`
    SELECT provider, tier, status, expiration
    FROM subscriptions
    WHERE user_id = ?
      AND status = 'active'
      AND (expiration IS NULL OR expiration > ?)
    ORDER BY updated_at DESC
    LIMIT 1
  `).bind(user.id, now).first();
  return accessFromSubscription(subscription);
}

function sanitizePagePath(value) {
  const path = String(value || "/").trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return (path.startsWith("/") ? path : "/").slice(0, 240);
}

function createId(prefix) {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${value}`;
}

function resolveAssistantProvider(env = {}) {
  if (env.GEMINI_API_KEY) {
    return { name: "gemini", model: String(env.GEMINI_MODEL || GEMINI_ASSISTANT_MODEL) };
  }
  if (env.OPENAI_API_KEY) {
    return { name: "openai", model: String(env.OPENAI_MODEL || FORGE_ASSISTANT_MODEL) };
  }
  return null;
}

async function runGeminiAssistant(env, model, message, context, conversation) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": env.GEMINI_API_KEY,
      "api-revision": "2026-05-20",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      system_instruction: `${FORGE_ASSISTANT_SYSTEM_PROMPT}\n\nQuando não houver troca segura, retorne remove e add como arrays vazios no objeto suggestion.`,
      input: JSON.stringify({
        request: message,
        deckContext: context,
        recentConversation: conversation,
      }),
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: GEMINI_DECK_ASSISTANT_SCHEMA,
      },
      store: false,
    }),
  });

  if (!response.ok) return providerError(response);

  const payload = await response.json();
  return parsedProviderResponse({
    id: payload.id,
    outputText: extractGeminiOutputText(payload.steps),
    provider: "gemini",
    model: String(payload.model || model),
  });
}

async function runOpenAIAssistant(env, model, message, context, conversation) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 2_000,
      input: [
        { role: "system", content: FORGE_ASSISTANT_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            request: message,
            deckContext: context,
            recentConversation: conversation,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "forge_deck_analysis",
          strict: true,
          schema: DECK_ASSISTANT_RESPONSE_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    return providerError(response);
  }

  const payload = await response.json();
  return parsedProviderResponse({
    id: payload.id,
    outputText: payload.output_text || extractOutputText(payload.output),
    provider: "openai",
    model,
  });
}

function parsedProviderResponse({ id, outputText, provider, model }) {
  try {
    return json({
      id: id || `assistant-${Date.now().toString(36)}`,
      ...JSON.parse(outputText),
      provider,
      model,
    });
  } catch {
    return json({ message: "O provedor retornou uma resposta que não pôde ser validada.", code: "invalid_provider_response" }, 502);
  }
}

async function providerError(response) {
  const upstream = await response.json().catch(() => ({}));
  return json({
    message: "O núcleo estratégico remoto não concluiu a análise.",
    code: "provider_error",
    detail: String(upstream?.error?.code || upstream?.error?.status || response.status),
  }, 502);
}

function sanitizeContext(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.cards)) return null;
  return {
    version: String(value.version || ""),
    deckId: String(value.deckId || "").slice(0, 160),
    deckName: String(value.deckName || "").slice(0, 160),
    selectedMetaId: String(value.selectedMetaId || "current").slice(0, 80),
    format: String(value.format || "current").slice(0, 80),
    colors: (value.colors || []).map(String).slice(0, 4),
    cards: value.cards.slice(0, 80).map((card) => ({
      cardId: String(card.cardId || "").slice(0, 40),
      name: String(card.name || "").slice(0, 160),
      quantity: Math.max(0, Math.min(4, Number(card.quantity || 0))),
      type: String(card.type || "UNKNOWN").slice(0, 40),
      color: String(card.color || "").slice(0, 40),
      cost: Number.isFinite(Number(card.cost)) ? Number(card.cost) : null,
      traits: (card.traits || []).map(String).slice(0, 12),
      tags: (card.tags || []).map(String).slice(0, 12),
      effectText: String(card.effectText || "").slice(0, 800),
    })),
    statistics: value.statistics || {},
    validation: value.validation || {},
    sourceTournament: value.sourceTournament || null,
    sourceDiff: value.sourceDiff || null,
    recentChanges: (value.recentChanges || []).slice(-20),
    relevantMetaDecks: (value.relevantMetaDecks || []).slice(0, 8),
  };
}

function sanitizeConversation(value) {
  return (Array.isArray(value) ? value : []).slice(-8).map((message) => ({
    role: message?.role === "assistant" ? "assistant" : "user",
    content: String(message?.content || "").slice(0, 1_000),
  }));
}

function extractOutputText(output) {
  for (const item of Array.isArray(output) ? output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

function extractGeminiOutputText(steps) {
  for (const step of Array.isArray(steps) ? steps : []) {
    if (step?.type !== "model_output") continue;
    for (const content of Array.isArray(step.content) ? step.content : []) {
      if (content?.type === "text" && content.text) return content.text;
    }
  }
  return "";
}

function securedAssetResponse(response, pathname) {
  const headers = new Headers(response.headers);
  applySecurityHeaders(headers);
  if (/\.(?:js|css)$/i.test(pathname) && /-[a-z0-9_-]{8,}\.(?:js|css)$/i.test(pathname)) {
    headers.set("cache-control", "public, max-age=31536000, immutable");
  } else if (pathname.startsWith("/assets/")) {
    headers.set("cache-control", "public, max-age=86400, stale-while-revalidate=604800");
  } else if (/\/(?:app-data|home-data)\.json$/i.test(pathname)) {
    headers.set("cache-control", "public, max-age=300, stale-while-revalidate=86400");
  } else if (pathname === "/robots.txt") {
    headers.set("cache-control", "no-cache");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function applySecurityHeaders(headers) {
  headers.set("content-security-policy", [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; "));
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
}

function json(payload, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  applySecurityHeaders(headers);
  return new Response(JSON.stringify(payload), {
    status,
    headers,
  });
}
