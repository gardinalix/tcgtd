import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleCommunitySchedules, handleDeckAssistant, handlePartnerRedirect } from "../worker/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

loadDotEnv(path.join(ROOT, ".env"));

const APP_URL = process.env.APP_URL || "http://127.0.0.1:4173";
const PORT = Number(process.env.AUTH_SERVER_PORT || 4180);
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-only-change-me";
const SESSION_COOKIE = "gtd_session";
const OAUTH_STATE_COOKIE = "gtd_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const EXBURST_SUPABASE_URL = process.env.EXBURST_SUPABASE_URL || "https://auth.exburst.dev";
const EXBURST_SUPABASE_ANON_KEY = process.env.EXBURST_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0Zmtkbml3YnZ5b2F5cGp2dWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNzQwMzUsImV4cCI6MjA2Mzk1MDAzNX0.iCCIOIt8durZJg2JtSCBhPuza7j3pFfF8mS_Xj1m7Ic";
const EXBURST_GUNDAM_DECKLISTS_TABLE = process.env.EXBURST_GUNDAM_DECKLISTS_TABLE || "gundam_decklists";
const EXBURST_DECK_SELECT = [
  "id",
  "decklist_name",
  "decklist_content",
  "user_id",
  "modified_date",
  "is_public",
  "is_locked",
  "visitorcount",
  "favoritecard",
  "favoritecardlink",
  "colors",
  "archetype",
  "super_archetype",
  "selecteditems",
  "customseries",
  "considering",
  "sidedeck",
  "comment_count",
  "like_count",
].join(",");

await mkdir(path.join(ROOT, "data"), { recursive: true });
const db = openDatabase();
ensureSchema(db);

const server = createServer(async (request, response) => {
  try {
    setCors(request, response);
    if (request.method === "OPTIONS") return send(response, 204, {});

    const url = new URL(request.url || "/", APP_URL);
    if (url.pathname === "/api/deck-assistant") return serveDeckAssistant(request, response, url);
    if (url.pathname === "/go/ligagundam") return servePartnerRedirect(request, response, url);
    if (url.pathname === "/api/community/schedules" || url.pathname.startsWith("/api/community/schedules/")) {
      return serveCommunitySchedules(request, response, url);
    }
    if (url.pathname === "/api/auth/session" && request.method === "GET") return getSession(request, response);
    if (url.pathname === "/api/auth/register" && request.method === "POST") return register(request, response);
    if (url.pathname === "/api/auth/login" && request.method === "POST") return login(request, response);
    if (url.pathname === "/api/auth/logout" && request.method === "POST") return logout(request, response);
    if (url.pathname === "/api/auth/password/request" && request.method === "POST") return requestPasswordReset(request, response);
    if (url.pathname === "/api/auth/password/change" && request.method === "POST") return changePassword(request, response);
    if (url.pathname === "/api/profile" && request.method === "PATCH") return updateProfile(request, response);
    if (url.pathname === "/api/import/exburst/deck" && request.method === "GET") return importExBurstDeck(request, response, url);
    if (url.pathname === "/api/import/exburst/profile-decks" && request.method === "GET") return importExBurstProfileDecks(request, response, url);
    if (url.pathname.match(/^\/api\/auth\/oauth\/[^/]+\/start$/) && request.method === "GET") return startOAuth(request, response, url.pathname.split("/")[4], url);
    if (url.pathname.match(/^\/auth\/callback\/[^/]+$/) && request.method === "GET") return finishOAuth(request, response, url.pathname.split("/").pop(), url);

    return serveStatic(request, response, url);
  } catch (error) {
    console.error(error);
    return send(response, 500, { error: "Internal auth server error." });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Gundam Tactical Auth Server listening on http://127.0.0.1:${PORT}`);
});

async function serveDeckAssistant(request, response, url) {
  const body = request.method === "POST" ? JSON.stringify(await readBody(request)) : undefined;
  const webRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
    body,
  });
  const result = await handleDeckAssistant(webRequest, process.env);
  response.statusCode = result.status;
  result.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(Buffer.from(await result.arrayBuffer()));
}

