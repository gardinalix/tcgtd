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
    if (url.hostname.toLowerCase() === "www.tcgtd.com.br") {
      url.hostname = "tcgtd.com.br";
      return Response.redirect(url.toString(), 308);
    }
    if (url.pathname === "/api/health") {
      return handleHealth(request, env);
    }
    if (url.pathname === "/api/auth/session") {
      return handlePlatformSession(request, env);
    }
    if (url.pathname === "/api/feedback") {
      return handleFeedback(request, env);
    }
    if (url.pathname === "/api/community/schedules" || url.pathname.startsWith("/api/community/schedules/")) {
      return handleCommunitySchedules(request, env);
    }
    if (url.pathname === "/api/deck-assistant") {
      return handleDeckAssistant(request, env);
    }
    if (url.pathname === "/go/ligagundam") {
      return handlePartnerRedirect(request, env);
    }
    const isSpaNavigation = request.method === "GET"
      && request.headers.get("accept")?.includes("text/html");
    const assetRequest = isSpaNavigation
      ? new Request(new URL("/", url), request)
      : request;
    const response = await env.ASSETS.fetch(assetRequest);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return securedAssetResponse(response, url.pathname);

    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.set("cache-control", "no-cache");
    headers.set("x-robots-tag", "noindex, nofollow");
    applySecurityHeaders(headers);
    const html = injectWebAnalytics(
      (await response.text()).replaceAll("__SITE_ORIGIN__", url.origin),
      env.CLOUDFLARE_WEB_ANALYTICS_TOKEN,
    );
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
const PARTNER_CLICK_RATE_LIMIT = 60;
const PARTNER_CLICK_RATE_WINDOW_MS = 10 * 60 * 1_000;
const forgeRateBuckets = new Map();
const feedbackRateBuckets = new Map();
const partnerClickRateBuckets = new Map();
const FEEDBACK_CATEGORIES = new Set(["bug", "data", "layout", "rights", "suggestion"]);
const LIGAGUNDAM_HOSTS = new Set(["ligagundam.com.br", "www.ligagundam.com.br"]);

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

export async function handlePartnerRedirect(request, env = {}) {
  if (request.method !== "GET") return json({ message: "Método não permitido." }, 405, { Allow: "GET" });

  const url = new URL(request.url);
  const destination = safeLigaGundamDestination(url.searchParams.get("to"));
  if (!destination) return json({ message: "Oferta da LigaGundam inválida ou indisponível." }, 400);

  const rateKey = `anonymous:${request.headers.get("cf-connecting-ip") || "local"}`;
  const rateLimit = consumeRateLimit(partnerClickRateBuckets, rateKey, PARTNER_CLICK_RATE_LIMIT, PARTNER_CLICK_RATE_WINDOW_MS);
  if (rateLimit.allowed && env.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO partner_offer_clicks (
          id, partner_id, source_code, card_number, printing_id, page_path, destination_host, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        createId("partnerclick"),
        "ligagundam",
        "LIGA",
        sanitizePartnerValue(url.searchParams.get("card"), 80),
        sanitizePartnerValue(url.searchParams.get("printing"), 120),
        sanitizePagePath(url.searchParams.get("from")),
        destination.hostname,
        new Date().toISOString(),
      ).run();
    } catch {
      // External navigation must continue even when aggregate click logging is unavailable.
    }
  }

  return partnerRedirect(applyAffiliateDeepLink(destination, env.LIGAGUNDAM_AFFILIATE_DEEPLINK_TEMPLATE));
}

