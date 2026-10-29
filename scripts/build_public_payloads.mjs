import fs from "node:fs/promises";
import path from "node:path";
import { buildMetaWindows, buildScopedMetaSignal } from "../src/domain/meta.js";

const ROOT = process.cwd();
const APP_DATA_PATH = path.join(ROOT, "web", "app-data.json");
const HOME_DATA_PATH = path.join(ROOT, "web", "home-data.json");
const ASSET_ROOT = path.join(ROOT, "web", "assets");
const RIGHTS_MANIFEST_PATH = path.join(ASSET_ROOT, "rights-manifest.json");

const data = JSON.parse(await fs.readFile(APP_DATA_PATH, "utf8"));
await fs.writeFile(HOME_DATA_PATH, `${JSON.stringify(buildHomePayload(data), null, 2)}\n`, "utf8");
await fs.writeFile(RIGHTS_MANIFEST_PATH, `${JSON.stringify(await buildRightsManifest(data), null, 2)}\n`, "utf8");

function buildHomePayload(source) {
  const metaResults = [...(source.metaResults || [])].sort(byNewestEvent);
  const metaEvents = [...(source.metaEvents || [])].sort(byNewestEvent);
  const activeFormat = inferActiveFormat(metaResults, metaEvents);
  const metaWindows = buildMetaWindows(source);
  const cardMap = new Map((source.cards || []).map((card) => [card.cardNumber, card]));
  const metaSnapshots = Object.fromEntries(metaWindows.map((window) => {
    const scopedResults = metaResults.filter((result) => dateInsideWindow(result.eventDate, window));
    const scopedEvents = metaEvents.filter((event) => dateInsideWindow(event.eventDate, window));
    const signal = buildScopedMetaSignal(source, window);
    return [window.id, {
      activeFormat: window.shortLabel || window.formatCode,
      counts: {
        decklists: signal.context.deckCount,
        events: signal.context.eventCount,
      },
      latestDecks: scopedResults
        .filter((result) => result.deckId && result.hasDecklist !== false)
        .slice(0, 6)
        .map((result) => pick(result, [
          "deckId", "eventId", "eventName", "eventDate", "formatName", "eventType", "playerName", "placingLabel", "placingRank", "archetype", "colorCombination", "sourceName",
        ])),
      latestEvents: scopedEvents.slice(0, 6).map((event) => pick(event, [
        "eventId", "eventName", "eventDate", "formatName", "eventType", "playerCount", "sourceName", "sourceUrl",
      ])),
      metaLeaders: signal.ranked.slice(0, 5).map((row) => ({
        cardNumber: row.cardNumber,
        cardName: row.cardName,
        cardType: row.cardType,
        color: row.color,
        recentMetaScore: row.recentScore,
        recentTop8DecksUsing: row.recent,
        imageUrl: cardMap.get(row.cardNumber)?.imageUrl || "",
      })),
    }];
  }));
  return {
    schemaVersion: "tcgtd-home-v1",
    gameModule: {
      id: "gundam-card-game",
      name: "Gundam Card Game",
      status: "active",
      activeFormat,
    },
    activeFormat,
    metaWindows,
    metaSnapshots,
    generatedAt: source.generatedAt || source.cardSnapshotGeneratedAt || new Date().toISOString(),
    counts: {
      cards: Number(source.counts?.main_deck_cards || source.cards?.length || 0),
      resource_cards: Number(source.counts?.resource_cards || source.resourceCards?.length || 0),
      decklists: Number(source.counts?.decklists || source.metaResults?.length || 0),
      events: Number(source.metaEvents?.length || 0),
      archetypes: Number(source.counts?.archetypes || source.archetypes?.length || 0),
    },
    latestEvents: metaEvents.slice(0, 6).map((event) => pick(event, [
      "eventId", "eventName", "eventDate", "formatName", "eventType", "playerCount", "sourceName", "sourceUrl",
    ])),
    latestDecks: metaResults.filter((result) => result.deckId && result.hasDecklist !== false).slice(0, 6).map((result) => pick(result, [
      "deckId", "eventId", "eventName", "eventDate", "formatName", "eventType", "playerName", "placingLabel", "placingRank", "archetype", "colorCombination", "sourceName",
    ])),
    metaLeaders: [...(source.cards || [])]
      .filter((card) => Number(card.recentMetaScore || 0) > 0)
      .sort((left, right) => Number(right.recentMetaScore || 0) - Number(left.recentMetaScore || 0))
      .slice(0, 5)
      .map((card) => pick(card, ["cardNumber", "cardName", "cardType", "color", "recentMetaScore", "recentTop8DecksUsing", "imageUrl"])),
  };
}