async function servePartnerRedirect(request, response, url) {
  const webRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
  });
  const result = await handlePartnerRedirect(webRequest, {
    ...process.env,
    DB: createD1Adapter(db),
  });
  response.statusCode = result.status;
  result.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(Buffer.from(await result.arrayBuffer()));
}

async function serveCommunitySchedules(request, response, url) {
  const user = authenticate(request);
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(", "));
    else if (value) headers.set(name, String(value));
  }
  if (user) {
    headers.set("oai-authenticated-user-id", user.id);
    headers.set("oai-authenticated-user-email", user.email || "");
    headers.set("oai-authenticated-user-full-name", user.display_name || user.public_name || user.username || "Local manager");
  }
  const body = ["GET", "HEAD"].includes(request.method || "GET") ? undefined : JSON.stringify(await readBody(request));
  const webRequest = new Request(url, {
    method: request.method,
    headers,
    body,
  });
  const result = await handleCommunitySchedules(webRequest, {
    ...process.env,
    DB: createD1Adapter(db),
    // The local server is bound to 127.0.0.1 and requires its normal local
    // session. The hosted worker never enables this development-only flag.
    COMMUNITY_SCHEDULE_ALLOW_LOCAL_ADMIN: "true",
  });
  response.statusCode = result.status;
  result.headers.forEach((value, name) => response.setHeader(name, value));
  response.end(Buffer.from(await result.arrayBuffer()));
}

async function register(request, response) {
  const body = await readBody(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!isValidEmail(email)) return send(response, 400, { error: "Invalid e-mail." });
  if (password.length < 8) return send(response, 400, { error: "Password must have at least 8 characters." });

  const existing = getUserByEmail(email);
  if (existing) return send(response, 409, { error: "This e-mail is already registered." });

  const now = new Date().toISOString();
  const user = {
    id: createId("user"),
    email,
    display_name: body.displayName || email,
    public_name: body.displayName || email,
    username: body.username || email.split("@")[0],
    avatar_url: "",
    provider: "email",
    provider_id: "",
    role: "user",
    created_at: now,
    updated_at: now,
    last_login_at: now,
    email_verified: 0,
    is_banned: 0,
    preferences: "{}",
    password_hash: hashPassword(password),
  };
  insertUser(user);
  logAuth(user.id, "email", "register", true, request);
  return issueSession(response, user);
}

async function login(request, response) {
  const body = await readBody(request);
  const email = normalizeEmail(body.email);
  const user = getUserByEmail(email);
  if (!user) {
    logAuth(null, "email", "login_failed", false, request, "User not found.");
    return send(response, 401, { error: "Invalid e-mail or password." });
  }
  if (Number(user.is_banned || 0)) {
    logAuth(user.id, "email", "login_failed", false, request, "Account banned.");
    return send(response, 403, { error: "Account banned." });
  }
  if (!verifyPassword(body.password || "", user.password_hash || "")) {
    logAuth(user.id, "email", "login_failed", false, request, "Invalid password.");
    return send(response, 401, { error: "Invalid e-mail or password." });
  }
  db.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(new Date().toISOString(), new Date().toISOString(), user.id);
  logAuth(user.id, "email", "login_success", true, request);
  return issueSession(response, getUserById(user.id));
}

function getSession(request, response) {
  const user = authenticate(request);
  return send(response, 200, { user: user ? serializeUser(user) : null });
}

function logout(request, response) {
  const token = readCookie(request, SESSION_COOKIE);
  const session = token ? getSessionByToken(token) : null;
  if (session) {
    db.prepare("DELETE FROM auth_sessions WHERE id = ?").run(session.id);
    logAuth(session.user_id, "session", "logout", true, request);
  }
  response.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE));
  return send(response, 200, { ok: true });
}

