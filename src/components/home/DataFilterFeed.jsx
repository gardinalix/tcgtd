import { summarizePackages } from "../../utils/cardFilters";

const COLORS = ["#28e7ff", "#55bdf6", "#42f0be", "#ffd21c", "#f05e88", "#8a6dff"];

export function DataFilterFeed({ cards, onPackageSelect }) {
  const rows = summarizePackages(cards);
  const total = cards.length || 1;
  const gradient = buildGradient(rows, total);

  return (
    <div className="cockpit-detection-panel">
      <span className="eyebrow">Data filter feed</span>
      <div className="package-breakdown">
        <div className="package-breakdown__donut" style={{ "--package-donut": gradient }}>
          <strong>{cards.length}</strong>
          <span>units</span>
        </div>
        <div className="package-breakdown__body">
          <p className="package-breakdown__eyebrow">Data Filter Feed</p>
          <strong>{cards.length} units found</strong>
          <div className="package-breakdown__legend">
            {rows.map((row, index) => (
              <button
                key={row.label}
                type="button"
                className="package-breakdown__row"
                style={{ "--row-color": COLORS[index % COLORS.length] }}
                onClick={() => onPackageSelect(row.label)}
                title={`Open ${row.label} in Tactical DB`}
              >
                <i aria-hidden="true" />
                <b>{row.label}</b>
                <em>{row.count}</em>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildGradient(rows, total) {
  if (!rows.length) {
    return "#28e7ff 0 100%";
  }

  let cursor = 0;
  return rows
    .map((row, index) => {
      const start = cursor;
      cursor += (row.count / total) * 100;
      return `${COLORS[index % COLORS.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    })
    .join(", ");
}
