export function buildExBurstDeckText(report = {}) {
  return [...(report.rows || [])]
    .filter((row) => row?.card?.cardNumber && Number(row.quantity || 0) > 0)
    .sort((left, right) =>
      String(left.card.cardNumber).localeCompare(String(right.card.cardNumber)))
    .map((row) => `${Number(row.quantity)}x${row.card.cardNumber}`)
    .join("\n");
}

export function downloadDeckText(content, title = "deck") {
  const safeTitle = String(title || "deck")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "deck";
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeTitle}-exburst.txt`;
  link.click();
  URL.revokeObjectURL(url);
}