async function requestPasswordReset(request, response) {
  const body = await readBody(request);
  const user = getUserByEmail(normalizeEmail(body.email));
  if (user) {
    const token = randomToken();
    db.prepare(
      "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
    ).run(createId("reset"), user.id, sha256(token), new Date(Date.now() + 1000 * 60 * 30).toISOString(), new Date().toISOString());
    logAuth(user.id, "email", "password_reset", true, request);
  }
  return send(response, 200, { ok: true, message: "If that account exists, a password reset flow was registered." });
}

async function changePassword(request, response) {
  const user = authenticate(request);
  if (!user) return send(response, 401, { error: "Login required." });
  const body = await readBody(request);
  if (!verifyPassword(body.currentPassword || "", user.password_hash || "")) return send(response, 401, { error: "Invalid current password." });
  if (String(body.newPassword || "").length < 8) return send(response, 400, { error: "Password must have at least 8 characters." });
  db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(hashPassword(body.newPassword), new Date().toISOString(), user.id);
  logAuth(user.id, "email", "password_change", true, request);
  return send(response, 200, { ok: true });
}

async function updateProfile(request, response) {
  const user = authenticate(request);
  if (!user) return send(response, 401, { error: "Login required." });
  const body = await readBody(request);
  db.prepare(
    "UPDATE users SET display_name = ?, public_name = ?, username = ?, avatar_url = ?, preferences = ?, updated_at = ? WHERE id = ?",
  ).run(
    body.displayName || body.display_name || user.display_name,
    body.publicName || body.public_name || user.public_name,
    body.username || user.username,
    body.avatarUrl || body.avatar_url || user.avatar_url,
    JSON.stringify(body.preferences || parseJson(user.preferences) || {}),
    new Date().toISOString(),
    user.id,
  );
  logAuth(user.id, user.provider || "email", "profile_update", true, request);
  return send(response, 200, { user: serializeUser(getUserById(user.id)) });
}

async function importExBurstDeck(_request, response, url) {
  try {
    const deckTarget = url.searchParams.get("deck") || url.searchParams.get("url") || url.searchParams.get("id") || "";
    const deckId = parseExBurstDeckId(deckTarget);
    if (!deckId) return send(response, 400, { error: "Paste an ExBurst Gundam deck URL or numeric deck id." });

    const decks = await fetchPublicExBurstDecks({ deckId, includeContent: true, limit: 1 });
    if (!decks.length) {
      return send(response, 404, {
        error: "No public ExBurst deck was found for that id. Private ExBurst decks need to be exported or made public first.",
      });
    }
    return send(response, 200, { source: "ExBurst", deck: decks[0] });
  } catch (error) {
    return send(response, 502, { error: error.message || "ExBurst import failed." });
  }
}

async function importExBurstProfileDecks(_request, response, url) {
  try {
    const profileTarget = url.searchParams.get("profile") || url.searchParams.get("user") || url.searchParams.get("userId") || "";
    const parsed = parseExBurstProfileTarget(profileTarget);
    if (!parsed.userId && !parsed.username) {
      return send(response, 400, { error: "Paste an ExBurst profile URL, numeric user id, or username." });
    }

    const user = parsed.userId ? await fetchExBurstUserById(parsed.userId) : await fetchExBurstUserByUsername(parsed.username);
    if (!user?.id) return send(response, 404, { error: "ExBurst profile not found." });

    const requestedLimit = Number(url.searchParams.get("limit") || 50);
    const limit = Math.max(1, Math.min(100, Number.isFinite(requestedLimit) ? requestedLimit : 50));
    const decks = await fetchPublicExBurstDecks({ userId: user.id, includeContent: true, limit });

    return send(response, 200, {
      source: "ExBurst",
      user,
      decks,
      note: "Only public ExBurst Gundam decklists are imported. Private decklists require ExBurst export/paste until an authorized API is available.",
    });
  } catch (error) {
    return send(response, 502, { error: error.message || "ExBurst profile import failed." });
  }
}

