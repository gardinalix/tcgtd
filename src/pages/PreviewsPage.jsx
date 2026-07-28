import { useMemo, useState } from "react";
import {
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalStatusBadge,
  TacticalSummaryCard,
  TacticalSummaryStrip,
  TacticalTable,
} from "../components/tactical/TacticalPageShell";

const FUTURE_CODE_RE = /^(GD|EB|ST|SC|PC|EVX)\d+/i;
const GD04_RELEASE_TIME = parseReleaseDate("April 24, 2026");

export function PreviewsPage({ data }) {
  const products = data.products || [];
  const packages = data.packages || [];
  const previews = (data.previews || []).filter(isPostGd04Signal);
  const cards = [...(data.cards || []), ...(data.resourceCards || [])];
  const [selectedCode, setSelectedCode] = useState("future");
  const [statusFilter, setStatusFilter] = useState("all");

  const releaseRows = useMemo(
    () => buildReleaseRows({ products, packages, previews, cards }),
    [products, packages, previews, cards],
  );

  const futureRows = releaseRows.filter((row) => row.releaseState === "future" || row.previewOnlyCount > 0 || row.releasedCardCount === 0);
  const previewOnlyRows = previews.filter((row) => !row.matchedReleasedCard);
  const confirmedRows = previews.filter((row) => row.matchedReleasedCard);

  const visibleReleases = releaseRows.filter((row) => {
    if (selectedCode === "future" && row.releaseState !== "future" && row.previewOnlyCount === 0 && row.releasedCardCount > 0) return false;
    if (selectedCode !== "all" && selectedCode !== "future" && row.code !== selectedCode) return false;
    return true;
  });

  const visiblePreviews = previews.filter((preview) => {
    const code = normalizeCode(preview.productCode);
    if (selectedCode === "future" && !futureRows.some((row) => row.code === code)) return false;
    if (selectedCode !== "all" && selectedCode !== "future" && code !== selectedCode) return false;
    if (statusFilter === "preview-only" && preview.matchedReleasedCard) return false;
    if (statusFilter === "released" && !preview.matchedReleasedCard) return false;
    return true;
  });

  return (
    <TacticalPageShell className="preview-terminal-page release-intel-page">
      <TacticalPageHeader
        eyebrow="Preview Radar"
        title="Release Intel / Official Previews"
        subtitle="Future products, official reveal signals and preview-only cards are grouped by collection so GD05, EB01, ST10 and later releases are visible in one place."
        actions={(
          <div className="preview-terminal-actions">
            <select value={selectedCode} onChange={(event) => setSelectedCode(event.target.value)}>
              <option value="future">Future / preview queue</option>
              <option value="all">All future releases</option>
              {releaseRows.map((row) => (
                <option key={row.code} value={row.code}>{row.code} / {row.shortName}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All signals</option>
              <option value="preview-only">Preview only</option>
              <option value="released">Matched released</option>
            </select>
          </div>
        )}
      />

      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Future products" value={futureRows.length} detail="Unreleased or waiting for card rows." tone="blue" />
        <TacticalSummaryCard label="Preview-only cards" value={previewOnlyRows.length} detail="No released card match yet." tone="gold" />
        <TacticalSummaryCard label="Matched reveals" value={confirmedRows.length} detail="Preview now linked to released cards." tone="green" />
        <TacticalSummaryCard label="Future releases indexed" value={releaseRows.length} detail="Only sets/products after GD04." tone="neutral" />
      </TacticalSummaryStrip>

      <section className="release-intel-grid">
        <TacticalDataPanel
          title="Future collection board"
          subtitle="Only official future rows after GD04 are shown. Counts are from existing database/previews; missing cards are not invented."
          className="release-board-panel"
        >
          <div className="release-card-grid">
            {visibleReleases.map((release) => (
              <article key={release.code} className={`release-intel-card release-intel-card--${release.releaseState}`}>
                <button type="button" className="release-intel-card__image" onClick={() => setSelectedCode(release.code)}>
                  {release.imageUrl ? <img src={release.imageUrl} alt="" loading="lazy" /> : <span>{release.code}</span>}
                </button>
                <div className="release-intel-card__body">
                  <div className="release-intel-card__topline">
                    <strong>{release.code || "TBD"}</strong>
                    <TacticalStatusBadge tone={release.releaseState === "future" ? "gold" : release.previewOnlyCount ? "blue" : "green"}>
                      {release.releaseState === "future" ? "Future" : release.previewOnlyCount ? "Preview watch" : "Released"}
                    </TacticalStatusBadge>
                  </div>
                  <h2>{release.productName}</h2>
                  <p>{release.productKind || release.category || "Product"} / {release.releaseDate || "Release date TBD"}</p>
                  <dl>
                    <div><dt>Released rows</dt><dd>{release.releasedCardCount}</dd></div>
                    <div><dt>Official signals</dt><dd>{release.previewCount}</dd></div>
                    <div><dt>Preview only</dt><dd>{release.previewOnlyCount}</dd></div>
                  </dl>
                  <div className="release-intel-card__actions">
                    {release.productUrl ? <a href={release.productUrl} target="_blank" rel="noreferrer">Official product</a> : null}
                    <button type="button" onClick={() => setSelectedCode(release.code)}>Focus</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </TacticalDataPanel>

        <TacticalDataPanel
          title="Official signal queue"
          subtitle="Only card preview signals from collections after GD04. Preview-only means it has not matched a released card number yet."
          className="preview-queue-panel"
        >
          <TacticalTable
            columns={["Status", "Card / hint", "Set", "Source", "Date", "Image"]}
            rows={visiblePreviews}
            emptyTitle="No preview signals in this filter"
            emptyDetail="Try All products or Future / preview queue."
            renderRow={(preview) => (
              <tr key={preview.previewId}>
                <td>
                  <TacticalStatusBadge tone={preview.matchedReleasedCard ? "green" : "gold"}>
                    {preview.matchedReleasedCard ? "Released match" : "Preview only"}
                  </TacticalStatusBadge>
                </td>
                <td>
                  <strong>{preview.cardNumberHint || preview.cardNameHint || "Unidentified card"}</strong>
                  <small>{preview.sectionHeading || preview.productName}</small>
                </td>
                <td>{preview.productCode || "-"}</td>
                <td>{preview.sourceUrl ? <a href={preview.sourceUrl} target="_blank" rel="noreferrer">{preview.sourceType || "Official source"}</a> : preview.sourceType}</td>
                <td>{preview.sourceDate || preview.productReleaseDate || "-"}</td>
                <td>{preview.imageUrl ? <a href={preview.imageUrl} target="_blank" rel="noreferrer">Open image</a> : "-"}</td>
              </tr>
            )}
          />
        </TacticalDataPanel>
      </section>
    </TacticalPageShell>
  );
}

function buildReleaseRows({ products, packages, previews, cards }) {
  const packageMap = new Map(packages.map((row) => [normalizeCode(row.packageCode || row.packageLabel), row]));
  const cardsByPackage = new Map();
  for (const card of cards) {
    for (const code of card.packageCodes || []) {
      const normalized = normalizeCode(code);
      if (!normalized) continue;
      cardsByPackage.set(normalized, (cardsByPackage.get(normalized) || 0) + 1);
    }
  }

  const previewsByProduct = new Map();
  for (const preview of previews) {
    const code = normalizeCode(preview.productCode);
    if (!code) continue;
    const bucket = previewsByProduct.get(code) || [];
    bucket.push(preview);
    previewsByProduct.set(code, bucket);
  }

  const rows = products
    .filter((product) => normalizeCode(product.productCode) && FUTURE_CODE_RE.test(product.productCode))
    .filter(isPostGd04Signal)
    .map((product) => {
      const code = normalizeCode(product.productCode);
      const packageRow = packageMap.get(code);
      const productPreviews = previewsByProduct.get(code) || [];
      const releasedCardCount = cardsByPackage.get(code) || packageRow?.detailCount || 0;
      return {
        code,
        shortName: stripCode(product.productName || code),
        productName: product.productName || packageRow?.packageLabel || code,
        productKind: product.productKind || packageRow?.packageKind || "",
        category: product.category || "",
        releaseDate: product.releaseDate || "",
        msrp: product.msrp || "",
        productUrl: product.productUrl || packageRow?.packageUrl || "",
        imageUrl: product.imageUrl || "",
        releasedCardCount,
        previewCount: productPreviews.length,
        previewOnlyCount: productPreviews.filter((preview) => !preview.matchedReleasedCard).length,
        releaseState: isPostGd04Signal(product) ? "future" : "released",
      };
    });

  return rows.sort((left, right) => {
    const leftFuture = left.releaseState === "future" ? 0 : 1;
    const rightFuture = right.releaseState === "future" ? 0 : 1;
    if (leftFuture !== rightFuture) return leftFuture - rightFuture;
    return parseReleaseDate(left.releaseDate) - parseReleaseDate(right.releaseDate) || left.code.localeCompare(right.code);
  });
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function stripCode(name) {
  return String(name || "").replace(/\s*\[[^\]]+\]\s*$/, "").trim();
}

function isFutureRelease(value) {
  const time = parseReleaseDate(value);
  if (!Number.isFinite(time)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return time > today.getTime();
}

function isPostGd04Signal(item) {
  const code = normalizeCode(item.productCode || item.packageCode || item.cardNumberHint);
  const releaseTime = parseReleaseDate(item.releaseDate || item.productReleaseDate);
  if (Number.isFinite(releaseTime) && releaseTime > GD04_RELEASE_TIME) return true;

  const codeMatch = code.match(/^([A-Z]+)(\d+)/);
  if (!codeMatch) return false;
  const family = codeMatch[1];
  const number = Number(codeMatch[2]);
  if (family === "GD") return number > 4;
  if (family === "ST") return number >= 10;
  if (family === "EB") return true;
  if (family === "SC") return true;
  if (family === "PC" || family === "EVX") return true;
  return false;
}

function parseReleaseDate(value) {
  const text = String(value || "").replace(/,/g, ", ").replace(/\s+/g, " ").trim();
  const match = text.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (!match) return Number.POSITIVE_INFINITY;
  const parsed = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
}
