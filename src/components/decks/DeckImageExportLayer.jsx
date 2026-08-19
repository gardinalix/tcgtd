import { useEffect, useMemo, useState } from "react";
import {
  buildDeckSheetModel,
  deckSheetFilename,
  downloadDeckSheetBlob,
  renderDeckSheetPng,
} from "../../domain/deckImageExport.js";

export function DeckImageExportLayer({ deck, rows, stats, onClose }) {
  const model = useMemo(() => buildDeckSheetModel({ deck, rows, stats }), [deck, rows, stats]);
  const [renderState, setRenderState] = useState({ phase: "rendering", blob: null, previewUrl: "", error: "" });
  const [copyStatus, setCopyStatus] = useState("");
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof File === "function";
  const canCopyImage = typeof navigator !== "undefined"
    && typeof navigator.clipboard?.write === "function"
    && typeof ClipboardItem === "function";

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    setCopyStatus("");
    setRenderState({ phase: "rendering", blob: null, previewUrl: "", error: "" });
    renderDeckSheetPng({ deck, rows, stats })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setRenderState({ phase: "ready", blob, previewUrl: objectUrl, error: "" });
      })
      .catch((error) => {
        if (cancelled) return;
        setRenderState({ phase: "error", blob: null, previewUrl: "", error: error?.message || "Não foi possível gerar a imagem." });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [deck, rows, stats]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function shareDeckSheet() {
    if (!renderState.blob || !canShare) return;
    const file = new File([renderState.blob], deckSheetFilename(model.title), { type: "image/png" });
    try {
      await navigator.share({
        title: model.title,
        text: `${model.title} · TCG Tactical Database`,
        files: [file],
      });
    } catch (error) {
      if (error?.name !== "AbortError") downloadDeckSheetBlob(renderState.blob, model.title);
    }
  }

  async function copyDeckSheet() {
    if (!renderState.blob) return;
    if (!canCopyImage) {
      setCopyStatus("Este navegador não permite copiar imagens diretamente. Use Baixar PNG.");
      return;
    }
    setCopyStatus("COPIANDO IMAGEM…");
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": renderState.blob }),
      ]);
      setCopyStatus("IMAGEM COPIADA // PRONTA PARA COLAR");
    } catch {
      setCopyStatus("O navegador bloqueou o clipboard. Autorize o acesso ou use Baixar PNG.");
    }
  }

  return (
    <div
      className="deck-sheet-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="deck-sheet-console" role="dialog" aria-modal="true" aria-labelledby="deck-sheet-title">
        <header className="deck-sheet-console__header">
          <div>
            <span className="eyebrow">OUTPUT CHANNEL // TACTICAL DECK SHEET</span>
            <h2 id="deck-sheet-title">Imagem tática da decklist</h2>
            <p>Uma composição pronta para compartilhar, com as cartas, quantidades e telemetria do deck.</p>
          </div>
          <button type="button" className="deck-sheet-console__close" onClick={onClose} aria-label="Fechar exportação">×</button>
        </header>

        <div className="deck-sheet-console__body">
          <div className={`deck-sheet-console__preview is-${renderState.phase}`} aria-live="polite">
            {renderState.phase === "rendering" ? (
              <div className="deck-sheet-console__loading">
                <i aria-hidden="true" />
                <strong>COMPONDO DECK SHEET</strong>
                <span>Sincronizando {model.uniqueCount} imagens e canais táticos…</span>
              </div>
            ) : null}
            {renderState.phase === "ready" ? <img src={renderState.previewUrl} alt={`Prévia exportável do deck ${model.title}`} /> : null}
            {renderState.phase === "error" ? (
              <div className="deck-sheet-console__error">
                <strong>FALHA NO CANAL DE IMAGEM</strong>
                <span>{renderState.error}</span>
              </div>
            ) : null}
          </div>

          <aside className="deck-sheet-console__rail">
            <span className="eyebrow">EXPORT TELEMETRY</span>
            <h3>{model.title}</h3>
            <dl>
              <div><dt>Main deck</dt><dd>{model.mainCount}</dd></div>
              <div><dt>Cartas únicas</dt><dd>{model.uniqueCount}</dd></div>
              <div><dt>Formato</dt><dd>{model.format}</dd></div>
              <div><dt>Resultado</dt><dd>{model.result}</dd></div>
            </dl>
            <div className="deck-sheet-console__channels">
              {(model.colors.length ? model.colors : [{ label: "Color open", channel: "neutral" }]).map((color) => (
                <span key={color.label} data-card-color={color.channel}>{color.label}</span>
              ))}
            </div>
            <p>O PNG é gerado apenas no seu navegador. Nenhuma decklist ou imagem é enviada para um serviço externo.</p>
          </aside>
        </div>

        <footer className="deck-sheet-console__footer">
          <span aria-live="polite">{copyStatus || (renderState.phase === "ready" ? "PNG READY // HIGH RESOLUTION" : "RENDER CHANNEL ACTIVE")}</span>
          <nav aria-label="Ações da imagem da decklist">
            <button
              type="button"
              disabled={!renderState.blob}
              onClick={copyDeckSheet}
              title={canCopyImage ? "Copiar PNG para o clipboard" : "Clipboard de imagem não suportado neste navegador"}
            >
              COPIAR IMAGEM
            </button>
            <button
              type="button"
              disabled={!renderState.blob}
              onClick={() => downloadDeckSheetBlob(renderState.blob, model.title)}
            >
              BAIXAR PNG
            </button>
            {canShare ? <button type="button" disabled={!renderState.blob} onClick={shareDeckSheet}>COMPARTILHAR</button> : null}
          </nav>
        </footer>
      </section>
    </div>
  );
}