async function fetchPublicExBurstDecks({ deckId, userId, includeContent = true, limit = 50 }) {
  const params = new URLSearchParams();
  params.set("select", includeContent ? EXBURST_DECK_SELECT : EXBURST_DECK_SELECT.replace(",decklist_content", ""));
  params.set("is_public", "eq.1");
  params.set("or", "(is_locked.is.null,is_locked.eq.0,is_locked.eq.false)");
  params.set("order", "modified_date.desc");
  params.set("limit", String(limit));
  if (deckId) params.set("id", `eq.${deckId}`);
  if (userId) params.set("user_id", `eq.${userId}`);
  const rows = await exBurstRest(EXBURST_GUNDAM_DECKLISTS_TABLE, params);
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
  const users = userIds.length ? await fetchExBurstUsersByIds(userIds) : new Map();
  return rows.map((row) => normalizeExBurstDeck(row, users.get(Number(row.user_id))));
}

async function fetchExBurstUserById(userId) {
  const users = await fetchExBurstUsersByIds([userId]);
  return users.get(Number(userId)) || null;
}

async function fetchExBurstUserByUsername(username) {
  const clean = cleanExBurstUsername(username);
  if (!clean) return null;
  const params = new URLSearchParams();
  params.set("select", "id,username,avatar,user_level,selectedbadge,selectedavatarbackground");
  params.set("username", `ilike.*${clean}*`);
  params.set("limit", "10");
  const rows = await exBurstRest("users_public", params);
  const exact = rows.find((row) => String(row.username || "").toLowerCase() === clean.toLowerCase());
  return normalizeExBurstUser(exact || rows[0]);
}

