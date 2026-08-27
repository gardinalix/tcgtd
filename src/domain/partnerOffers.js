import { getPriceTelemetry } from "./cards.js";

const LIGAGUNDAM_HOSTS = new Set(["ligagundam.com.br", "www.ligagundam.com.br"]);

const LIGAGUNDAM_PARTNER_STATUS = import.meta.env?.VITE_LIGAGUNDAM_PARTNER_STATUS === "affiliate"
  ? "affiliate"
  : "pilot";

export function getLigaGundamPartnerOffer(card) {
  const listing = getPriceTelemetry(card).comparison.find((source) => source.code === "LIGA" && isLigaGundamUrl(source.url));
  if (!listing) return null;

  const query = new URLSearchParams({
    to: listing.url,
    card: String(card?.cardNumber || "").slice(0, 80),
    printing: String(card?.displayId || card?.detailSearchId || card?.cardNumber || "").slice(0, 120),
    from: typeof window === "undefined" ? "/" : window.location.pathname,
  });

  return {
    id: "ligagundam",
    name: "LigaGundam",
    status: LIGAGUNDAM_PARTNER_STATUS,
    href: `/go/ligagundam?${query.toString()}`,
    priceBrl: listing.value,
    listingCount: Number(card?.ligaGundamListingCount || 0),
  };
}

function isLigaGundamUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && LIGAGUNDAM_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