export async function handleCommunitySchedules(request, env = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/api/community/schedules" && request.method === "GET") {
    return listCommunitySchedules(env, false);
  }

  if (path === "/api/community/schedules/manage" && request.method === "GET") {
    const access = authorizeScheduleManager(request, env);
    if (!access.allowed) return scheduleAuthorizationResponse(access);
    return listCommunitySchedules(env, true);
  }

  if (path === "/api/community/schedules" && request.method === "POST") {
    const access = authorizeScheduleManager(request, env);
    if (!access.allowed) return scheduleAuthorizationResponse(access);
    return createCommunitySchedule(request, env);
  }

  const exceptionMatch = path.match(/^\/api\/community\/schedules\/([^/]+)\/exceptions\/([^/]+)$/);
  if (exceptionMatch && request.method === "DELETE") {
    const access = authorizeScheduleManager(request, env);
    if (!access.allowed) return scheduleAuthorizationResponse(access);
    return deleteScheduleException(exceptionMatch[1], exceptionMatch[2], env);
  }

  const scheduleExceptionMatch = path.match(/^\/api\/community\/schedules\/([^/]+)\/exceptions$/);
  if (scheduleExceptionMatch && request.method === "POST") {
    const access = authorizeScheduleManager(request, env);
    if (!access.allowed) return scheduleAuthorizationResponse(access);
    return createScheduleException(scheduleExceptionMatch[1], request, env);
  }

  const scheduleMatch = path.match(/^\/api\/community\/schedules\/([^/]+)$/);
  if (scheduleMatch && request.method === "PATCH") {
    const access = authorizeScheduleManager(request, env);
    if (!access.allowed) return scheduleAuthorizationResponse(access);
    return setCommunityScheduleActive(scheduleMatch[1], request, env);
  }

  return json({ message: "Metodo nao permitido." }, 405, { Allow: "GET, POST, PATCH, DELETE" });
}

async function listCommunitySchedules(env, includeInactive) {
  if (!env.DB) return json({ available: false, schedules: [], exceptions: [] });
  try {
    const activeClause = includeInactive ? "" : "WHERE s.active = 1";
    const scheduleRows = await env.DB.prepare(`
      SELECT
        s.id, s.venue_id, s.name, s.weekday, s.start_time, s.time_zone,
        s.recurrence_rule, s.entry_fee_text, s.registration_url, s.source_name,
        s.source_url, s.verified_at, s.active, s.created_at, s.updated_at,
        s.format_name, s.description, s.start_date, s.end_date,
        v.name AS venue_name, v.address_line, v.city, v.region, v.country,
        v.postal_code, v.time_zone AS venue_time_zone, v.website_url
      FROM community_weekly_schedules s
      JOIN community_venues v ON v.id = s.venue_id
      ${activeClause}
      ORDER BY v.name COLLATE NOCASE, s.weekday, s.start_time, s.name
    `).bind().all();
    const scheduleIds = (scheduleRows.results || []).map((row) => row.id);
    let exceptionRows = { results: [] };
    if (scheduleIds.length) {
      const placeholders = scheduleIds.map(() => "?").join(", ");
      exceptionRows = await env.DB.prepare(`
        SELECT id, schedule_id, occurrence_date, kind, name, start_time,
          format_name, description, registration_url, created_at, updated_at
        FROM community_schedule_exceptions
        WHERE schedule_id IN (${placeholders})
        ORDER BY occurrence_date, created_at
      `).bind(...scheduleIds).all();
    }
    return json({
      available: true,
      schedules: (scheduleRows.results || []).map(serializeCommunitySchedule),
      exceptions: (exceptionRows.results || []).map(serializeScheduleException),
    });
  } catch {
    return json({ message: "A agenda comunitaria ainda nao esta disponivel." }, 503);
  }
}

