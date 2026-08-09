import { useEffect, useMemo, useState } from "react";
import {
  getDeckAssistantStatus,
  sendDeckAssistantMessage,
} from "../../services/deckDesigner/deckAssistant.js";

const QUICK_COMMANDS = [
  "Analisar consistência",
  "Melhorar contra o meta",
  "Identificar bricks",
  "Analisar curva",
  "Sugerir cortes",
  "Criar plano de mulligan",
];

export function DeckAssistantPanel({ open, onOpenChange, context, onApplySuggestion }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState("Abra o canal para verificar a conexão.");
  const [providerState, setProviderState] = useState({ state: "idle", provider: "none", model: "" });
  const assistantAvailable = providerState.state === "online";

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setProviderState((current) => ({ ...current, state: "checking" }));
    setStatus("Verificando conexão com o modelo…");
    getDeckAssistantStatus()
      .then((remote) => {
        if (cancelled) return;
        if (remote.configured && (!remote.requiresAuthentication || remote.authenticated)) {
          setProviderState({ state: "online", provider: remote.provider, model: remote.model });
          setStatus(`${providerName(remote.provider)} conectado · ${remote.model}`);
        } else if (remote.configured && remote.requiresAuthentication) {
          setProviderState({ state: "locked", provider: remote.provider, model: remote.model });
          setStatus("Entre no sistema para ativar a análise remota.");
        } else {
          setProviderState({ state: "offline", provider: "none", model: "" });
          setStatus("Modelo remoto não configurado.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setProviderState({ state: "offline", provider: "none", model: "" });
        setStatus("Não foi possível verificar o modelo remoto.");
      });
    return () => { cancelled = true; };
  }, [open]);

  async function submitMessage(text = input) {
    const message = String(text || "").trim();
    if (!message || busy || !assistantAvailable) return;
    const userMessage = { id: `user-${Date.now().toString(36)}`, role: "user", text: message };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setBusy(true);
    setStatus("Analisando dados estruturados do deck…");
    try {
      const response = await sendDeckAssistantMessage({
        message,
        context,
        conversation: messages.slice(-8).map((entry) => ({
          role: entry.role,
          content: entry.text || entry.response?.message || "",
        })),
      });
      setMessages((current) => [...current, {
        id: response.id,
        role: "assistant",
        response,
      }]);
      setProviderState({ state: "online", provider: response.provider, model: response.model });
      setStatus(`Análise concluída por ${providerName(response.provider)}${response.model ? ` · ${response.model}` : ""}.`);
    } catch (error) {
      const response = {
        id: `assistant-error-${Date.now().toString(36)}`,
        message: error?.message || "O modelo remoto não concluiu a análise.",
        evidenceType: "insufficient_data",
        caveats: ["Nenhuma análise local foi apresentada como se tivesse sido gerada pelo modelo."],
        suggestion: null,
        provider: "error",
        model: "",
      };
      setMessages((current) => [...current, {
        id: response.id,
        role: "assistant",
        response,
      }]);
      setStatus("Falha no modelo remoto. Tente transmitir novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`forge-assistant-launcher ${open ? "is-open" : ""}`.trim()}
        aria-label={open ? "Fechar assistente da FORJA" : "Abrir assistente da FORJA"}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <i aria-hidden="true" />
        <span><small>FORJA AI</small><strong>NÚCLEO ESTRATÉGICO</strong></span>
      </button>
      <section
        className={`forge-assistant-panel ${open ? "is-open" : ""} ${expanded ? "is-expanded" : ""}`.trim()}
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-label="Assistente competitivo da FORJA"
        aria-hidden={!open}
      >
        <header>
          <div>
            <span>DATABASE / TACTICAL CHANNEL</span>
            <strong>ASSISTENTE COMPETITIVO</strong>
            <small className={`is-${providerState.state}`}>{status}</small>
          </div>
          <button type="button" onClick={() => setExpanded((current) => !current)} aria-label={expanded ? "Reduzir assistente" : "Expandir assistente"}>{expanded ? "REDUZIR" : "EXPANDIR"}</button>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Fechar assistente">×</button>
        </header>

        <div className="forge-assistant-context" aria-label="Contexto automático">
          <span><small>DECK</small><strong>{context.deckName}</strong></span>
          <span><small>META</small><strong>{context.selectedMetaId}</strong></span>
          <span><small>MAIN</small><strong>{context.statistics?.mainCount}/{context.statistics?.maxMain}</strong></span>
          <span className={context.validation?.legal ? "is-ok" : "is-warn"}><small>STATUS</small><strong>{context.validation?.legal ? "VÁLIDO" : "EM ANÁLISE"}</strong></span>
        </div>

        <div className="forge-assistant-quick" aria-label="Comandos rápidos">
          {QUICK_COMMANDS.map((command) => (
            <button key={command} type="button" onClick={() => submitMessage(command)} disabled={busy || !assistantAvailable}>{command}</button>
          ))}
        </div>

        <div className="forge-assistant-messages" aria-live="polite">
          {!messages.length && !busy ? (
            <article className="is-empty">
              <span>FORJA AI</span>
              <p>{assistantAvailable ? "Modelo conectado. Escolha um comando rápido ou descreva o que deseja analisar." : providerState.state === "locked" ? "A análise local continua disponível; a IA remota exige uma sessão autenticada." : "Aguardando conexão com um modelo remoto para iniciar a análise."}</p>
            </article>
          ) : null}
          {messages.map((entry) => entry.role === "user" ? (
            <article key={entry.id} className="is-user">
              <span>PILOTO</span>
              <p>{entry.text}</p>
            </article>
          ) : (
            <AssistantResponse
              key={entry.id}
              response={entry.response}
              context={context}
              onApply={onApplySuggestion}
            />
          ))}
          {busy ? <article className="is-loading"><span>FORJA AI</span><p>Correlacionando curva, funções, legalidade e meta…</p></article> : null}
        </div>

        <form
          className="forge-assistant-composer"
          onSubmit={(event) => {
            event.preventDefault();
            submitMessage();
          }}
        >
          <label>
            <span>Mensagem para o núcleo estratégico</span>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ex.: onde esta lista perde consistência?" rows={2} disabled={!assistantAvailable} />
          </label>
          <button type="submit" disabled={busy || !assistantAvailable || !input.trim()}>TRANSMITIR</button>
        </form>
      </section>
    </>
  );
}

function AssistantResponse({ response, context, onApply }) {
  const [selected, setSelected] = useState(() => ({}));
  const operations = useMemo(() => [
    ...(response.suggestion?.remove || []).map((item, index) => ({ ...item, kind: "remove", id: item.id || `remove:${item.cardId}:${index}` })),
    ...(response.suggestion?.add || []).map((item, index) => ({ ...item, kind: "add", id: item.id || `add:${item.cardId}:${index}` })),
  ], [response.suggestion]);
  const cardNames = useMemo(() => new Map((context.cards || []).map((card) => [card.cardId, card.name])), [context.cards]);
  const selectedIds = operations.filter((operation) => selected[operation.id] !== false).map((operation) => operation.id);

  return (
    <article className="is-assistant">
      <span>{providerLabel(response.provider)} · {evidenceLabel(response.evidenceType)}</span>
      <p>{response.message}</p>
      {response.caveats?.length ? (
        <ul>{response.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul>
      ) : null}
      {operations.length ? (
        <section className="forge-assistant-diff">
          <header><strong>ALTERAÇÃO PROPOSTA</strong><span>confiança {response.suggestion.confidence}</span></header>
          {operations.map((operation) => (
            <label key={operation.id} className={`is-${operation.kind}`}>
              <input
                type="checkbox"
                checked={selected[operation.id] !== false}
                onChange={(event) => setSelected((current) => ({ ...current, [operation.id]: event.target.checked }))}
              />
              <b>{operation.kind === "remove" ? "−" : "+"}{operation.quantity}</b>
              <span><strong>{cardNames.get(operation.cardId) || operation.cardId}</strong><small>{operation.reason}</small></span>
            </label>
          ))}
          <p>{response.suggestion.expectedImpact}</p>
          <div>
            <button type="button" onClick={() => onApply?.(response.suggestion, operations.map((item) => item.id))}>APLICAR TUDO</button>
            <button type="button" disabled={!selectedIds.length} onClick={() => onApply?.(response.suggestion, selectedIds)}>APLICAR PARCIAL</button>
          </div>
        </section>
      ) : null}
    </article>
  );
}

function evidenceLabel(value) {
  return {
    objective: "PROBLEMA OBJETIVO",
    inference: "INFERÊNCIA",
    preference: "PREFERÊNCIA DE BUILD",
    meta: "SINAL DO META",
    insufficient_data: "DADOS INSUFICIENTES",
  }[value] || "ANÁLISE";
}

function providerName(value) {
  return {
    gemini: "Gemini",
    openai: "OpenAI",
  }[value] || "modelo remoto";
}

function providerLabel(value) {
  return {
    gemini: "FORJA AI · GEMINI",
    openai: "FORJA AI · OPENAI",
    error: "FORJA AI · ERRO REMOTO",
  }[value] || "FORJA AI";
}
