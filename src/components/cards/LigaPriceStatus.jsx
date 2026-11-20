import { useLocale } from "../../i18n/LocaleProvider";

export function LigaPriceStatus({ status }) {
  const { locale } = useLocale();
  if (!status || status.status === "ok") return null;
  const pt = locale === "pt-BR";
  const date = status.lastObservationAt ? new Date(status.lastObservationAt).toLocaleDateString(locale) : "—";
  const blocked = status.status === "blocked" || status.automaticStatus === "blocked";
  return <p className="liga-price-status" role="status">
    <strong>LigaGundam: {blocked ? (pt ? "coleta automática bloqueada pela fonte" : "automatic collection blocked by source") : (pt ? "coleta incompleta" : "collection incomplete")}.</strong>{" "}
    {status.retainedListings ? (pt ? `${status.observedListings || 0} anúncios conferidos nesta atualização; ${status.retainedListings} preservados com suas datas anteriores. ` : `${status.observedListings || 0} listings checked in this update; ${status.retainedListings} retained with their original dates. `) : ""}
    {pt ? `Última observação: ${date}. Confirme o valor e o estoque na loja.` : `Last observation: ${date}. Confirm price and stock at the store.`}
  </p>;
}