async function createCommunitySchedule(request, env) {
  if (!env.DB) return json({ message: "A agenda comunitaria ainda nao esta disponivel." }, 503);
  const body = await scheduleRequestBody(request);
  if (body.error) return body.error;
  const input = normalizeCommunitySchedule(body.value);
  if (input.error) return json({ message: input.error }, 400);

  const now = new Date().toISOString();
  const venue = await findOrCreateCommunityVenue(env.DB, input, now, new URL(request.url).origin);
  if (venue.error) return json({ message: "Nao foi possivel registrar a loja." }, 503);
  const id = createId("schedule");
  try {
    await env.DB.prepare(`
      INSERT INTO community_weekly_schedules (
        id, venue_id, name, weekday, start_time, time_zone, recurrence_rule,
        entry_fee_text, registration_url, source_name, source_url, verified_at,
        active, created_at, updated_at, format_name, description, start_date, end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, venue.id, input.name, input.weekday, input.startTime, input.timeZone,
      "FREQ=WEEKLY", input.entryFeeText, input.registrationUrl,
      "Community-maintained schedule", input.registrationUrl || `${new URL(request.url).origin}/community/stores`,
      now, now, now, input.formatName, input.description, input.startDate || null, input.endDate || null,
    ).run();
    return json({ ok: true, id }, 201);
  } catch {
    return json({ message: "Nao foi possivel salvar a agenda semanal." }, 503);
  }
}

async function setCommunityScheduleActive(scheduleId, request, env) {
  if (!env.DB) return json({ message: "A agenda comunitaria ainda nao esta disponivel." }, 503);
  const body = await scheduleRequestBody(request);
  if (body.error) return body.error;
  if (typeof body.value?.active !== "boolean") return json({ message: "Informe se a agenda deve ficar ativa." }, 400);
  try {
    const result = await env.DB.prepare(`
      UPDATE community_weekly_schedules
      SET active = ?, updated_at = ?
      WHERE id = ?
    `).bind(body.value.active ? 1 : 0, new Date().toISOString(), scheduleId).run();
    if (!result.meta?.changes) return json({ message: "Agenda semanal nao encontrada." }, 404);
    return json({ ok: true, id: scheduleId, active: body.value.active });
  } catch {
    return json({ message: "Nao foi possivel atualizar a agenda semanal." }, 503);
  }
}

async function createScheduleException(scheduleId, request, env) {
  if (!env.DB) return json({ message: "A agenda comunitaria ainda nao esta disponivel." }, 503);
  const body = await scheduleRequestBody(request);
  if (body.error) return body.error;
  const input = normalizeScheduleException(body.value);
  if (input.error) return json({ message: input.error }, 400);
  const exists = await env.DB.prepare("SELECT id FROM community_weekly_schedules WHERE id = ? LIMIT 1").bind(scheduleId).first();
  if (!exists) return json({ message: "Agenda semanal nao encontrada." }, 404);
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(`
      INSERT INTO community_schedule_exceptions (
        id, schedule_id, occurrence_date, kind, name, start_time, format_name,
        description, registration_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(schedule_id, occurrence_date) DO UPDATE SET
        kind = excluded.kind, name = excluded.name, start_time = excluded.start_time,
        format_name = excluded.format_name, description = excluded.description,
        registration_url = excluded.registration_url, updated_at = excluded.updated_at
    `).bind(
      createId("schedule-exception"), scheduleId, input.occurrenceDate, input.kind,
      input.name || null, input.startTime || null, input.formatName || null,
      input.description || null, input.registrationUrl || null, now, now,
    ).run();
    return json({ ok: true, scheduleId, occurrenceDate: input.occurrenceDate }, 201);
  } catch {
    return json({ message: "Nao foi possivel salvar a excecao." }, 503);
  }
}

async function deleteScheduleException(scheduleId, exceptionId, env) {
  if (!env.DB) return json({ message: "A agenda comunitaria ainda nao esta disponivel." }, 503);
  try {
    const result = await env.DB.prepare("DELETE FROM community_schedule_exceptions WHERE id = ? AND schedule_id = ?")
      .bind(exceptionId, scheduleId).run();
    if (!result.meta?.changes) return json({ message: "Excecao nao encontrada." }, 404);
    return json({ ok: true, id: exceptionId });
  } catch {
    return json({ message: "Nao foi possivel remover a excecao." }, 503);
  }
}

function authorizeScheduleManager(request, env) {
  const user = platformUserFromRequest(request);
  if (!user) return { allowed: false, code: "authentication_required" };
  if (env.COMMUNITY_SCHEDULE_ALLOW_LOCAL_ADMIN === "true") return { allowed: true, user };
  const emails = String(env.COMMUNITY_SCHEDULE_ADMIN_EMAILS || "")
    .split(/[,;\s]+/).map((value) => value.trim().toLowerCase()).filter(Boolean);
  const ids = String(env.COMMUNITY_SCHEDULE_ADMIN_IDS || "")
    .split(/[,;\s]+/).map((value) => value.trim()).filter(Boolean);
  if (!emails.length && !ids.length) return { allowed: false, code: "admin_not_configured" };
  if (emails.includes(String(user.email || "").toLowerCase()) || ids.includes(user.id)) return { allowed: true, user };
  return { allowed: false, code: "forbidden" };
}

function scheduleAuthorizationResponse(access) {
  if (access.code === "authentication_required") {
    return json({
      code: access.code,
      message: "Entre para administrar as agendas de loja.",
      signInUrl: "/signin-with-chatgpt?return_to=/community/schedules",
    }, 401);
  }
  if (access.code === "admin_not_configured") {
    return json({ code: access.code, message: "Nenhum administrador de agendas foi configurado." }, 403);
  }
  return json({ code: access.code, message: "Esta conta nao pode administrar as agendas." }, 403);
}

async function findOrCreateCommunityVenue(db, input, now, origin) {
  try {
    const existing = await db.prepare(`
      SELECT id FROM community_venues
      WHERE lower(name) = lower(?)
        AND lower(COALESCE(city, '')) = lower(?)
        AND lower(COALESCE(country, '')) = lower(?)
      LIMIT 1
    `).bind(input.venueName, input.city.toLowerCase(), input.country.toLowerCase()).first();
    if (existing) return existing;
    const id = createId("venue");
    await db.prepare(`
      INSERT INTO community_venues (
        id, name, address_line, city, region, country, postal_code, time_zone,
        website_url, source_name, source_url, verified_at, created_at, updated_at
      ) VALUES (?, ?, '', ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, input.venueName, input.city, input.region, input.country, input.timeZone,
      input.websiteUrl, "Community-maintained schedule", input.websiteUrl || `${origin}/community/stores`,
      now, now, now,
    ).run();
    return { id };
  } catch {
    return { error: true };
  }
}

function normalizeCommunitySchedule(value = {}) {
  const venueName = sanitizeScheduleText(value.venueName, 160);
  const name = sanitizeScheduleText(value.name, 160);
  const weekday = Number(value.weekday);
  const startTime = normalizeTime(value.startTime);
  const startDate = normalizeDate(value.startDate);
  const endDate = normalizeDate(value.endDate);
  if (!venueName) return { error: "Informe o nome da loja." };
  if (!name) return { error: "Informe o nome do evento semanal." };
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { error: "Escolha um dia da semana valido." };
  if (value.startTime && !startTime) return { error: "Informe o horario como HH:MM." };
  if (value.startDate && !startDate) return { error: "Informe uma data inicial valida." };
  if (value.endDate && !endDate) return { error: "Informe uma data final valida." };
  if (startDate && endDate && endDate < startDate) return { error: "A data final precisa ser posterior a data inicial." };
  const registrationUrl = normalizeScheduleUrl(value.registrationUrl);
  const websiteUrl = normalizeScheduleUrl(value.websiteUrl);
  if (value.registrationUrl && !registrationUrl) return { error: "Use um link de inscricao valido." };
  if (value.websiteUrl && !websiteUrl) return { error: "Use um site da loja valido." };
  return {
    venueName,
    city: sanitizeScheduleText(value.city, 120),
    region: sanitizeScheduleText(value.region, 120),
    country: sanitizeScheduleText(value.country || "Brasil", 120) || "Brasil",
    timeZone: sanitizeScheduleText(value.timeZone || "America/Sao_Paulo", 80) || "America/Sao_Paulo",
    websiteUrl,
    name,
    weekday,
    startTime,
    formatName: sanitizeScheduleText(value.formatName, 100),
    entryFeeText: sanitizeScheduleText(value.entryFeeText, 120),
    registrationUrl,
    description: sanitizeScheduleText(value.description, 800),
    startDate,
    endDate,
  };
}

function normalizeScheduleException(value = {}) {
  const occurrenceDate = normalizeDate(value.occurrenceDate);
  const kind = value.kind === "override" ? "override" : value.kind === "cancelled" ? "cancelled" : "";
  const startTime = normalizeTime(value.startTime);
  const registrationUrl = normalizeScheduleUrl(value.registrationUrl);
  if (!occurrenceDate) return { error: "Informe a data da excecao." };
  if (!kind) return { error: "Escolha se a data foi cancelada ou alterada." };
  if (value.startTime && !startTime) return { error: "Informe o horario como HH:MM." };
  if (value.registrationUrl && !registrationUrl) return { error: "Use um link de inscricao valido." };
  return {
    occurrenceDate,
    kind,
    name: sanitizeScheduleText(value.name, 160),
    startTime,
    formatName: sanitizeScheduleText(value.formatName, 100),
    description: sanitizeScheduleText(value.description, 800),
    registrationUrl,
  };
}

async function scheduleRequestBody(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_000) return { error: json({ message: "Dados da agenda acima do limite permitido." }, 413) };
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 16_000) return { error: json({ message: "Dados da agenda acima do limite permitido." }, 413) };
    return { value: JSON.parse(raw || "{}") };
  } catch {
    return { error: json({ message: "Dados da agenda invalidos." }, 400) };
  }
}

