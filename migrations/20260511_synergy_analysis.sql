-- Gundam Tactical Database synergy analysis schema.
-- SQLite first; columns are portable to Postgres for production.

CREATE TABLE IF NOT EXISTS card_synergy_cache (
  id TEXT PRIMARY KEY,
  source_card_id TEXT NOT NULL,
  target_card_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  rank TEXT NOT NULL,
  synergy_types TEXT NOT NULL,
  explanation TEXT NOT NULL,
  evidence_json TEXT,
  calculated_at TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  UNIQUE(source_card_id, target_card_id, algorithm_version)
);

CREATE INDEX IF NOT EXISTS idx_card_synergy_cache_source
  ON card_synergy_cache(source_card_id, score DESC);

CREATE TABLE IF NOT EXISTS synergy_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  weight INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS synergy_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  source_card_id TEXT NOT NULL,
  target_card_id TEXT NOT NULL,
  feedback TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_synergy_feedback_pair
  ON synergy_feedback(source_card_id, target_card_id, created_at);
