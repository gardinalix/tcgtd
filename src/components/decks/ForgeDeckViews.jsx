import { CardArt } from "../cards/CardArt.jsx";

export function ForgeDeckViews({ mode, rows, groupBy, sortBy, onFocus, onAdd, onRemove, previewHandlers }) {
  if (mode === "map") return null;
  const groups = groupRows(rows, groupBy, sortBy);
  return (
    <div className={`forge-deck-view forge-deck-view--${mode}`} aria-label={`Deck em visualização ${mode}`}>
      {!rows.length ? (
        <div className="zero-forge-map__empty">
          <span>NENHUMA CARTA NO MANIFESTO</span>
          <strong>ADICIONE UMA CARTA PELO ARSENAL</strong>
          <p>A grade tática será atualizada imediatamente.</p>
        </div>
      ) : null}
      {groups.map((group) => (
        <section key={group.id} className="forge-deck-group">
          <header><strong>{group.label}</strong><span>{group.rows.reduce((sum, row) => sum + row.quantity, 0)} cartas</span></header>
          <div>
            {group.rows.map((row) => (
              <article
                key={row.card.cardNumber}
                className="forge-deck-card"
                tabIndex={0}
                onClick={() => onFocus(row.card.cardNumber)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onFocus(row.card.cardNumber);
                }}
                {...previewHandlers(row.card)}
              >
                <CardArt card={row.card} className="forge-deck-card__art" compact />
                <span>
                  <small>{row.card.cardNumber} · C{row.card.cost ?? "-"}</small>
                  <strong>{row.card.cardName}</strong>
                  <em>{row.card.cardType} · {row.card.color}</em>
                </span>
                <div>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(row.card.cardNumber); }} aria-label={`Remover ${row.card.cardName}`}>−</button>
                  <b>{row.quantity}x</b>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onAdd(row.card.cardNumber); }} aria-label={`Adicionar ${row.card.cardName}`}>+</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function groupRows(rows, groupBy, sortBy) {
  const grouped = new Map();
  for (const row of rows) {
    const key = groupKey(row, groupBy);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return [...grouped.entries()]
    .map(([label, groupRowsValue]) => ({
      id: label,
      label,
      rows: [...groupRowsValue].sort((left, right) => sortRows(left, right, sortBy)),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
}

function groupKey(row, groupBy) {
  if (groupBy === "type") return row.card.cardType || "OUTROS";
  if (groupBy === "color") return row.card.color || "SEM COR";
  if (groupBy === "role") return row.card.synergyTags?.[0]?.toUpperCase() || "SEM FUNÇÃO";
  const cost = Number(row.card.cost || 0);
  return cost >= 5 ? "CUSTO 5+" : `CUSTO ${cost}`;
}

function sortRows(left, right, sortBy) {
  if (sortBy === "name") return String(left.card.cardName).localeCompare(String(right.card.cardName));
  if (sortBy === "quantity") return right.quantity - left.quantity || String(left.card.cardName).localeCompare(String(right.card.cardName));
  if (sortBy === "set") return String(left.card.cardNumber).localeCompare(String(right.card.cardNumber));
  return Number(left.card.cost || 0) - Number(right.card.cost || 0)
    || String(left.card.cardName).localeCompare(String(right.card.cardName));
}
