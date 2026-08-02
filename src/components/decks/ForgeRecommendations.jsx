import { useMemo, useState } from "react";

export function ForgeRecommendations({ recommendations, onImport }) {
  const [color, setColor] = useState("Any");
  const [query, setQuery] = useState("");
  const colors = useMemo(() => [...new Set(recommendations.flatMap((item) => splitColors(item.result.colorCombination)))].sort(), [recommendations]);
  const visible = recommendations
    .filter((item) => color === "Any" || splitColors(item.result.colorCombination).includes(color))
    .filter((item) => !query || `${item.result.archetype} ${item.result.playerName} ${item.result.eventName}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);
  return (
    <section className="forge-recommendations">
      <header>
        <div><strong>LINHAS COMPETITIVAS</strong><span>score ponderado por recência e evento</span></div>
        <div>
          <select value={color} onChange={(event) => setColor(event.target.value)} aria-label="Filtrar recomendações por cor">
            <option value="Any">Todas as cores</option>
            {colors.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Arquétipo, piloto ou evento" aria-label="Buscar recomendações" />
        </div>
      </header>
      <div>
        {visible.map((item, index) => (
          <article key={item.id}>
            <span className="forge-recommendation-rank">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <small>{item.result.colorCombination || "CORES NÃO INFORMADAS"} · {item.meta.label}</small>
              <strong>{item.result.archetype || "Arquétipo não classificado"}</strong>
              <p>{item.result.playerName || "Piloto desconhecido"} · {item.result.placingLabel || "Resultado sem posição"}</p>
              <span>{item.result.eventName} · {formatDate(item.result.eventDate)}</span>
            </div>
            <dl>
              <div><dt>SCORE</dt><dd>{item.competitiveScore}</dd></div>
              <div><dt>EVENTO</dt><dd>{item.result.playerCount || "?"}</dd></div>
              <div><dt>APARIÇÕES</dt><dd>{item.appearances}</dd></div>
              <div><dt>CONFIANÇA</dt><dd>{item.dataConfidence}</dd></div>
            </dl>
            <button type="button" onClick={() => onImport(item)}>ENVIAR PARA A FORJA</button>
          </article>
        ))}
        {!visible.length ? <p>Nenhuma lista completa e elegível corresponde a este recorte.</p> : null}
      </div>
    </section>
  );
}

function splitColors(value) {
  return String(value || "").split(/[/,+|]+/).map((item) => item.trim()).filter(Boolean);
}

function formatDate(value) {
  const date = String(value || "").slice(0, 10);
  if (!date) return "sem data";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
