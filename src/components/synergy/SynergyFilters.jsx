export const DEFAULT_SYNERGY_FILTERS = {
  rank: "Any",
  type: "Any",
  color: "Any",
  cardType: "Any",
  set: "Any",
  trait: "Any",
  competitiveOnly: false,
  lowCostOnly: false,
  pricedOnly: false,
  sameDeckOnly: false,
};

export function SynergyFilters({ filters, options, onChange, onReset }) {
  return (
    <aside className="panel synergy-filter-panel">
      <div className="panel-head">
        <h2>Synergy filters</h2>
        <p>Refine tactical relationships without changing card data.</p>
      </div>
      <div className="filter-grid">
        <Select label="Rank" value={filters.rank} options={["Any", "High", "Good", "Low"]} onChange={(value) => onChange("rank", value)} />
        <Select label="Type" value={filters.type} options={options.types} onChange={(value) => onChange("type", value)} />
        <Select label="Color" value={filters.color} options={options.colors} onChange={(value) => onChange("color", value)} />
        <Select label="Card type" value={filters.cardType} options={options.cardTypes} onChange={(value) => onChange("cardType", value)} />
        <Select label="Set" value={filters.set} options={options.sets} onChange={(value) => onChange("set", value)} />
        <Select label="Trait" value={filters.trait} options={options.traits} onChange={(value) => onChange("trait", value)} />
        <Checkbox label="Competitive only" checked={filters.competitiveOnly} onChange={(value) => onChange("competitiveOnly", value)} />
        <Checkbox label="Low cost only" checked={filters.lowCostOnly} onChange={(value) => onChange("lowCostOnly", value)} />
        <Checkbox label="With price loaded" checked={filters.pricedOnly} onChange={(value) => onChange("pricedOnly", value)} />
        <Checkbox label="Same deck signal" checked={filters.sameDeckOnly} onChange={(value) => onChange("sameDeckOnly", value)} />
      </div>
      <button type="button" onClick={onReset}>Reset synergy scan</button>
    </aside>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="checkbox-row synergy-checkbox-row">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
