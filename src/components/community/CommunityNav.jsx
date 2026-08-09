const ITEMS = [
  ["community", "Overview"],
  ["events", "Events & results"],
  ["players", "Players"],
  ["venues", "Stores & weekly finder"],
];

export function CommunityNav({ active, onNavigate }) {
  return (
    <nav className="community-nav" aria-label="Community sections">
      {ITEMS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={active === id ? "is-active" : ""}
          onClick={() => onNavigate(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
