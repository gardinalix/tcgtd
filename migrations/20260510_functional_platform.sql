-- TCG Tactical Database functional platform schema.
-- Designed for SQLite first, with names/types that can move to Postgres later.

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

CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  product_kind TEXT,
  release_date TEXT,
  source_url TEXT
);

CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  format_name TEXT,
  colors TEXT,
  archetype TEXT,
  event_id TEXT,
  result_label TEXT,
  notes TEXT,
  source_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS deck_cards (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES decks(id),
  card_number TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'main',
  quantity INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  card_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  foil_quantity INTEGER NOT NULL DEFAULT 0,
  alt_art_quantity INTEGER NOT NULL DEFAULT 0,
  promo_quantity INTEGER NOT NULL DEFAULT 0,
  condition TEXT,
  language TEXT,
  manual_price_brl REAL,
  status TEXT,
  classification TEXT,
  keep_playset INTEGER NOT NULL DEFAULT 0,
  sell_trade INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  event_type TEXT,
  official_status TEXT,
  event_date TEXT,
  location TEXT,
  country TEXT,
  player_count INTEGER,
  format_name TEXT,
  active_set TEXT,
  top_cut TEXT,
  source_name TEXT,
  source_url TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS event_decklists (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id),
  deck_id TEXT REFERENCES decks(id),
  player_name TEXT,
  placing_label TEXT,
  placing_rank INTEGER,
  archetype TEXT,
  color_combination TEXT,
  source_url TEXT
);

CREATE TABLE IF NOT EXISTS meta_signal_current (
  card_number TEXT PRIMARY KEY,
  band TEXT NOT NULL,
  recent_appearances INTEGER NOT NULL DEFAULT 0,
  top_presence INTEGER NOT NULL DEFAULT 0,
  trend_score REAL NOT NULL DEFAULT 0,
  reason TEXT,
  source TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta_signal_history (
  id TEXT PRIMARY KEY,
  card_number TEXT NOT NULL,
  previous_band TEXT,
  new_band TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  reason TEXT,
  source TEXT,
  event_id TEXT,
  related_deck_ids TEXT
);

CREATE TABLE IF NOT EXISTS previews (
  id TEXT PRIMARY KEY,
  card_name TEXT,
  card_number TEXT,
  set_code TEXT,
  color TEXT,
  card_type TEXT,
  rarity TEXT,
  image_url TEXT,
  original_japanese_text TEXT,
  provisional_translation TEXT,
  reviewed_translation TEXT,
  source_name TEXT,
  source_url TEXT,
  published_at TEXT,
  status TEXT NOT NULL,
  reliability TEXT,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS preview_sources (
  id TEXT PRIMARY KEY,
  preview_id TEXT REFERENCES previews(id),
  source_name TEXT,
  source_url TEXT,
  captured_at TEXT,
  raw_payload TEXT
);

CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT,
  status TEXT,
  source_type TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS source_runs (
  id TEXT PRIMARY KEY,
  data_source_id TEXT REFERENCES data_sources(id),
  run_at TEXT NOT NULL,
  status TEXT NOT NULL,
  items_found INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE TABLE IF NOT EXISTS source_items (
  id TEXT PRIMARY KEY,
  source_run_id TEXT REFERENCES source_runs(id),
  source_item_id TEXT,
  item_type TEXT,
  normalized_status TEXT,
  raw_payload TEXT,
  normalized_payload TEXT
);

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  import_type TEXT NOT NULL,
  filename TEXT,
  status TEXT NOT NULL,
  rows_total INTEGER DEFAULT 0,
  rows_accepted INTEGER DEFAULT 0,
  rows_rejected INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL
);
