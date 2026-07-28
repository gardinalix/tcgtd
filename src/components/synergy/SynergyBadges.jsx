import { rankLabel, rankTone } from "../../services/synergyRulesEngine";

export function SynergyRankBadge({ rank, score }) {
  return (
    <span className={`synergy-rank-badge synergy-rank-badge--${rankTone(rank)}`}>
      {rankLabel(rank)} <strong>{score}</strong>
    </span>
  );
}

export function SynergyTypeBadge({ children }) {
  return <span className="synergy-type-badge">{children}</span>;
}
