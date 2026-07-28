import { AuthApiUnavailableError, authRequest, socialLoginUrl } from "./authClient";

export const USER_ROLES = ["guest", "user"];

export function createDefaultUserState(legacy = {}) {
  const localId = "local-user";
  return normalizePlatformState({
    currentUserId: "",
    users: {
      [localId]: {
        id: localId,
        email: "pilot@local",
        displayName: "Local Pilot",
        publicName: "Local Pilot",
        username: "local-pilot",
        role: "user",
        avatarUrl: "",
        provider: "local",
        providerId: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: "",
        emailVerified: false,
        isBanned: false,
        preferences: {},
        passwordHash: "",
      },
    },
    decks: [
      {
        id: "local-deck",
        ownerId: localId,
        name: legacy?.deckName || legacy?.deck?.name || "ZERO System Deck",
        visibility: "private",
        archetype: "",
        colors: [],
        format: "Current",
        event: "",
        result: "",
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        main: legacy?.deck?.main || {},
        resource: legacy?.deck?.resource || {},
      },
    ],
    activeDeckId: "local-deck",
    favorites: {},
    cardRatings: {},
    imports: [],
    auditLogs: [],
  });
}

export function normalizePlatformState(value = {}) {
  const users = value.users && typeof value.users === "object" ? Object.fromEntries(Object.entries(value.users).map(([id, user]) => [id, normalizeUser(user)])) : {};
  const decks = Array.isArray(value.decks) ? value.decks.map(normalizeSavedDeck) : [];
  const activeDeckId = decks.some((deck) => deck.id === value.activeDeckId) ? value.activeDeckId : decks[0]?.id || "";
  return {
    currentUserId: users[value.currentUserId] ? value.currentUserId : "",
    users,
    decks,
    activeDeckId,
    favorites: value.favorites || {},
    cardRatings: value.cardRatings || {},
    imports: Array.isArray(value.imports) ? value.imports : [],
    auditLogs: Array.isArray(value.auditLogs) ? value.auditLogs : [],
  };
}

export function getCurrentUser(state) {
  return state.users?.[state.currentUserId] || null;
}