function dateInsideWindow(value, window) {
  const date = String(value || "").slice(0, 10);
  return Boolean(date) && date >= window.startDate && date <= window.endDate;
}

async function buildRightsManifest(source) {
  const files = (await walk(ASSET_ROOT))
    .map((absolutePath) => path.relative(path.join(ROOT, "web"), absolutePath).replaceAll("\\", "/"))
    .filter((assetPath) => assetPath !== "assets/rights-manifest.json")
    .sort();
  const cardOrigins = new Map();
  for (const card of [...(source.cards || []), ...(source.resourceCards || [])]) {
    for (const printing of card.printings || []) {
      const localPath = normalizeAssetPath(printing.imageUrl);
      if (localPath) cardOrigins.set(localPath, printing.remoteImageUrl || printing.detailUrl || card.detailUrl || "");
    }
    const localPath = normalizeAssetPath(card.imageUrl);
    if (localPath && !cardOrigins.has(localPath)) cardOrigins.set(localPath, card.detailUrl || "");
  }
  return {
    schemaVersion: "tcgtd-asset-rights-v1",
    // Keep a no-op build byte-for-byte stable so scheduled data checks do not
    // create commits when neither the source snapshot nor assets changed.
    generatedAt: source.generatedAt || source.cardSnapshotGeneratedAt || null,
    policy: "Every visual asset must retain a source, known owner, review status and permitted-use record before public release.",
    releaseGate: "Entries with reviewStatus=review_required must be cleared, replaced or removed before general public access.",
    assets: files.map((assetPath) => {
      const isCardImage = assetPath.startsWith("assets/card-images/");
      const isProjectBrand = assetPath.startsWith("assets/brand/");
      const generatedUnit = ["assets/backgrounds/wing-zero-dawn-cockpit.webp", "assets/backgrounds/wing-zero-instrument-bench.webp", "assets/gundams/wing-zero-blueprint.webp"].includes(assetPath)
        ? "Wing Zero"
        : ["assets/backgrounds/epyon-libra-cockpit.webp", "assets/backgrounds/epyon-instrument-bench.webp", "assets/gundams/epyon-blueprint.webp"].includes(assetPath) ? "Epyon"
        : ["assets/backgrounds/unicorn-industrial-cockpit.webp", "assets/backgrounds/unicorn-instrument-bench.webp", "assets/gundams/unicorn-blueprint.webp"].includes(assetPath) ? "Unicorn"
        : ["assets/backgrounds/barbatos-arbrau-cockpit.webp", "assets/backgrounds/barbatos-instrument-bench.webp", "assets/gundams/barbatos-blueprint.webp"].includes(assetPath) ? "Barbatos"
        : ["assets/backgrounds/kshatriya-colony-cockpit.webp", "assets/backgrounds/kshatriya-instrument-bench.webp", "assets/gundams/kshatriya-blueprint.webp"].includes(assetPath) ? "Kshatriya"
        : ["assets/backgrounds/gquuuuuux-izuma-cockpit.webp", "assets/backgrounds/gquuuuuux-instrument-bench.webp", "assets/gundams/gquuuuuux-blueprint.webp"].includes(assetPath) ? "GQuuuuuuX"
        : ["assets/backgrounds/aile-archangel-cockpit.webp", "assets/backgrounds/aile-instrument-bench.webp", "assets/gundams/aile-blueprint.webp"].includes(assetPath) ? "Aile Strike" : "";
      const isGeneratedCockpit = ["assets/backgrounds/orbital-cockpit.webp", "assets/backgrounds/instrument-bench.webp"].includes(assetPath) || Boolean(generatedUnit);
      const sourceUrl = isCardImage ? (cardOrigins.get(assetPath) || "") : "";
      if (isProjectBrand || isGeneratedCockpit) {
        return {
          path: `/${assetPath}`,
          kind: isGeneratedCockpit ? "project_interface_asset" : "project_brand_asset",
          game: "platform",
          source: "Created for TCG Tactical Database with OpenAI image generation from the project's approved visual direction",
          sourceUrl: "",
          rightsHolder: "TCG Tactical Database project",
          copyrightOwner: generatedUnit ? "Generated composition for TCGTD; Gundam characters and designs belong to their respective rights holders" : "TCG Tactical Database project",
          licenseStatus: "project_asset",
          license: "Reserved for TCG Tactical Database product and brand use",
          attribution: generatedUnit ? `AI-generated ${generatedUnit} theme artwork for TCGTD. Gundam belongs to its respective rights holders.` : "TCG Tactical Database original brand asset.",
          permittedUse: "TCG Tactical Database product surfaces, metadata and community communications",
          usageNotes: "Do not reuse as a third-party Trading Card Game publisher mark.",
          reviewStatus: "approved",
        };
      }
      return {
        path: `/${assetPath}`,
        kind: classifyAsset(assetPath),
        game: isCardImage || assetPath.startsWith("assets/gundams/") || assetPath.startsWith("assets/factions/") ? "gundam-card-game" : "platform",
        source: sourceUrl ? "Imported from the linked source record" : "Repository asset; original source record not yet attached",
        sourceUrl,
        rightsHolder: isCardImage ? "Respective Trading Card Game rights holder" : "Owner not yet verified",
        copyrightOwner: isCardImage ? "Respective artwork and game-asset copyright owner" : "Owner not yet verified",
        licenseStatus: "unverified",
        license: "No project-owned license recorded",
        attribution: isCardImage ? "Gundam Card Game and related assets belong to their respective owners." : "Attribution pending source verification.",
        permittedUse: "Private staging only pending rights review",
        usageNotes: "Do not enable general public access while reviewStatus remains review_required.",
        reviewStatus: "review_required",
      };
    }),
  };
}

