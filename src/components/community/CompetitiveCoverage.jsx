import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../../i18n/LocaleProvider";
import { buildMetaCoverage } from "../../domain/metaCoverage.js";
import { buildBattleAnalytics } from "../../domain/battleAnalytics.js";
import { safePublicUrl } from "../../domain/communityContribution.js";
import "./research.css";

export function CompetitiveCoverage({ data, metaWindow }) {
  const { locale } = useLocale();
  const pt = locale === "pt-BR";
  const say = (br, en) => pt ? br : en;
  const [source, setSource] = useState("all");
  const [msa, setMsa] = useState({ state: "loading" });
  const [retry, setRetry] = useState(0);
  const coverage = useMemo(() => buildMetaCoverage(data, metaWindow, source), [data, metaWindow, source]);
  useEffect(() => setSource("all"), [metaWindow?.id]);
  useEffect(() => {
    const controller = new AbortController();
    setMsa({ state: "loading" });
    fetch("/data/competitive/msa-public.json", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Source unavailable");
      const value = await response.json();
      if (value.schemaVersion !== "tcgtd-msa-public-v1" || !Array.isArray(value.items)) throw new Error("Invalid source snapshot");
      if (!controller.signal.aborted) setMsa({ state: "ready", value });
    }).catch(() => { if (!controller.signal.aborted) setMsa({ state: "error" }); });
    return () => controller.abort();
  }, [retry]);
  const battles = useMemo(() => buildBattleAnalytics(msa.value?.items || [], { sourceId: "msa-public" }), [msa.value]);
  const pct = value => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value);
  return (
    <section className="research-surface" data-no-translate aria-label={say("Cobertura e metodologia do meta", "Meta coverage and methodology")}>
      <header className="research-heading">
        <div><span className="research-kicker">TCGTD / META</span><h2>{say("O que os resultados mostram", "What the results show")}</h2><p>{metaWindow?.startDate} → {metaWindow?.endDate}</p></div>
        <label>{say("Fonte deste painel", "Source for this panel")}<select value={source} onChange={event => setSource(event.target.value)}><option value="all">{say("Todas as fontes de torneios", "All tournament sources")}</option>{coverage.sources.map(name => <option key={name}>{name}</option>)}</select></label>
      </header>
      <dl className="research-metrics">
        <div><dt>{say("Resultados", "Results")}</dt><dd>{coverage.results.length}</dd></div>
        <div><dt>{say("Listas com cartas", "Lists with cards")}</dt><dd>{coverage.listCount}</dd></div>
        <div><dt>{say("Eventos", "Events")}</dt><dd>{coverage.eventCount}</dd></div>
        <div><dt>{say("Sem arquétipo", "Unclassified")}</dt><dd>{coverage.unclassified}</dd></div>
      </dl>
      <div className="research-columns">
        <section><h3>{say("Participação nos resultados", "Share of indexed results")}</h3><p>{say("Inclui resultados sem arquétipo. A amostra pode conter apenas os primeiros colocados.", "Includes unclassified results. The sample may include top finishers only.")}</p>
          {coverage.archetypes.length ? <ol className="research-bars">{coverage.archetypes.slice(0, 8).map(row => <li key={row.archetype}>
            <div><span>{row.archetype === "Unclassified" ? say("Sem classificação", "Unclassified") : row.archetype}</span><strong>{pct(row.share)}</strong></div>
            <meter min="0" max="1" value={row.share} aria-label={`${row.archetype}: ${row.results}/${coverage.results.length}`} />
            <small>{row.results} {say("resultados", "results")} · {row.titles} {say("títulos", "titles")}</small>
          </li>)}</ol> : <p role="status">{say("Nenhum resultado neste recorte.", "No results in this scope.")}</p>}
        </section>
        <aside className="research-method"><h3>{say("Como interpretar", "How to read this")}</h3>
          {coverage.ambiguousEventCount > 0 && <p role="status"><strong>{coverage.ambiguousEventCount} {say("eventos com primeiros lugares conflitantes.", "events with conflicting first-place records.")}</strong> {say("Esses agrupamentos precisam de revisão. As contagens representam registros indexados, sujeitos a correção.", "These event groupings need review. Counts represent indexed records and may change after correction.")}</p>}
          <p>{say("Participação = resultados do arquétipo ÷ todos os resultados deste painel. Títulos contam colocações em 1º lugar; não representam vitórias em partidas.", "Share = archetype results ÷ all results in this panel. Titles count first-place finishes; they do not represent match wins.")}</p>
          <p>{say("Taxa de vitória, conversão para Top Cut e matchups exigem partidas ou o campo completo. Esses indicadores não são derivados de listas de colocados.", "Win rate, top-cut conversion and matchups require matches or the complete field. These metrics are not derived from top-finisher lists.")}</p>
          <details><summary>{say("Consultar os eventos e as fontes", "Inspect events and sources")}</summary><ul>{coverage.events.map(event => <li key={event.eventId}>{safePublicUrl(event.sourceUrl) ? <a href={safePublicUrl(event.sourceUrl)} target="_blank" rel="noreferrer">{event.eventName}</a> : event.eventName}<small>{event.eventDate} · {event.sourceName}</small></li>)}</ul></details>
          <section className="research-digital"><span className="research-kicker">MOBILE SUIT ARENA</span><h3>{say("Partidas digitais", "Digital matches")}</h3>
            {msa.state === "loading" ? <p role="status">{say("Consultando cobertura…", "Loading coverage…")}</p> : msa.state === "error" ? <div role="status"><p>{say("Não foi possível carregar a cobertura do MSA.", "MSA coverage could not be loaded.")}</p><button onClick={() => setRetry(value => value + 1)}>{say("Tentar novamente", "Try again")}</button></div> : <>
              <p><strong>{msa.value.items.length}</strong> {say("partidas no resumo público observado.", "games in the observed public summary.")} <strong>{battles.games}</strong> {say("aptas para análise de arquétipos.", "eligible for archetype analysis.")}</p>
              <p>{say("O resumo não informa datas de partidas nem decks. Não permite calcular um meta histórico ou taxa de vitória por arquétipo.", "The summary provides neither match dates nor decks. It cannot support historical meta or archetype win rates.")}</p>
              <small>{say("Consultado em", "Observed at")} {new Date(msa.value.observedAt).toLocaleString(locale)} · {say("amostra parcial", "partial sample")}</small>
              <a href="https://mobilesuitarena.com/#season" target="_blank" rel="noreferrer">{say("Ver a fonte pública", "View public source")} ↗</a>
            </>}
          </section>
        </aside>
      </div>
    </section>
  );
}
