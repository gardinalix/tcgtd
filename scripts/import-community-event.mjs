import fs from "node:fs/promises";
import { validateContribution } from "../src/domain/communityContribution.js";
import { contributionId } from "./data-engine/adapters/communityAdapter.mjs";

try {
  const args = process.argv.slice(2);
  const filename = args.find(arg => !arg.startsWith("--"));
  if (!filename) throw new Error("Usage: node scripts/import-community-event.mjs <file.json> [--accept]");
  if ((await fs.stat(filename)).size > 1024 * 1024) throw new Error("Contribution exceeds 1 MB.");
  const validation = validateContribution(JSON.parse(await fs.readFile(filename, "utf8")));
  if (!validation.valid) throw new Error(validation.errors.join("\n"));
  const value = validation.value;
  const id = contributionId(value);
  console.log(JSON.stringify({ id, event: value.event, results: value.results.length, indexedCardLists: 0, publication: "requires separate live approval" }, null, 2));
  if (args.includes("--accept")) {
    const directory = new URL("../data/competitive/sources/community-events/", import.meta.url);
    await fs.mkdir(directory, { recursive: true });
    const destination = new URL(`${id}.json`, directory);
    // Exclusive creation makes re-import idempotent and prevents silent overwrites.
    await fs.writeFile(destination, `${JSON.stringify({ ...value, status: "reviewed", reviewedAt: new Date().toISOString() }, null, 2)}\n`, { flag: "wx" });
    console.log("Accepted locally. Run data:migrate, rebuild the web payload and validate before publication.");
  } else console.log("Review only. No data written. Use --accept after reviewing the source and results.");
} catch (error) { console.error(error.code === "EEXIST" ? "Event already accepted; review the existing contribution before making a correction." : error.message); process.exitCode = 1; }