function byNewestEvent(left, right) {
  return String(right?.eventDate || "").localeCompare(String(left?.eventDate || ""));
}

function firstValue(...groups) {
  for (const group of groups) {
    const value = (group || []).find(Boolean);
    if (value) return value;
  }
  return "Current";
}

function inferActiveFormat(results, events) {
  for (const row of [...results.slice(0, 40), ...events.slice(0, 20)]) {
    const signal = `${row?.formatName || ""} ${row?.eventName || ""}`.match(/\bGD\d{2}\b/i)?.[0];
    if (signal) return signal.toUpperCase();
  }
  return "GD05";
}

function pick(value, keys) {
  return Object.fromEntries(keys.filter((key) => value?.[key] !== undefined).map((key) => [key, value[key]]));
}

function normalizeAssetPath(value) {
  const assetPath = String(value || "").replace(/^\.?\//, "");
  return assetPath.startsWith("assets/") ? assetPath : "";
}

function classifyAsset(assetPath) {
  if (assetPath.startsWith("assets/card-images/")) return "third_party_card_image";
  if (assetPath.startsWith("assets/gundams/")) return "third_party_character_art";
  if (assetPath.startsWith("assets/factions/")) return "third_party_mark_or_symbol";
  if (assetPath.startsWith("assets/backgrounds/")) return "background_art";
  if (assetPath.includes("og-tcg-tactical-database")) return "project_social_art";
  return "project_interface_asset";
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const absolutePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolutePath) : [absolutePath];
  }));
  return nested.flat();
}
