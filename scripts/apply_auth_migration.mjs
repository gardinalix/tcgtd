import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(path.join(ROOT, ".env"));

const raw = process.env.DATABASE_URL || "file:./data/gundam.db";
const dbPath = raw.startsWith("file:") ? raw.slice(5) : raw;
const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(ROOT, dbPath);
const db = new DatabaseSync(absoluteDbPath);

db.exec("PRAGMA foreign_keys = ON;");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    display_name TEXT NOT NULL,
    public_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    updated_at TEXT
  );
`);

addColumnIfMissing("users", "username", "TEXT");
addColumnIfMissing("users", "provider", "TEXT DEFAULT 'email'");
addColumnIfMissing("users", "provider_id", "TEXT");
addColumnIfMissing("users", "last_login_at", "TEXT");
addColumnIfMissing("users", "email_verified", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("users", "is_banned", "INTEGER NOT NULL DEFAULT 0");
addColumnIfMissing("users", "preferences", "TEXT NOT NULL DEFAULT '{}'");

db.exec(readFileSync(path.join(ROOT, "migrations", "20260510_auth_complete.sql"), "utf8"));

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'auth_%' ORDER BY name").all();
console.log(`Auth migration applied to ${absoluteDbPath}`);
console.log(`Auth tables: ${tables.map((row) => row.name).join(", ")}`);

function addColumnIfMissing(table, column, type) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    console.log(`Added ${table}.${column}`);
  }
}

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
  }
}
