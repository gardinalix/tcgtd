import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("alpha hosting declares D1 and a provider-neutral access model", async () => {
  const hosting = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"));
  const migration = await readFile(new URL("../drizzle/0000_alpha_foundation.sql", import.meta.url), "utf8");
  assert.equal(hosting.d1, "DB");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS users/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS subscriptions/);
  assert.match(migration, /'supporter', 'newtype', 'master'/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS feedback/);
});

test("share-by-link alpha stays outside search indexes", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const robots = await readFile(new URL("../web/robots.txt", import.meta.url), "utf8");
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(robots, /Disallow: \//);
});
