#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { csvLegacyAdapter } from "./data-engine/adapters/csvLegacyAdapter.mjs";
import { egmanAdapter } from "./data-engine/adapters/egmanAdapter.mjs";
import { manualAdapter } from "./data-engine/adapters/manualAdapter.mjs";
import { readReviewedContributions } from "./data-engine/adapters/communityAdapter.mjs";
import {
  COMPETITIVE_ROOT, PATHS, ROOT, buildCanonicalFromLegacy, buildGeneratedData, contentHash,
  readJson, readText, toCsv, unwrap, validateCompetitiveData, writeJsonIfChanged,
} from "./data-engine/lib.mjs";

const command = process.argv[2] || "help";
const options = parseOptions(process.argv.slice(3));

try {
  if (command === "migrate") await migrate();
  else if (command === "build") await build();
  else if (command === "validate") await validate();
  else if (command === "export") await exportData();
  else if (command === "update") await update();
  else printHelp();
} catch (error) {
  console.error(`Data Engine failed: ${error.message}`);
  process.exitCode = 1;
}

function parseOptions(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (!item.startsWith("--")) continue;
    const [key, inlineValue] = item.slice(2).split("=", 2);
    parsed[key] = inlineValue ?? (args[index + 1]?.startsWith("--") ? true : args[++index] || true);
  }
  return parsed;
}

function printHelp() {
  console.log(`Competitive Data Engine

Usage:
  npm run data:migrate                 Import legacy competitive CSV files once or after a manual import.
  npm run data:update                  Check public sources, preserve failures, normalize and refresh the web payload.
  npm run data:update -- --tournament <id>
  npm run data:validate                Validate normalized records without writing changes.
  npm run data:build                   Rebuild versioned derived JSON files.
  npm run data:export                  Export normalized records as CSV and JSON.
`);
}

async function ensureDirectories() {
  await Promise.all(Object.values(PATHS).map((directory) => fs.mkdir(directory, { recursive: true })));
}

async function loadNormalized() {
  const names = ["tournaments", "results", "decks", "deck_cards", "players", "archetypes", "cards", "conflicts"];
  const entries = await Promise.all(names.map(async (name) => [name, unwrap(await readJson(path.join(PATHS.normalized, `${name}.json`), { items: [] }))]));
  return Object.fromEntries(entries);
}

async function writeNormalized(data) {
  const schema = "tcgtd-competitive-normalized-v1";
  const changed = [];
  for (const [name, rows] of Object.entries(data)) {
    if (!Array.isArray(rows)) continue;
    if (await writeJsonIfChanged(path.join(PATHS.normalized, `${name}.json`), { schema_version: schema, items: rows })) changed.push(name);
  }
  return changed;
}

async function writeRawSnapshot({ legacy, registry, sourceRegistry }) {
  const raw = {
    schema_version: "tcgtd-competitive-raw-v1",
    adapter_id: "csv-legacy",
    inputs: {
      events: legacy.payload.events.metadata,
      results: legacy.payload.results.metadata,
      deck_cards: legacy.payload.deckCards.metadata,
      tournament_registry: registry.metadata,
    },
    source_registry: sourceRegistry,
    events: legacy.parsed.events,
    results: legacy.parsed.results,
    deck_cards: legacy.parsed.deckCards,
  };
  const rawDirectory = path.join(PATHS.raw, "legacy-csv", "current");
  const rawChanged = await writeBufferIfChanged(path.join(rawDirectory, "source.json.gz"), gzipSync(Buffer.from(JSON.stringify(raw))));
  await writeJsonIfChanged(path.join(rawDirectory, "manifest.json"), {
    schema_version: raw.schema_version,
    adapter_id: raw.adapter_id,
    inputs: raw.inputs,
    source_registry: raw.source_registry,
    compressed_payload: "source.json.gz",
    content_hash: contentHash(raw),
  });
  // Replaced by the compressed representation in v1; this exact engine-owned
  // path is safe to clean and prevents a stale duplicate raw archive.
  await fs.rm(path.join(rawDirectory, "source.json"), { force: true });
  return rawChanged;
}

