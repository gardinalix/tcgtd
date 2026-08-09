export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  logout: "/logout",
  authCallback: "/auth/callback",
  cards: "/cards",
  card: "/card",
  synergy: "/synergy",
  synergyMap: "/synergy-map",
  decks: "/decks",
  builder: "/deckbuilder",
  deckView: "/deck",
  prices: "/prices",
  meta: "/meta",
  community: "/community",
  events: "/community/events",
  eventDetail: "/community/events",
  players: "/community/players",
  venues: "/community/stores",
  previews: "/leaks",
  profile: "/profile",
  settings: "/settings",
  accountSettings: "/settings/account",
  importExport: "/io",
};

export function parseRoute(location = window.location) {
  const rawHash = location.hash?.replace(/^#/, "") || "";
  const searchParams = new URLSearchParams(location.search || "");
  const hashParams = new URLSearchParams(rawHash.includes("?") ? rawHash.split("?")[1] : rawHash);
  const legacyView = searchParams.get("view") || hashParams.get("view");
  if (legacyView) {
    return { view: legacyView, id: searchParams.get("id") || hashParams.get("id") || "" };
  }

  const path = normalizePath(location.pathname);
  const segments = path.split("/").filter(Boolean);
  if (!segments.length) return { view: "home", id: "" };
  if (segments[0] === "auth" && segments[1] === "callback") return { view: "authCallback", id: segments[2] || "" };
  if (segments[0] === "card") return { view: "card", id: decodeURIComponent(segments[1] || "") };
  if (segments[0] === "synergy") return { view: "synergy", id: decodeURIComponent(segments[1] || "") };
  if (segments[0] === "synergy-map") return { view: "synergyMap", id: decodeURIComponent(segments[1] || "") };
  if (segments[0] === "deck") return { view: "deckView", id: decodeURIComponent(segments[1] || "") };
  if (segments[0] === "events") return { view: segments[1] ? "eventDetail" : "events", id: decodeURIComponent(segments[1] || "") };
  if (segments[0] === "community") {
    if (segments[1] === "events") return { view: segments[2] ? "eventDetail" : "events", id: decodeURIComponent(segments[2] || "") };
    if (segments[1] === "players") return { view: "players", id: "" };
    if (["stores", "venues", "map"].includes(segments[1])) return { view: "venues", id: "" };
    return { view: "community", id: "" };
  }
  if (segments[0] === "settings" && segments[1] === "account") return { view: "accountSettings", id: "" };

  const route = Object.entries(ROUTES).find(([, routePath]) => normalizePath(routePath) === path);
  return { view: route?.[0] || "home", id: "" };
}

export function routeFor(view, id = "") {
  if (view === "card") return `${ROUTES.card}/${encodeURIComponent(id)}`;
  if (view === "synergy") return `${ROUTES.synergy}/${encodeURIComponent(id)}`;
  if (view === "synergyMap") return `${ROUTES.synergyMap}/${encodeURIComponent(id)}`;
  if (view === "deckView") return `${ROUTES.deckView}/${encodeURIComponent(id)}`;
  if (view === "eventDetail") return `${ROUTES.eventDetail}/${encodeURIComponent(id)}`;
  return ROUTES[view] || ROUTES.home;
}

function normalizePath(pathname = "/") {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path.toLowerCase();
}
