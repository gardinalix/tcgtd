import { useRef, useState } from "react";
import { CommunityNav } from "../components/community/CommunityNav";
import { TacticalPageShell } from "../components/tactical/TacticalPageShell";
import { useLocale } from "../i18n/LocaleProvider";
import { CONTRIBUTION_SCHEMA, validateContribution, contributionError } from "../domain/communityContribution.js";
import "../components/community/research.css";

const emptyResult = () => ({ placement: "", playerName: "", archetype: "", deckUrl: "" });
export function ContributePage({ onNavigate }) {
  const { locale } = useLocale();
  const pt = locale === "pt-BR";
  const say = (br, en) => pt ? br : en;
  const [event, setEvent] = useState({ name: "", date: "", organizer: "", country: "", city: "", format: "", sourceUrl: "", playerCount: "" });
  const [results, setResults] = useState([emptyResult()]);
  const [consent, setConsent] = useState(false);
  const [review, setReview] = useState(null);
  const [downloaded, setDownloaded] = useState(false);
  const reviewRef = useRef(null);
  function invalidate() { setReview(null); setDownloaded(false); }
  function updateEvent(key, value) { setEvent(current => ({ ...current, [key]: value })); invalidate(); }
  function updateResult(index, key, value) { setResults(current => current.map((row, i) => i === index ? { ...row, [key]: value } : row)); invalidate(); }
  function prepare(e) {
    e.preventDefault();
    setReview(validateContribution({ schemaVersion: CONTRIBUTION_SCHEMA, event, results, publicDataConfirmed: consent }));
    setDownloaded(false);
    requestAnimationFrame(() => reviewRef.current?.focus());
  }
  function download() {
    const blob = new Blob([JSON.stringify(review.value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `tcgtd-event-${event.date}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  }
  return <TacticalPageShell className="community-terminal-page community-contribution-page">
    <CommunityNav active="contribute" onNavigate={onNavigate} />
    <section className="research-surface" data-no-translate>
      <header className="research-heading"><div><span className="research-kicker">TCGTD / {say("COMUNIDADE", "COMMUNITY")}</span><h1>{say("Contribua com resultados", "Contribute event results")}</h1><p>{say("Para lojas e organizadores: prepare um arquivo para a equipe TCGTD revisar e importar.", "For stores and organizers: prepare a file for the TCGTD team to review and import.")}</p></div></header>
      <p>{say("O formulário gera um arquivo no seu dispositivo. Depois de baixá-lo, encaminhe-o à equipe pelo canal que vocês já utilizam. Nada é enviado ou publicado automaticamente.", "This form creates a file on your device. After downloading, send it to the team through your existing contact channel. Nothing is submitted or published automatically.")}</p>
      <form onSubmit={prepare} className="contribution-form">
        <fieldset><legend>1. {say("Evento e fonte", "Event and source")}</legend><div className="contribution-fields">
          {[["name", say("Nome do evento", "Event name"), "text", true], ["organizer", say("Loja / organizador", "Store / organizer"), "text", true], ["date", say("Data do evento", "Event date"), "date", true], ["playerCount", say("Participantes (opcional)", "Participants (optional)"), "number", false], ["country", say("País: BR, US… (opcional)", "Country: BR, US… (optional)"), "text", false], ["city", say("Cidade (opcional)", "City (optional)"), "text", false], ["format", say("Formato / coleção (opcional)", "Format / set (optional)"), "text", false], ["sourceUrl", say("Link público dos resultados", "Public results URL"), "url", true]].map(([key, label, type, required]) => <label key={key}>{label}<input type={type} required={required} value={event[key]} maxLength={key === "country" ? 2 : key === "sourceUrl" ? 4096 : 160} min={type === "number" ? 1 : undefined} max={type === "date" ? new Date().toISOString().slice(0, 10) : undefined} onChange={e => updateEvent(key, e.target.value)} /></label>)}
        </div></fieldset>
        <fieldset><legend>2. {say("Resultados publicados", "Published results")}</legend><p>{say("Inclua apenas o que a fonte confirma. Use o apelido público do jogador. Deixe o arquétipo em branco se desconhecido.", "Include only what the source confirms. Use public player handles. Leave unknown archetypes blank.")}</p>
          {results.map((row, index) => <div className="contribution-result" key={index}><h3>{say("Resultado", "Result")} {index + 1}</h3><div className="contribution-fields">
            {[["placement", say("Colocação", "Placement"), "number"], ["playerName", say("Jogador", "Player"), "text"], ["archetype", say("Arquétipo (opcional)", "Archetype (optional)"), "text"], ["deckUrl", say("Link do deck (opcional)", "Deck URL (optional)"), "url"]].map(([key, label, type]) => <label key={key}>{label}<input aria-label={`${label} ${index + 1}`} type={type} required={["placement", "playerName"].includes(key)} min={type === "number" ? 1 : undefined} maxLength={key === "deckUrl" ? 4096 : 160} value={row[key]} onChange={e => updateResult(index, key, e.target.value)} /></label>)}
          </div>{results.length > 1 && <button type="button" onClick={() => { setResults(rows => rows.filter((_, i) => i !== index)); invalidate(); }}>{say("Remover resultado", "Remove result")} {index + 1}</button>}</div>)}
          <button type="button" disabled={results.length >= 256} onClick={() => { setResults(rows => [...rows, emptyResult()]); invalidate(); }}>+ {say("Adicionar resultado", "Add result")}</button>
        </fieldset>
        <label className="contribution-consent"><input type="checkbox" required checked={consent} onChange={e => { setConsent(e.target.checked); invalidate(); }} /><span>{say("Confirmo que estes resultados e apelidos podem ser publicados e que tenho autorização para encaminhá-los.", "I confirm these results and player handles may be published and that I am authorized to provide them.")}</span></label>
        <button type="submit" className="research-primary">{say("Revisar contribuição", "Review contribution")}</button>
      </form>
      <div ref={reviewRef} tabIndex="-1" aria-live="polite" className="contribution-review">
        {review && (review.valid ? <><h2>{say("Confira antes de baixar", "Review before downloading")}</h2><p>{review.value.event.name} · {review.value.event.date} · {review.value.results.length} {say("resultado(s)", "result(s)")}</p><p>{say("A validação confere o preenchimento. A equipe ainda precisa verificar a fonte, duplicatas e eventuais correções.", "Validation checks the form. The team still needs to verify the source, duplicates and any corrections.")}</p><button type="button" onClick={download}>{say("Baixar arquivo para revisão", "Download file for review")}</button>{downloaded && <p role="status">{say("Arquivo gerado. Encaminhe-o à equipe TCGTD para revisão. O evento ainda não foi importado.", "File generated. Send it to the TCGTD team for review. The event has not been imported yet.")}</p>}</> : <><h2>{say("Revise os dados", "Check the data")}</h2><ul>{review.errors.map(error => <li key={error}>{contributionError(error, locale)}</li>)}</ul></>)}
      </div>
    </section>
  </TacticalPageShell>;
}