async function writeBufferIfChanged(filePath, content) {
  try {
    const previous = await fs.readFile(filePath);
    if (Buffer.compare(previous, content) === 0) return false;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
  return true;
}

async function migrate(runContext = {}) {
  await ensureDirectories();
  const [legacyPayload, manualPayload, sourceRegistry, aliasConfig, previous] = await Promise.all([
    csvLegacyAdapter.fetch(),
    manualAdapter.fetch(),
    readJson(path.join(PATHS.sources, "sources.json"), []),
    readJson(path.join(PATHS.sources, "archetype-aliases.json"), []),
    loadNormalized(),
  ]);
  const legacy = { payload: legacyPayload, parsed: csvLegacyAdapter.parse(legacyPayload) };
  const registry = { metadata: manualPayload.metadata, rows: manualAdapter.parse(manualPayload) };
  const community = await readReviewedContributions(path.join(PATHS.sources, "community-events"));
  const sourceRegistryRows = Array.isArray(sourceRegistry) ? sourceRegistry : sourceRegistry.items || [];
  const aliasRows = Array.isArray(aliasConfig) ? aliasConfig : aliasConfig.items || [];
  const rawChanged = await writeRawSnapshot({ legacy, registry, sourceRegistry: sourceRegistryRows });
  const data = buildCanonicalFromLegacy({
    events: [...legacy.parsed.events, ...community.events],
    results: [...legacy.parsed.results, ...community.results],
    deckCards: legacy.parsed.deckCards,
    registry: registry.rows,
    aliases: aliasRows,
    sourceRegistry: sourceRegistryRows,
    metadata: {
      events: legacy.payload.events.metadata,
      results: legacy.payload.results.metadata,
      deckCards: legacy.payload.deckCards.metadata,
      registry: registry.metadata,
    },
  });
  const validation = validateCompetitiveData(data, previous);
  await writeJsonIfChanged(path.join(PATHS.generated, "validation-report.json"), {
    schema_version: "tcgtd-validation-v1",
    valid: validation.valid,
    input_hash: contentHash(data),
    issues: validation.issues,
  });
  if (!validation.valid) {
    throw new Error(`Validation rejected the import (${validation.issues.filter((issue) => issue.level === "error").length} error(s)). Existing normalized data was preserved.`);
  }
  const changed = await writeNormalized(data);
  const generated = await writeGenerated(data, sourceRegistryRows, rawChanged || changed.length ? {
    mode: runContext.mode || "migrate",
    checked_at: runContext.checked_at || null,
    rawChanged,
    changed,
    errors: runContext.errors || [],
  } : {});
  printSummary({ title: "Tournament Data Migration", data, changed, errors: [], generated });
  return { data, changed, generated };
}

async function writeGenerated(data, sourceRegistry, run = {}) {
  const generated = buildGeneratedData(data);
  const previousMeta = await readJson(path.join(PATHS.generated, "meta.json"), {});
  const registryRows = Array.isArray(sourceRegistry) ? sourceRegistry : [];
  const previousSources = new Map((previousMeta?.sources || []).map((source) => [source.id, source]));
  const sourceStatus = registryRows.map((source) => ({
    id: source.id, name: source.name, status: source.status || "active", adapter: source.adapter,
    confidence: source.confidence, url: source.url || null, last_checked: run.checked_at || previousSources.get(source.id)?.last_checked || null,
  }));
  const meta = {
    ...generated.meta,
    sources: sourceStatus,
    last_run: run.mode ? {
      mode: run.mode || "local_build",
      checked_at: run.checked_at || null,
      raw_changed: Boolean(run.rawChanged),
      changed_datasets: run.changed || [],
      errors: run.errors || [],
    } : previousMeta?.last_run || null,
  };
  const files = {
    "meta.json": meta,
    "tournament-index.json": generated.tournamentIndex,
    "archetype-stats.json": generated.archetypeStats,
    "card-stats.json": generated.cardStats,
    "frontend-meta.json": generated.frontend,
  };
  const changed = [];
  for (const [name, value] of Object.entries(files)) {
    const repositoryPath = path.join(PATHS.generated, name);
    const publicPath = name === "frontend-meta.json" ? null : path.join(PATHS.public, name);
    if (await writeJsonIfChanged(repositoryPath, value)) changed.push(`generated/${name}`);
    if (publicPath && await writeJsonIfChanged(publicPath, value)) changed.push(`web/data/competitive/${name}`);
  }
  for (const [tournamentId, value] of Object.entries(generated.tournamentPayloads)) {
    if (await writeJsonIfChanged(path.join(PATHS.generated, "tournaments", `${tournamentId}.json`), value)) changed.push(`generated/tournaments/${tournamentId}.json`);
    if (await writeJsonIfChanged(path.join(PATHS.public, "tournaments", `${tournamentId}.json`), value)) changed.push(`web/data/competitive/tournaments/${tournamentId}.json`);
  }
  await fs.rm(path.join(PATHS.public, "frontend-meta.json"), { force: true });
  return changed;
}

async function build() {
  await ensureDirectories();
  const [data, sourceRegistry] = await Promise.all([
    loadNormalized(),
    readJson(path.join(PATHS.sources, "sources.json"), []),
  ]);
  const validation = validateCompetitiveData(data, data);
  if (!validation.valid) throw new Error("Normalized data did not pass validation. Run `npm run data:migrate` after fixing the reported records.");
  const generated = await writeGenerated(data, Array.isArray(sourceRegistry) ? sourceRegistry : sourceRegistry.items || []);
  printSummary({ title: "Tournament Data Build", data, changed: [], errors: [], generated });
}

async function validate() {
  const data = await loadNormalized();
  const result = validateCompetitiveData(data, data);
  const errors = result.issues.filter((issue) => issue.level === "error");
  const warnings = result.issues.filter((issue) => issue.level !== "error");
  console.log(JSON.stringify({
    valid: result.valid,
    error_count: errors.length,
    warning_count: warnings.length,
    errors: options.verbose ? errors : errors.slice(0, 10),
    warnings: options.verbose ? warnings : warnings.slice(0, 10),
    report: "data/competitive/generated/validation-report.json",
  }, null, 2));
  if (!result.valid) process.exitCode = 1;
}

async function exportData() {
  await ensureDirectories();
  const data = await loadNormalized();
  const files = {
    "tournaments.csv": [data.tournaments, ["id", "name", "date", "country", "city", "region", "organizer", "format", "set", "player_count", "status", "source_ids", "last_updated"]],
    "results.csv": [data.results, ["id", "tournament_id", "player_id", "placement", "deck_id", "wins", "losses", "draws", "record", "source_archetype_name", "normalized_archetype_id"]],
    "decks.csv": [data.decks, ["id", "tournament_id", "player_id", "archetype_id", "colors", "placement"]],
    "deck_cards.csv": [data.deck_cards, ["id", "deck_id", "card_id", "quantity"]],
  };
  const changed = [];
  for (const [name, [rows, fields]] of Object.entries(files)) {
    const content = toCsv(rows.map((row) => ({ ...row, source_ids: (row.source_ids || []).join("|"), colors: (row.colors || []).join("/") })), fields);
    const destination = path.join(PATHS.exports, name);
    if (await readText(destination, "") !== content) {
      await fs.writeFile(destination, content, "utf8");
      changed.push(name);
    }
  }
  await writeJsonIfChanged(path.join(PATHS.exports, "competitive-data.json"), data);
  console.log(`Export complete: ${changed.length ? changed.join(", ") : "no changed CSV files"}.`);
}

async function update() {
  const errors = [];
  const checkedAt = new Date().toISOString();
  if (!options["skip-fetch"]) {
    await runPublicCollector(errors);
  }
  const migration = await migrate({ mode: "update", checked_at: checkedAt, errors });
  try {
    await runPython(["scripts/build_gundam_web_data.py"]);
  } catch (error) {
    errors.push({ source_id: "web-payload", status: "error", error: error.message });
    console.warn(`The refreshed normalized data could not rebuild app-data.json: ${error.message}`);
  }
  await writeRunReport(migration.data, checkedAt, errors);
  printSummary({ title: "Tournament Data Update", data: migration.data, changed: migration.changed, errors, generated: migration.generated, tournament: options.tournament });
}

async function writeRunReport(data, checkedAt, errors) {
  const repositoryPath = path.join(PATHS.generated, "run-report.json");
  const publicPath = path.join(PATHS.public, "run-report.json");
  if (!errors.length) {
    await Promise.all([fs.rm(repositoryPath, { force: true }), fs.rm(publicPath, { force: true })]);
    return;
  }
  const report = {
    schema_version: "tcgtd-competitive-run-report-v1",
    checked_at: checkedAt,
    status: "error",
    data_hash: contentHash(data),
    errors,
  };
  await Promise.all([writeJsonIfChanged(repositoryPath, report), writeJsonIfChanged(publicPath, report)]);
}

async function runPublicCollector(errors = []) {
  // Competitive rows refer to card numbers. Refresh the canonical Bandai
  // catalog first so a newly revealed/released card is resolved before an
  // event decklist references it. Keeping this in the default update command
  // also prevents the preview radar from silently lagging behind meta data.
  try {
    await runPython(["scripts/fetch_gundam_gcg_data.py"]);
  } catch (error) {
    errors.push({ source_id: "bandai-official", status: "error", error: error.message });
    console.warn(`Official catalog check failed; retaining the last valid catalog snapshot. ${error.message}`);
  }
  try {
    await egmanAdapter.fetch({ runCollector: () => runPython(["scripts/fetch_gundam_meta_data.py"]) });
  } catch (error) {
    errors.push({ source_id: "competitive-public-sources", status: "error", error: error.message });
    console.warn(`Competitive source check failed; retaining the last valid tournament dataset. ${error.message}`);
  }
}

async function runPython(args) {
  const candidates = process.env.PYTHON ? [[process.env.PYTHON, args]] : process.platform === "win32"
    ? [["py", ["-3", ...args]], ["C:/Users/bruno/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe", args], ["python", args]]
    : [["python3", args], ["python", args]];
  let lastError;
  for (const [executable, executableArgs] of candidates) {
    try {
      await execute(executable, executableArgs);
      return;
    } catch (error) {
      lastError = error;
      if (error.code !== "ENOENT" && error.exitCode !== 9009) throw error;
    }
  }
  throw lastError || new Error("Python was not found. Set PYTHON to run public-source updates.");
}

function execute(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: ROOT, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else {
        const error = new Error(`${path.basename(executable)} exited with status ${code}.`);
        error.exitCode = code;
        reject(error);
      }
    });
  });
}

function printSummary({ title, data, changed = [], errors = [], generated = [], tournament = null }) {
  const affected = tournament ? data.tournaments.filter((row) => row.id === tournament || row.id.includes(tournament)) : data.tournaments;
  console.log(`\n${title}\n\nKnown tournaments: ${data.tournaments.length}\nChecked: ${affected.length}\nUpdated: ${changed.length ? affected.length : 0}\nUnchanged: ${changed.length ? Math.max(0, affected.length - affected.length) : affected.length}\nErrors: ${errors.length}`);
  if (changed.length || generated.length) console.log(`\nUPDATED\n${changed.concat(generated).join("\n")}`);
  if (errors.length) console.log(`\nERROR\n${errors.map((item) => `${item.source_id}: ${item.error}`).join("\n")}`);
}
