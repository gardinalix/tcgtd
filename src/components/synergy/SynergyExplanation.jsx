export function SynergyExplanation({ result }) {
  return (
    <p className="synergy-explanation">
      {result?.explanation || "Awaiting tactical explanation."}
    </p>
  );
}