async function fetchExBurstUsersByIds(userIds) {
  const ids = [...new Set(userIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return new Map();
  const params = new URLSearchParams();
  params.set("select", "id,username,avatar,user_level,selectedbadge,selectedavatarbackground");
  params.set("id", `in.(${ids.join(",")})`);
  const rows = await exBurstRest("users_public", params);
  return new Map(rows.map((row) => [Number(row.id), normalizeExBurstUser(row)]));
}

async function exBurstRest(table, params) {
  if (!EXBURST_SUPABASE_ANON_KEY) {
    throw new Error("EXBURST_SUPABASE_ANON_KEY is not configured.");
  }
  const endpoint = new URL(`/rest/v1/${table}`, EXBURST_SUPABASE_URL);
  for (const [key, value] of params.entries()) endpoint.searchParams.set(key, value);
  const result = await fetch(endpoint, {
    headers: {
      apikey: EXBURST_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${EXBURST_SUPABASE_ANON_KEY}`,
      Accept: "application/json",
    },
  });
  const text = await result.text();
  if (!result.ok) {
    let message = text;
    try {
      message = JSON.parse(text).message || text;
    } catch {
      // Keep the raw response text.
    }
    throw new Error(`ExBurst import failed: ${message}`);
  }
  return text ? JSON.parse(text) : [];
}

function normalizeExBurstDeck(row = {}, user = null) {
  return {
    id: String(row.id || ""),
    source: "ExBurst",
    sourceUrl: row.id ? `https://exburst.dev/gundam/deck/${row.id}` : "https://exburst.dev/gundam",
    name: row.decklist_name || `ExBurst deck ${row.id || ""}`.trim(),
    decklistContent: row.decklist_content || "",
    sideDeckContent: row.sidedeck || "",
    consideringContent: row.considering || "",
    archetype: row.archetype || "",
    superArchetype: row.super_archetype || "",
    colors: normalizeExBurstColors(row.colors),
    modifiedDate: row.modified_date || "",
    favoriteCard: row.favoritecard || "",
    favoriteCardLink: row.favoritecardlink || "",
    visitorCount: Number(row.visitorcount || 0),
    likeCount: Number(row.like_count || 0),
    commentCount: Number(row.comment_count || 0),
    owner: user || normalizeExBurstUser({ id: row.user_id }),
  };
}

function normalizeExBurstUser(row = {}) {
  if (!row) return null;
  return {
    id: Number(row.id || 0),
    username: row.username || "Unknown pilot",
    avatar: row.avatar || "",
    level: Number(row.user_level || 1),
    badge: row.selectedbadge || "",
    avatarBackground: row.selectedavatarbackground || "",
    profileUrl: row.id ? `https://exburst.dev/profile/${row.id}` : "",
  };
}

function normalizeExBurstColors(value = "") {
  return String(value || "")
    .split(/[,/;|]+/)
    .map((color) => color.trim())
    .filter(Boolean);
}

function parseExBurstDeckId(value = "") {
  const raw = String(value || "").trim();
  if (/^\d+$/.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    const match = parsed.pathname.match(/\/gundam\/(?:deck|deckbuilder|decklists|decks\/view)\/(\d+)/i) || parsed.pathname.match(/\/deck\/(\d+)/i);
    return match ? match[1] : "";
  } catch {
    const match = raw.match(/\b(?:deck|deckbuilder|decklists|decks\/view)\/(\d+)\b/i);
    return match ? match[1] : "";
  }
}

function parseExBurstProfileTarget(value = "") {
  const raw = String(value || "").trim();
  if (/^\d+$/.test(raw)) return { userId: raw, username: "" };
  try {
    const parsed = new URL(raw);
    const match = parsed.pathname.match(/\/profile\/(\d+)/i);
    if (match) return { userId: match[1], username: "" };
  } catch {
    const match = raw.match(/\bprofile\/(\d+)\b/i);
    if (match) return { userId: match[1], username: "" };
  }
  return { userId: "", username: cleanExBurstUsername(raw) };
}

function cleanExBurstUsername(value = "") {
  return String(value || "")
    .trim()
    .replace(/^@/, "")
    .replace(/[^\w .-]/g, "")
    .slice(0, 64);
}

function startOAuth(request, response, provider, url) {
  const config = providerConfig(provider);
  if (!config || !config.clientId || !config.clientSecret) {
    return redirectAuth(response, provider, "error", `${provider} OAuth is not configured. Fill .env first.`);
  }
  const state = randomToken();
  const redirectTarget = url.searchParams.get("redirect") || "/profile";
  const authorize = new URL(config.authorizeUrl);
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", callbackUrl(provider));
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", config.scope);
  authorize.searchParams.set("state", state);
  response.setHeader("Set-Cookie", [
    makeCookie(OAUTH_STATE_COOKIE, `${state}.${Buffer.from(redirectTarget).toString("base64url")}`, 600, false),
  ]);
  response.writeHead(302, { Location: authorize.toString() });
  response.end();
}

async function finishOAuth(request, response, provider, url) {
  const stateCookie = readCookie(request, OAUTH_STATE_COOKIE) || "";
  const [expectedState, redirectBase64 = ""] = stateCookie.split(".");
  if (!expectedState || expectedState !== url.searchParams.get("state")) {
    return redirectAuth(response, provider, "error", "Invalid OAuth state.");
  }
  const config = providerConfig(provider);
  if (!config) return redirectAuth(response, provider, "error", "Unknown provider.");
  const code = url.searchParams.get("code");
  if (!code) return redirectAuth(response, provider, "error", "Missing OAuth code.");

  try {
    const token = await exchangeToken(config, provider, code);
    const profile = await fetchProviderProfile(config, token.access_token);
    const user = upsertOAuthUser(provider, profile, request);
    appendSetCookie(response, clearCookie(OAUTH_STATE_COOKIE));
    issueSession(response, user, false);
    const redirectTarget = Buffer.from(redirectBase64, "base64url").toString("utf8") || "/profile";
    response.writeHead(302, { Location: `${APP_URL}/auth/callback?provider=${encodeURIComponent(provider)}&status=success&redirect=${encodeURIComponent(redirectTarget)}` });
    response.end();
  } catch (error) {
    console.error(error);
    return redirectAuth(response, provider, "error", "OAuth provider rejected the request.");
  }
}

async function exchangeToken(config, provider, code) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl(provider),
  });
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

async function fetchProviderProfile(config, accessToken) {
  const response = await fetch(config.userUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return config.normalize(data);
}

function upsertOAuthUser(provider, profile, request) {
  const identity = db.prepare("SELECT * FROM auth_identities WHERE provider = ? AND provider_id = ?").get(provider, profile.providerId);
  if (identity) {
    const user = getUserById(identity.user_id);
    if (Number(user?.is_banned || 0)) throw new Error("Account banned.");
    db.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(new Date().toISOString(), new Date().toISOString(), user.id);
    logAuth(user.id, provider, "login_success", true, request);
    return getUserById(user.id);
  }

  const byEmail = profile.email ? getUserByEmail(profile.email) : null;
  const now = new Date().toISOString();
  const user = byEmail || {
    id: createId("user"),
    email: profile.email || "",
    display_name: profile.displayName || profile.username || provider,
    public_name: profile.displayName || profile.username || provider,
    username: profile.username || "",
    avatar_url: profile.avatarUrl || "",
    provider,
    provider_id: profile.providerId,
    role: "user",
    created_at: now,
    updated_at: now,
    last_login_at: now,
    email_verified: profile.emailVerified ? 1 : 0,
    is_banned: 0,
    preferences: "{}",
    password_hash: "",
  };
  if (!byEmail) insertUser(user);
  db.prepare(
    "INSERT INTO auth_identities (id, user_id, provider, provider_id, email, profile_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(createId("identity"), user.id, provider, profile.providerId, profile.email || "", JSON.stringify(profile), now, now);
  logAuth(user.id, provider, byEmail ? "provider_linked" : "register", true, request);
  return getUserById(user.id);
}

function issueSession(response, user, shouldSend = true) {
  const token = randomToken();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    createId("session"),
    user.id,
    sha256(token),
    new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
    now,
    now,
  );
  appendSetCookie(response, makeCookie(SESSION_COOKIE, token, SESSION_TTL_SECONDS, true));
  if (shouldSend) return send(response, 200, { user: serializeUser(user) });
}

function authenticate(request) {
  const token = readCookie(request, SESSION_COOKIE);
  const session = token ? getSessionByToken(token) : null;
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM auth_sessions WHERE id = ?").run(session.id);
    return null;
  }
  db.prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?").run(new Date().toISOString(), session.id);
  return getUserById(session.user_id);
}

function getSessionByToken(token) {
  return db.prepare("SELECT * FROM auth_sessions WHERE token_hash = ?").get(sha256(token));
}

function providerConfig(provider) {
  const configs = {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      scope: "openid email profile",
      normalize: (row) => ({
        providerId: row.sub,
        email: row.email,
        emailVerified: Boolean(row.email_verified),
        displayName: row.name,
        username: row.email?.split("@")[0] || "",
        avatarUrl: row.picture || "",
      }),
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorizeUrl: "https://discord.com/api/oauth2/authorize",
      tokenUrl: "https://discord.com/api/oauth2/token",
      userUrl: "https://discord.com/api/users/@me",
      scope: "identify email",
      normalize: (row) => ({
        providerId: row.id,
        email: row.email || "",
        emailVerified: Boolean(row.verified),
        displayName: row.global_name || row.username,
        username: row.username,
        avatarUrl: row.avatar ? `https://cdn.discordapp.com/avatars/${row.id}/${row.avatar}.png` : "",
      }),
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      authorizeUrl: "https://www.facebook.com/v20.0/dialog/oauth",
      tokenUrl: "https://graph.facebook.com/v20.0/oauth/access_token",
      userUrl: "https://graph.facebook.com/me?fields=id,name,email,picture",
      scope: "email,public_profile",
      normalize: (row) => ({
        providerId: row.id,
        email: row.email || "",
        emailVerified: Boolean(row.email),
        displayName: row.name,
        username: row.email?.split("@")[0] || row.id,
        avatarUrl: row.picture?.data?.url || "",
      }),
    },
  };
  return configs[provider];
}

function callbackUrl(provider) {
  return `${APP_URL.replace(/\/$/, "")}/auth/callback/${provider}`;
}

function redirectAuth(response, provider, status, message) {
  response.writeHead(302, {
    Location: `${APP_URL}/auth/callback?provider=${encodeURIComponent(provider)}&status=${encodeURIComponent(status)}&message=${encodeURIComponent(message)}`,
  });
  response.end();
}

function insertUser(user) {
  db.prepare(
    `INSERT INTO users (
      id, email, password_hash, display_name, public_name, avatar_url, provider, provider_id, role,
      created_at, updated_at, username, last_login_at, email_verified, is_banned, preferences
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    user.id,
    user.email,
    user.password_hash,
    user.display_name,
    user.public_name,
    user.avatar_url,
    user.provider,
    user.provider_id,
    user.role,
    user.created_at,
    user.updated_at,
    user.username,
    user.last_login_at,
    user.email_verified,
    user.is_banned,
    user.preferences,
  );
}

function getUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email);
}

function getUserById(id) {
  return id ? db.prepare("SELECT * FROM users WHERE id = ?").get(id) : null;
}

function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || "",
    displayName: user.display_name,
    publicName: user.public_name,
    username: user.username || "",
    avatarUrl: user.avatar_url || "",
    provider: user.provider || "email",
    providerId: user.provider_id || "",
    role: user.role || "user",
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    lastLoginAt: user.last_login_at,
    emailVerified: Boolean(user.email_verified),
    isBanned: Boolean(user.is_banned),
    preferences: parseJson(user.preferences) || {},
  };
}

function logAuth(userId, provider, eventType, success, request, errorMessage = "") {
  db.prepare(
    "INSERT INTO auth_logs (id, user_id, provider, event_type, ip, user_agent, created_at, success, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    createId("authlog"),
    userId || "",
    provider || "",
    eventType,
    request.socket?.remoteAddress || "",
    request.headers["user-agent"] || "",
    new Date().toISOString(),
    success ? 1 : 0,
    errorMessage,
  );
}

function ensureSchema(database) {
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      display_name TEXT NOT NULL,
      public_name TEXT,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
  `);
  addColumnIfMissing("users", "username", "TEXT");
  addColumnIfMissing("users", "provider", "TEXT DEFAULT 'email'");
  addColumnIfMissing("users", "provider_id", "TEXT");
  addColumnIfMissing("users", "last_login_at", "TEXT");
  addColumnIfMissing("users", "email_verified", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("users", "is_banned", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("users", "preferences", "TEXT NOT NULL DEFAULT '{}'");
  database.exec(`
    CREATE TABLE IF NOT EXISTS auth_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      email TEXT,
      profile_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      UNIQUE(provider, provider_id)
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      provider TEXT,
      event_type TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_auth_logs_user ON auth_logs(user_id, created_at);
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS community_venues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address_line TEXT,
      city TEXT,
      region TEXT,
      country TEXT,
      postal_code TEXT,
      latitude REAL,
      longitude REAL,
      time_zone TEXT,
      bandai_tcg_plus_id TEXT,
      website_url TEXT,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      verified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS community_weekly_schedules (
      id TEXT PRIMARY KEY,
      venue_id TEXT NOT NULL REFERENCES community_venues(id),
      name TEXT NOT NULL,
      weekday INTEGER,
      start_time TEXT,
      time_zone TEXT,
      recurrence_rule TEXT,
      entry_fee_text TEXT,
      registration_url TEXT,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      verified_at TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      format_name TEXT,
      description TEXT,
      start_date TEXT,
      end_date TEXT
    );
    CREATE TABLE IF NOT EXISTS community_schedule_exceptions (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL REFERENCES community_weekly_schedules(id) ON DELETE CASCADE,
      occurrence_date TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('cancelled', 'override')),
      name TEXT,
      start_time TEXT,
      format_name TEXT,
      description TEXT,
      registration_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      UNIQUE(schedule_id, occurrence_date)
    );
    CREATE INDEX IF NOT EXISTS idx_community_weekly_schedules_venue_active
      ON community_weekly_schedules(venue_id, active);
    CREATE INDEX IF NOT EXISTS idx_community_schedule_exceptions_schedule_date
      ON community_schedule_exceptions(schedule_id, occurrence_date);
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS partner_offer_clicks (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      source_code TEXT NOT NULL,
      card_number TEXT,
      printing_id TEXT,
      page_path TEXT NOT NULL,
      destination_host TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_partner_offer_clicks_partner_created_at
      ON partner_offer_clicks(partner_id, created_at);
  `);
}

function createD1Adapter(database) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              return database.prepare(sql).get(...args) || null;
            },
            async all() {
              return { results: database.prepare(sql).all(...args) };
            },
            async run() {
              const result = database.prepare(sql).run(...args);
              return { success: true, meta: { changes: Number(result.changes || 0) } };
            },
          };
        },
      };
    },
  };
}

