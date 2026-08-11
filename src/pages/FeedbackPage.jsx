import { useState } from "react";
import { submitAlphaFeedback } from "../domain/feedback";
import { useLocale } from "../i18n/LocaleProvider";

const CATEGORIES = [
  ["bug", "Falha ou comportamento incorreto", "Bug or incorrect behavior"],
  ["data", "Erro de carta, deck ou meta", "Card, deck or meta data issue"],
  ["layout", "Layout, leitura ou responsividade", "Layout, readability or responsiveness"],
  ["rights", "Direitos autorais ou atribuição", "Copyright or attribution"],
  ["suggestion", "Sugestão para o produto", "Product suggestion"],
];

export function FeedbackPage({ user, onNavigate }) {
  const { locale } = useLocale();
  const pt = locale === "pt-BR";
  const [form, setForm] = useState({ category: "bug", message: "", contactEmail: user?.email || "", website: "" });
  const [state, setState] = useState({ status: "idle", message: "" });

  async function submit(event) {
    event.preventDefault();
    setState({ status: "sending", message: pt ? "TRANSMITINDO RELATÓRIO…" : "TRANSMITTING REPORT…" });
    try {
      await submitAlphaFeedback({
        ...form,
        locale,
        pagePath: window.location.pathname,
      });
      setForm((current) => ({ ...current, message: "", website: "" }));
      setState({
        status: "sent",
        message: pt ? "RELATÓRIO RECEBIDO // OBRIGADO POR AJUDAR O ALPHA" : "REPORT RECEIVED // THANK YOU FOR SUPPORTING THE ALPHA",
      });
    } catch (error) {
      setState({ status: "error", message: error.message });
    }
  }

  return (
    <article className="institutional-page alpha-feedback-page">
      <header>
        <small>TCG TACTICAL DATABASE // PUBLIC ALPHA 01</small>
        <h1>{pt ? "Transmita um relatório de campo." : "Transmit a field report."}</h1>
        <p>{pt
          ? "Use este canal para erros de dados, falhas de interface, problemas no mobile, sugestões e solicitações de titulares de direitos."
          : "Use this channel for data errors, interface failures, mobile issues, suggestions and rights-holder requests."}</p>
      </header>

      <div className="alpha-feedback-layout">
        <form className="alpha-feedback-terminal" onSubmit={submit}>
          <div className="alpha-feedback-terminal__head">
            <span>FIELD REPORT // INPUT CHANNEL</span>
            <b className={`is-${state.status}`}>{state.message || (pt ? "CANAL ONLINE" : "CHANNEL ONLINE")}</b>
          </div>

          <label>
            <span>{pt ? "TIPO DE RELATÓRIO" : "REPORT TYPE"}</span>
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {CATEGORIES.map(([value, br, en]) => <option key={value} value={value}>{pt ? br : en}</option>)}
            </select>
          </label>

          <label>
            <span>{pt ? "DESCRIÇÃO" : "DESCRIPTION"}</span>
            <textarea
              required
              minLength={20}
              maxLength={3000}
              rows={8}
              value={form.message}
              placeholder={pt ? "Informe a página, o que ocorreu e o resultado esperado…" : "Include the page, what happened and the expected result…"}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
            />
            <small>{form.message.length} / 3000</small>
          </label>

          <label>
            <span>{pt ? "E-MAIL PARA RETORNO // OPCIONAL" : "REPLY E-MAIL // OPTIONAL"}</span>
            <input
              type="email"
              maxLength={254}
              value={form.contactEmail}
              placeholder="pilot@example.com"
              onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
            />
          </label>

          <label className="alpha-feedback-honeypot" aria-hidden="true">
            Website
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
          </label>

          <div className="alpha-feedback-terminal__actions">
            <button type="button" className="ghost-command" onClick={() => onNavigate("privacy")}>{pt ? "COMO TRATAMOS OS DADOS" : "HOW WE HANDLE DATA"}</button>
            <button type="submit" disabled={state.status === "sending" || form.message.trim().length < 20}>
              {state.status === "sending" ? (pt ? "TRANSMITINDO…" : "TRANSMITTING…") : (pt ? "TRANSMITIR RELATÓRIO" : "TRANSMIT REPORT")}
            </button>
          </div>
        </form>

        <aside className="alpha-feedback-brief">
          <span>ALPHA OPERATIONS SCOPE</span>
          <dl>
            <div><dt>{pt ? "ACESSO" : "ACCESS"}</dt><dd>{pt ? "Público por link" : "Public by link"}</dd></div>
            <div><dt>{pt ? "CUSTO FIXO" : "FIXED COST"}</dt><dd>R$ 0</dd></div>
            <div><dt>{pt ? "DECKS" : "DECKS"}</dt><dd>{pt ? "Locais neste alpha" : "Device-local in this alpha"}</dd></div>
            <div><dt>{pt ? "COBRANÇA" : "BILLING"}</dt><dd>{pt ? "Não implementada" : "Not implemented"}</dd></div>
          </dl>
          <p>{pt
            ? "Não envie senhas, tokens, dados financeiros ou informações sensíveis. Para solicitações de direitos, identifique o material e forneça um contato verificável."
            : "Do not send passwords, tokens, financial data or sensitive information. For rights requests, identify the material and provide a verifiable contact."}</p>
        </aside>
      </div>
    </article>
  );
}
