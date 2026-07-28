const API_BASE = "";

export class AuthApiUnavailableError extends Error {
  constructor(message = "Authentication server is unavailable.") {
    super(message);
    this.name = "AuthApiUnavailableError";
  }
}

export async function authRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  }).catch((error) => {
    throw new AuthApiUnavailableError(error.message);
  });

  const payload = await readJson(response);
  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || "Authentication request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function socialLoginUrl(provider) {
  const redirect = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/api/auth/oauth/${encodeURIComponent(provider)}/start?redirect=${encodeURIComponent(redirect)}`;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