function addColumnIfMissing(table, column, type) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

function openDatabase() {
  const raw = process.env.DATABASE_URL || "file:./data/gundam.db";
  const dbPath = raw.startsWith("file:") ? raw.slice(5) : raw;
  const absolute = path.isAbsolute(dbPath) ? dbPath : path.resolve(ROOT, dbPath);
  return new DatabaseSync(absolute);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const digest = scryptSync(String(password), `${salt}.${AUTH_SECRET}`, 64).toString("base64url");
  return `scrypt$${salt}$${digest}`;
}

function verifyPassword(password, stored) {
  const [, salt, digest] = String(stored || "").split("$");
  if (!salt || !digest) return false;
  const candidate = scryptSync(String(password), `${salt}.${AUTH_SECRET}`, 64);
  const expected = Buffer.from(digest, "base64url");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function makeCookie(name, value, maxAge, httpOnly) {
  const secure = APP_URL.startsWith("https://") ? "; Secure" : "";
  const flags = `${httpOnly ? "; HttpOnly" : ""}; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
  return `${name}=${encodeURIComponent(value)}${flags}`;
}

function clearCookie(name) {
  return `${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function appendSetCookie(response, cookie) {
  const current = response.getHeader("Set-Cookie");
  if (!current) return response.setHeader("Set-Cookie", cookie);
  response.setHeader("Set-Cookie", Array.isArray(current) ? [...current, cookie] : [current, cookie]);
}

function readCookie(request, name) {
  const cookies = String(request.headers.cookie || "").split(";").map((item) => item.trim());
  const match = cookies.find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function send(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(status === 204 ? "" : JSON.stringify(payload));
}

function setCors(request, response) {
  const origin = request.headers.origin;
  const allowed = new Set([APP_URL, "http://127.0.0.1:4173", "http://localhost:4173", `http://127.0.0.1:${PORT}`]);
  if (origin && allowed.has(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
}

async function serveStatic(_request, response, url) {
  const dist = path.join(ROOT, "dist");
  const target = url.pathname === "/" ? path.join(dist, "index.html") : path.normalize(path.join(dist, url.pathname));
  const safeTarget = target.startsWith(dist) && existsSync(target) && statSync(target).isFile() ? target : path.join(dist, "index.html");
  try {
    const bytes = await readFile(safeTarget);
    response.writeHead(200, { "Content-Type": contentType(safeTarget) });
    response.end(bytes);
  } catch {
    send(response, 404, { error: "Not found." });
  }
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createId(prefix) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function randomToken() {
  return randomBytes(32).toString("base64url");
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
}