function serializeCommunitySchedule(row) {
  return {
    id: row.id,
    venueId: row.venue_id,
    venueName: row.venue_name,
    addressLine: row.address_line || "",
    city: row.city || "",
    region: row.region || "",
    country: row.country || "",
    postalCode: row.postal_code || "",
    timeZone: row.time_zone || row.venue_time_zone || "America/Sao_Paulo",
    websiteUrl: row.website_url || "",
    name: row.name,
    weekday: Number(row.weekday),
    startTime: row.start_time || "",
    formatName: row.format_name || "",
    description: row.description || "",
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    entryFeeText: row.entry_fee_text || "",
    registrationUrl: row.registration_url || "",
    sourceName: row.source_name || "Community-maintained schedule",
    sourceUrl: row.source_url || "",
    verifiedAt: row.verified_at || "",
    active: Number(row.active) === 1,
  };
}

function serializeScheduleException(row) {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    occurrenceDate: row.occurrence_date,
    kind: row.kind,
    name: row.name || "",
    startTime: row.start_time || "",
    formatName: row.format_name || "",
    description: row.description || "",
    registrationUrl: row.registration_url || "",
  };
}

function sanitizeScheduleText(value, maxLength) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

function normalizeScheduleUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.toString().slice(0, 600) : "";
  } catch {
    return "";
  }
}

