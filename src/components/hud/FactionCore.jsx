export function FactionCore({ theme }) {
  return (
    <div className="zero-core zero-system-core" data-faction-core data-faction={theme.factionId || theme.id} aria-hidden="true">
      <span className="zero-core__ring zero-core__ring--outer" />
      <span className="zero-core__ring zero-core__ring--middle" />
      <span className="zero-core__ring zero-core__ring--inner" />
      <span className="zero-core__emblem">
        <img className="zero-core__logo" src={theme.factionLogo} alt="" />
      </span>
    </div>
  );
}
