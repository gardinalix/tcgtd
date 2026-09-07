import fs from "node:fs/promises";
import path from "node:path";
import { fetchMsaPublicHome, parseMsaPublicHome } from "./data-engine/adapters/msaPublicAdapter.mjs";

const root = new URL("../", import.meta.url);
try {
  const args = process.argv.slice(2);
  const from = args.indexOf("--from-html");
  let snapshot;
  if (from >= 0) {
    if (!args[from + 1]) throw new Error("--from-html requires a file.");
    const file = path.resolve(args[from + 1]);
    const stat = await fs.stat(file);
    snapshot = parseMsaPublicHome(await fs.readFile(file, "utf8"), stat.mtime.toISOString());
  } else snapshot = await fetchMsaPublicHome();
  const target = new URL("web/data/competitive/msa-public.json", root);
  await fs.mkdir(new URL("./", target), { recursive: true });
  const temporary = new URL("msa-public.json.tmp", target);
  await fs.writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
  await fs.rename(temporary, target);
  console.log(JSON.stringify({ status: snapshot.status, observedAt: snapshot.observedAt, sampledGames: snapshot.items.length, capabilities: snapshot.capabilities }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
