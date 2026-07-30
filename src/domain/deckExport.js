export function buildExBurstDeckText(report = {}) {
  const entries = Object.keys(report.main || {}).length
    ? Object.entries(report.main || {})
    : (report.rows || []).map((row) => [row?.card?.cardNumber, row?.quantity]);
  return entries
    .filter(([cardNumber, quantity]) => cardNumber && Number(quantity || 0) > 0)
    .sort((left, right) => String(left[0]).localeCompare(String(right[0])))
    .map(([cardNumber, quantity]) => `${Number(quantity)}x${cardNumber}`)
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
