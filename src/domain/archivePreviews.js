// Archive-only projections: previews never enter the canonical card/deck pool.
export function mergePreviewSignals(data, registry = {}) {
  const sources = new Map((registry.sources || []).map((source) => [source.id, source]));
  const signals = new Map((data.previews || []).map((preview) => [preview.previewId, preview]));
  for (const reveal of registry.reveals || []) {
    const source = sources.get(reveal.source_id);
    if (!source || !reveal.product_code || !safeSource(reveal.source_url, source.url)) continue;
    const previewId = `reported:${source.id}:${reveal.product_code}:${reveal.card_number_hint || reveal.card_name_hint}`;
    // Replace a collector's hashed copy with the stable registry identity.
    for (const [id, signal] of signals) {
      if (id !== previewId && signal.classification === "reported_card_reveal" && signal.productCode === reveal.product_code
          && signal.sourceUrl === reveal.source_url && signal.cardNumberHint === (reveal.card_number_hint || "")) signals.delete(id);
    }
    const matchedReleasedCard = [...(data.cards || []), ...(data.resourceCards || [])].some((card) => card.cardNumber === reveal.card_number_hint);
    signals.set(previewId, {
      previewId, classification: "reported_card_reveal", confidence: "reported", previewStatus: matchedReleasedCard ? "released_match_found" : "preview_only",
      sourceType: source.source_type, sourceTitle: reveal.source_title || source.label,
      sourceUrl: reveal.source_url, sourceDate: reveal.source_date || "",
      cardNumberHint: reveal.card_number_hint || "", cardNameHint: reveal.card_name_hint || "",
      productCode: reveal.product_code, productName: reveal.product_name || reveal.product_code,
      productReleaseDate: reveal.product_release_date || "", productUrl: reveal.product_url || "",
      imageUrl: reveal.image_url || "", contextText: reveal.context_text || "",
      cardDetails: reveal.card_details || {}, matchedReleasedCard,
    });
  }
  return [...signals.values()];
}

export function buildArchivePreviewCards(data) {
  const catalog = [...(data.cards || []), ...(data.resourceCards || [])];
  const numbers = new Set(catalog.map((card) => card.cardNumber));
  const namesByPackage = new Set(catalog.flatMap((card) => (card.packageCodes || []).map((code) => `${code}:${String(card.cardName).toLowerCase()}`)));
  const seen = new Set();
  return (data.previews || []).flatMap((preview) => {
    const code = preview.productCode;
    const number = preview.cardNumberHint || "";
    if (preview.matchedReleasedCard || numbers.has(number) || (!number && namesByPackage.has(`${code}:${String(preview.cardNameHint).toLowerCase()}`)) || !preview.imageUrl
        || !(number || preview.cardNameHint) || !safeSource(preview.sourceUrl)) return [];
    const key = `${code}:${number || preview.cardNameHint}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const details = preview.cardDetails || {};
    return [{
      ...details,
      archivePreview: true, previewConfidence: preview.confidence,
      cardNumber: number || `${code} / ${preview.cardNameHint}`,
      cardName: preview.cardNameHint || number,
      displayId: `preview:${preview.previewId}`, imageUrl: preview.imageUrl,
      packageCodes: [code].filter(Boolean), packageLabels: [preview.productName].filter(Boolean),
      whereToGetIt: preview.productName || code,
      previewSourceUrl: preview.sourceUrl, previewSourceTitle: preview.sourceTitle,
      previewSourceDate: preview.sourceDate, previewReleaseDate: preview.productReleaseDate,
      previewContext: preview.contextText,
      effectPreview: "See the linked reveal for provisional card text.",
      searchText: [number, preview.cardNameHint, code, preview.productName, details.cardType, details.color].filter(Boolean).join(" "),
      priceStatus: "preview_only", traits: details.traits || [], hasAltArt: false,
    }];
  });
}

function safeSource(value, registered) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (!registered || url.hostname.replace(/^www\./, "") === new URL(registered).hostname.replace(/^www\./, ""));
  } catch { return false; }
}
