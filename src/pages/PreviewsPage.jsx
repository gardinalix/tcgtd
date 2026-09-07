import { useEffect, useMemo, useState } from "react";
import {
  TacticalDataPanel,
  TacticalPageHeader,
  TacticalPageShell,
  TacticalStatusBadge,
  TacticalSummaryCard,
  TacticalSummaryStrip,
  TacticalTable,
} from "../components/tactical/TacticalPageShell";
import officialPreviewRegistry from "../../data/official_preview_registry.json";

const FUTURE_CODE_RE = /^(GD|EB|ST|SC|PC|EVX)\d+/i;
const GD04_RELEASE_TIME = parseReleaseDate("April 24, 2026");
const INITIAL_RELEASE_BATCH = 6;

export function PreviewsPage({ data }) {
  const products = data.products || [];
  const packages = data.packages || [];
  const previews = (data.previews || []).filter(isPostGd04Signal);
  const cards = [...(data.cards || []), ...(data.resourceCards || [])];
  const [selectedCode, setSelectedCode] = useState("future");
  const [statusFilter, setStatusFilter] = useState("all");
  const [releaseLimit, setReleaseLimit] = useState(INITIAL_RELEASE_BATCH);

  const releaseRows = useMemo(
    () => buildReleaseRows({ products, packages, previews, cards }),
    [products, packages, previews, cards],
  );

  const futureRows = releaseRows.filter((row) => row.releaseState === "future" || row.previewOnlyCount > 0 || row.releasedCardCount === 0);
  const previewOnlyRows = previews.filter((row) => !row.matchedReleasedCard);
  const confirmedRows = previews.filter((row) => row.matchedReleasedCard);
  const reportedRows = previews.filter(isReportedSignal);
  const officialRows = previews.filter((row) => !isReportedSignal(row));

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
    if (statusFilter === "reported" && !isReportedSignal(preview)) return false;
    if (statusFilter === "official" && isReportedSignal(preview)) return false;
    return true;
  });
  const visibleReleaseRows = visibleReleases.slice(0, releaseLimit);
  const visibleChannelCodes = new Set(visibleReleases.map((row) => row.code));
  const officialChannels = (officialPreviewRegistry.channels || []).filter((channel) => {
    const channelCodes = (channel.products || []).map(normalizeCode);
    if (selectedCode === "all") return true;
    if (selectedCode === "future") return channelCodes.some((code) => visibleChannelCodes.has(code));
    return channelCodes.includes(selectedCode);
  });

  useEffect(() => setReleaseLimit(INITIAL_RELEASE_BATCH), [selectedCode, statusFilter]);

  return (
    <TacticalPageShell className="preview-terminal-page release-intel-page">
      <TacticalPageHeader
        eyebrow="Preview Radar"
        title="Release Intel / Official Previews"
        subtitle="Future products, first-party reveals and separately labeled reported sightings are grouped by collection. Only official catalog rows enter deckbuilding and legality."
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
              <option value="official">Official sources</option>
              <option value="reported">Reported / review</option>
            </select>
          </div>
        )}
      />

      <TacticalSummaryStrip>
        <TacticalSummaryCard label="Future products" value={futureRows.length} detail="Unreleased or waiting for card rows." tone="blue" />
        <TacticalSummaryCard label="Official signals" value={officialRows.length} detail={`${previewOnlyRows.filter((row) => !isReportedSignal(row)).length} still awaiting a catalog row.`} tone="gold" />
        <TacticalSummaryCard label="Reported sightings" value={reportedRows.length} detail="Tracked for review; never added to deckbuilding." tone="blue" />
        <TacticalSummaryCard label="Catalog matches" value={confirmedRows.length} detail="Preview now linked to released cards." tone="green" />
      </TacticalSummaryStrip>

      <TacticalDataPanel
        title="Reveal source monitor"
        subtitle="Product pages, the official English social channel and the card catalog are tracked separately. Community sightings stay in review and cannot become playable cards by themselves."
        className="official-reveal-monitor-panel"
        code="GD06/LINK"
        mode="signal"
      >
        <div className="official-reveal-monitor">
          {officialChannels.map((channel) => (
            <a key={channel.id} href={channel.url} target="_blank" rel="noreferrer">
              <span><i />{channel.sourceType.replaceAll("_", " ")}</span>
              <strong>{channel.label}</strong>
              <small>{formatChannelStatus(channel.status)}</small>
              <em>{(channel.products || []).join(" / ")} ↗</em>
            </a>
          ))}
        </div>
      </TacticalDataPanel>

      <section className="release-intel-grid">
        <TacticalDataPanel
          title="Future collection board"
          subtitle="Rows are dated from the official product calendar. A reported sighting can raise a collection in the queue, but never invents a playable card row."
          className="release-board-panel"
        >
          <div className="release-card-grid">
            {visibleReleaseRows.map((release) => (
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
          {releaseLimit < visibleReleases.length ? (
            <div className="card-result-expander release-result-expander">
              <span><b>{visibleReleaseRows.length}</b> / {visibleReleases.length} RELEASES IN RANGE</span>
              <button type="button" onClick={() => setReleaseLimit((current) => Math.min(current + INITIAL_RELEASE_BATCH, visibleReleases.length))}>LOAD NEXT RELEASES</button>
            </div>
          ) : null}
        </TacticalDataPanel>

        <TacticalDataPanel
          title="Reveal evidence queue"
          subtitle="First-party signals and reported sightings are separated by status. Preview-only means it has not matched a released card number yet."
          className="preview-queue-panel"
        >
          <TacticalTable
            columns={["Status", "Card / hint", "Set", "Source", "Date", "Image"]}
            rows={visiblePreviews}
            emptyTitle="No preview signals in this filter"
            emptyDetail="Try All products or Future / preview queue."
            renderRow={(preview) => (
              <tr key={preview.previewId}>
                <td data-label="Status">
                  <TacticalStatusBadge tone={previewStatusTone(preview)}>
                    {previewStatusLabel(preview)}
                  </TacticalStatusBadge>
                </td>
                <td data-label="Card / hint">
                  <strong>{preview.cardNumberHint || preview.cardNameHint || "Unidentified card"}</strong>
                  <small>{preview.sectionHeading || preview.productName}</small>
                </td>
                <td data-label="Set">{preview.productCode || "-"}</td>
                <td data-label="Source">{preview.sourceUrl ? <a href={preview.sourceUrl} target="_blank" rel="noreferrer">{preview.sourceType || "Official source"}</a> : preview.sourceType}</td>
                <td data-label="Date">{preview.sourceDate || preview.productReleaseDate || "-"}</td>
                <td data-label="Image">{preview.imageUrl ? <a href={preview.imageUrl} target="_blank" rel="noreferrer">Open image</a> : "-"}</td>
              </tr>
            )}
          />
        </TacticalDataPanel>
      </section>
    </TacticalPageShell>
  );
}

function formatChannelStatus(value) {
  if (value === "active") return "ACTIVE SOURCE";
  if (value === "manual_review") return "REVIEWING OFFICIAL POSTS";
  if (value === "awaiting_package") return "AWAITING GD06 CARD ROWS";
  return String(value || "TRACKED").replaceAll("_", " ").toUpperCase();
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
        releaseState: isFutureRelease(product.releaseDate) ? "future" : "released",
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

function isReportedSignal(preview) {
  return ["reported", "derived", "unverified"].includes(String(preview?.confidence || "").trim().toLowerCase())
    || String(preview?.classification || "").trim().toLowerCase() === "reported_card_reveal";
}

function previewStatusLabel(preview) {
  if (preview.matchedReleasedCard) return "Catalog match";
  if (isReportedSignal(preview)) return "Reported / review";
  return "Official preview";
}

function previewStatusTone(preview) {
  if (preview.matchedReleasedCard) return "green";
  return isReportedSignal(preview) ? "blue" : "gold";
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
