export const ACCOUNT_ROLES = Object.freeze(["user", "moderator", "admin"]);
export const SUPPORT_PLANS = Object.freeze(["free", "supporter"]);

export const ENTITLEMENTS = Object.freeze({
  FORGE_REMOTE_AI: "forge.remote_ai",
  ADVANCED_META: "meta.advanced",
  ADVANCED_STATISTICS: "statistics.advanced",
});

export function hasEntitlement(user, code, now = Date.now()) {
  if (!user || !code) return false;
  if (user.role === "admin") return true;
  return (user.entitlements || []).some((entry) => {
    if (typeof entry === "string") return entry === code;
    if (entry?.code !== code || entry.revokedAt) return false;
    if (!entry.endsAt) return true;
    return new Date(entry.endsAt).getTime() > now;
  });
}

export function normalizeAccessProfile(user = {}) {
  return {
    role: ACCOUNT_ROLES.includes(user.role) ? user.role : "user",
    plan: SUPPORT_PLANS.includes(user.plan) ? user.plan : "free",
    entitlements: Array.isArray(user.entitlements) ? user.entitlements : [],
  };
}
