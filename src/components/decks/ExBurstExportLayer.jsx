import { useEffect, useMemo, useState } from "react";
import { buildExBurstDeckText, downloadDeckText } from "../../domain/deckExport.js";

export function ExBurstExportLayer({ report, onClose }) {
  const content = useMemo(() => buildExBurstDeckText(report), [report]);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function copyForExBurst() {
    try {
      await navigator.clipboard.writeText(content);
      setCopyStatus("List copied. Paste it into ExBurst's text import.");
    } catch {
      setCopyStatus("Automatic copy was blocked. Select the text and copy it manually.");
    }
  }

  return (
    <div
      className="deck-export-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="deck-export-layer__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deck-export-title"
      >
        <div className="deck-export-layer__scan" aria-hidden="true" />
        <header>
          <div>
            <span className="eyebrow">TRANSFER LAYER // EXBURST</span>
            <h2 id="deck-export-title">ExBurst text format</h2>
            <p>One entry per card in <code>4xCARD-NUMBER</code> format, ready to copy or save.</p>
          </div>
          <button type="button" className="deck-export-layer__close" onClick={onClose} aria-label="Close export layer">×</button>
        </header>
        <div className="deck-export-layer__telemetry">
          <span><small>MAIN DECK</small><strong>{report.stats?.mainCount || 0} / 50</strong></span>
          <span><small>UNIQUE CARDS</small><strong>{report.rows?.length || 0}</strong></span>
          <span><small>FORMAT</small><strong>EXBURST TXT</strong></span>
        </div>
        <label className="deck-export-layer__payload">
          <span>DECK PAYLOAD</span>
          <textarea
            readOnly
            value={content}
            spellCheck="false"
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        <footer>
          <div aria-live="polite">{copyStatus || "Resource cards are managed separately from the 50-card main deck."}</div>
          <nav aria-label="Export actions">
            <button type="button" onClick={copyForExBurst}>Copy for ExBurst</button>
            <button type="button" onClick={() => downloadDeckText(content, report.title)}>Download .TXT</button>
            <a href="https://exburst.dev/gundam" target="_blank" rel="noreferrer">Open ExBurst</a>
          </nav>
        </footer>
      </section>
    </div>
  );
}