function normalizeDate(value) {
  const date = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? "" : date;
}

function normalizeTime(value) {
  const time = String(value || "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "";
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

function sanitizePartnerValue(value, maxLength) {
  return String(value || "").trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength);
}

function safeLigaGundamDestination(value) {
  try {
    const destination = new URL(value);
    if (destination.protocol !== "https:" || !LIGAGUNDAM_HOSTS.has(destination.hostname.toLowerCase())) return null;
    return destination;
  } catch {
    return null;
  }
}

function applyAffiliateDeepLink(destination, template) {
  const rawTemplate = String(template || "").trim();
  if (!rawTemplate || !rawTemplate.includes("{{destination}}")) return destination.toString();

  try {
    const affiliateUrl = new URL(rawTemplate.replaceAll("{{destination}}", encodeURIComponent(destination.toString())));
    return affiliateUrl.protocol === "https:" ? affiliateUrl.toString() : destination.toString();
  } catch {
    return destination.toString();
  }
}

function partnerRedirect(destination) {
  const headers = new Headers({
    location: destination,
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
  });
  applySecurityHeaders(headers);
  return new Response(null, { status: 302, headers });
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
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://cloudflareinsights.com",
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

export function injectWebAnalytics(html, token) {
  const normalizedToken = String(token || "").trim();
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(normalizedToken)) return html;
  if (html.includes("static.cloudflareinsights.com/beacon.min.js")) return html;

  const beacon = [
    '<script id="cloudflare-web-analytics" type="module"',
    ' src="https://static.cloudflareinsights.com/beacon.min.js"',
    ` data-cf-beacon='${JSON.stringify({ token: normalizedToken })}'></script>`,
  ].join("");

  return html.includes("</body>")
    ? html.replace("</body>", `  ${beacon}\n</body>`)
    : html;
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
