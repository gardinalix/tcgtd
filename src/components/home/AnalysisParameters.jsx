export function AnalysisParameters({ filters, options, onFilterChange, onReset, onRun }) {
  return (
    <aside className="cockpit-console-panel cockpit-console-panel--filters">
      <span className="eyebrow">Analysis parameters</span>
      <div className="console-filter-lines">
        <SelectFilter label="Color" value={filters.color} options={options.colors} onChange={(value) => onFilterChange("color", value)} />
        <SelectFilter label="Type" value={filters.type} options={options.types} onChange={(value) => onFilterChange("type", value)} />
        <SelectFilter label="Rarity" value={filters.rarity} options={options.rarities} onChange={(value) => onFilterChange("rarity", value)} />
        <SelectFilter label="Set" value={filters.set} options={options.sets} onChange={(value) => onFilterChange("set", value)} />
      </div>
      <div className="cockpit-filter-actions">
        <button type="button" onClick={onRun}>Run analysis</button>
        <button type="button" className="button-secondary cockpit-reset-button" onClick={onReset}>
          Reset scan
        </button>
      </div>
    </aside>
  );
}

function SelectFilter({ label, value, options, onChange }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
