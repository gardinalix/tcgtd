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
    if (url.pathname === "/api/deck-assistant") {
      return handleDeckAssistant(request, env);
    }
    let response = await env.ASSETS.fetch(request);

    if (response.status === 404 && request.headers.get("accept")?.includes("text/html")) {
      response = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return response;

    const headers = new Headers(response.headers);
    headers.delete("content-length");
    const html = (await response.text()).replaceAll("__SITE_ORIGIN__", url.origin);
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

const MAX_ASSISTANT_BODY_BYTES = 180_000;

export async function handleDeckAssistant(request, env) {
  const provider = resolveAssistantProvider(env);
  if (request.method === "GET") {
    return json({
      configured: Boolean(provider),
      provider: provider?.name || "none",
      model: provider?.model || "",
    });
  }
  if (request.method !== "POST") return json({ message: "Método não permitido." }, 405, { Allow: "GET, POST" });
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

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}
