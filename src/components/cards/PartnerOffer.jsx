import { useLocale } from "../../i18n/LocaleProvider";
import { formatBrl } from "../../domain/cards";
import { getLigaGundamPartnerOffer } from "../../domain/partnerOffers";

export function PartnerOffer({ card }) {
  const offer = getLigaGundamPartnerOffer(card);
  const { locale } = useLocale();
  if (!offer) return null;

  const pt = locale === "pt-BR";
  const hasAffiliateRelationship = offer.status === "affiliate";
  const listingLabel = offer.listingCount === 1
    ? (pt ? "1 anúncio sincronizado" : "1 synced listing")
    : (pt ? `${offer.listingCount || "—"} anúncios sincronizados` : `${offer.listingCount || "—"} synced listings`);

  return (
    <section className="partner-offer" aria-label={pt ? "Oferta externa da LigaGundam" : "LigaGundam external offer"}>
      <div className="partner-offer__header">
        <span>{hasAffiliateRelationship ? (pt ? "OFERTA PARCEIRA" : "PARTNER OFFER") : (pt ? "PILOTO DE OFERTA" : "OFFER PILOT")}</span>
        <strong>{offer.name}</strong>
      </div>
      <div className="partner-offer__body">
        <div>
          <small>{pt ? "MENOR ANÚNCIO SINCRONIZADO" : "LOWEST SYNCED LISTING"}</small>
          <b>{formatBrl(offer.priceBrl)}</b>
          <em>{listingLabel}</em>
        </div>
        <a href={offer.href} target="_blank" rel="noopener noreferrer external">
          {pt ? "ABRIR OFERTA" : "OPEN OFFER"}
        </a>
      </div>
      <p>
        {hasAffiliateRelationship
          ? (pt
            ? "Este link pode gerar comissão para o TCGTD. Isso não altera o preço, a ordem do radar ou a análise."
            : "This link may generate a commission for TCGTD. It never changes the price, radar order, or analysis.")
          : (pt
            ? "Piloto de integração: a saída mede interesse pela oferta. A relação comercial ainda não está ativa."
            : "Integration pilot: the exit measures offer interest. The commercial relationship is not active yet.")}
      </p>
    </section>
  );
}