export async function createUserAccount(state, { email, password, displayName, username, role = "user" }) {
  try {
    const payload = await authRequest("/api/auth/register", {
      method: "POST",
      body: { email, password, displayName, username },
    });
    return applyAuthenticatedUser(state, payload.user, "auth.register.remote");
  } catch (error) {
    if (error instanceof AuthApiUnavailableError) throw new Error("Authentication server is unavailable. Run npm run auth and try again.");
    throw error;
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("Email is required.");
  if ((password || "").length < 6) throw new Error("Password must have at least 6 characters.");
  if (Object.values(state.users || {}).some((user) => normalizeEmail(user.email) === normalizedEmail)) {
    throw new Error("This email already exists.");
  }

  const id = `user-${Date.now().toString(36)}`;
  const user = {
    id,
    email: normalizedEmail,
    displayName: displayName || normalizedEmail,
    publicName: displayName || normalizedEmail,
    username: username || normalizedEmail.split("@")[0],
    role: USER_ROLES.includes(role) ? role : "user",
    avatarUrl: "",
    provider: "email",
    providerId: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    emailVerified: false,
    isBanned: false,
    preferences: {},
    passwordHash: await hashPassword(password),
  };
  return {
    ...state,
    currentUserId: id,
    users: { ...(state.users || {}), [id]: user },
    auditLogs: appendAudit(state, "user.created", id),
  };
}

export async function loginUser(state, { email, password }) {
  try {
    const payload = await authRequest("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    return applyAuthenticatedUser(state, payload.user, "auth.login.remote");
  } catch (error) {
    if (error instanceof AuthApiUnavailableError) throw new Error("Authentication server is unavailable. Run npm run auth and try again.");
    throw error;
  }

  const normalizedEmail = normalizeEmail(email);
  const user = Object.values(state.users || {}).find((row) => normalizeEmail(row.email) === normalizedEmail);
  if (!user) throw new Error("User not found.");
  if (!user.passwordHash) throw new Error("This local profile has no password. Start the auth server or create a new local account.");
  if (user.passwordHash && user.passwordHash !== await hashPassword(password)) {
    throw new Error("Invalid password.");
  }
  return {
    ...state,
    currentUserId: user.id,
    users: {
      ...state.users,
      [user.id]: normalizeUser({ ...user, lastLoginAt: new Date().toISOString() }),
    },
    auditLogs: appendAudit(state, "user.login.local", user.id),
  };
}

export async function hydrateAuthSession(state) {
  try {
    const payload = await authRequest("/api/auth/session");
    if (!payload.user) return state;
    return applyAuthenticatedUser(state, payload.user, "auth.session.remote");
  } catch {
    return state;
  }
}

export async function logoutUser(state) {
  try {
    await authRequest("/api/auth/logout", { method: "POST", body: {} });
  } catch {
    // Local fallback remains available when the auth server is not running.
  }
  return { ...state, currentUserId: "", auditLogs: appendAudit(state, "user.logout", state.currentUserId || "guest") };
}

export function updateUserProfile(state, userId, patch) {
  const user = state.users?.[userId];
  if (!user) return state;
  return {
    ...state,
    users: {
      ...state.users,
      [userId]: {
        ...user,
        displayName: patch.displayName ?? user.displayName,
        publicName: patch.publicName ?? user.publicName,
        username: patch.username ?? user.username,
        avatarUrl: patch.avatarUrl ?? user.avatarUrl,
        preferences: patch.preferences ?? user.preferences,
        updatedAt: new Date().toISOString(),
      },
    },
    auditLogs: appendAudit(state, "user.profile.updated", userId),
  };
}

export async function updateUserProfileRemote(state, userId, patch) {
  try {
    const payload = await authRequest("/api/profile", { method: "PATCH", body: patch });
    return updateUserProfile(state, userId, normalizeUser(payload.user || patch));
  } catch (error) {
    if (!(error instanceof AuthApiUnavailableError)) throw error;
    return updateUserProfile(state, userId, patch);
  }
}

export async function changePassword({ currentPassword, newPassword }) {
  return authRequest("/api/auth/password/change", {
    method: "POST",
    body: { currentPassword, newPassword },
  });
}

export async function requestPasswordReset(email) {
  return authRequest("/api/auth/password/request", {
    method: "POST",
    body: { email },
  });
}

export function startSocialLogin(provider) {
  window.location.href = socialLoginUrl(provider);
}

export function appendAudit(state, action, actorId, detail = {}) {
  return [
    ...(state.auditLogs || []),
    {
      id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      action,
      actorId,
      detail,
    },
  ].slice(-300);
}

async function hashPassword(password = "") {
  if (!password) return "";
  if (!globalThis.crypto?.subtle) {
    return btoa(unescape(encodeURIComponent(password)));
  }
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function applyAuthenticatedUser(state, user, action) {
  const normalized = normalizeUser(user);
  if (!normalized.id) return state;
  return {
    ...state,
    currentUserId: normalized.id,
    users: {
      ...(state.users || {}),
      [normalized.id]: normalized,
    },
    auditLogs: appendAudit(state, action, normalized.id),
  };
}

function normalizeUser(user = {}) {
  return {
    id: user.id || "",
    email: user.email || "",
    displayName: user.displayName || user.display_name || user.publicName || user.public_name || user.username || user.email || "Pilot",
    publicName: user.publicName || user.public_name || user.displayName || user.display_name || user.username || "Pilot",
    username: user.username || "",
    avatarUrl: user.avatarUrl || user.avatar_url || "",
    provider: user.provider || "email",
    providerId: user.providerId || user.provider_id || "",
    role: user.role === "visitor" ? "guest" : USER_ROLES.includes(user.role) ? user.role : "user",
    createdAt: user.createdAt || user.created_at || new Date().toISOString(),
    updatedAt: user.updatedAt || user.updated_at || "",
    lastLoginAt: user.lastLoginAt || user.last_login_at || "",
    emailVerified: Boolean(user.emailVerified ?? user.email_verified ?? false),
    isBanned: Boolean(user.isBanned ?? user.is_banned ?? false),
    preferences: normalizePreferences(user.preferences),
    passwordHash: user.passwordHash || user.password_hash || "",
  };
}

function normalizePreferences(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return typeof value === "object" ? value : {};
}

function normalizeSavedDeck(deck = {}) {
  const now = new Date().toISOString();
  return {
    id: deck.id || `deck-${Date.now().toString(36)}`,
    ownerId: deck.ownerId || "local-user",
    name: deck.name || "Untitled deck",
    visibility: deck.visibility === "public" ? "public" : "private",
    archetype: deck.archetype || "",
    colors: Array.isArray(deck.colors) ? deck.colors : [],
    format: deck.format || "Current",
    event: deck.event || "",
    result: deck.result || "",
    notes: deck.notes || "",
    sourceName: deck.sourceName || "",
    sourceUrl: deck.sourceUrl || "",
    externalId: deck.externalId || "",
    designerReport: deck.designerReport && typeof deck.designerReport === "object" ? deck.designerReport : null,
    createdAt: deck.createdAt || now,
    updatedAt: deck.updatedAt || now,
    main: deck.main || {},
    resource: deck.resource || {},
  };
}
