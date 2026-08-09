-- TCG Tactical Database product foundation.
-- Non-breaking compatibility tables keep game modules, billing state and access
-- entitlements separate from operational account roles.

CREATE TABLE IF NOT EXISTS game_modules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'retired')),
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO game_modules (id, name, status, config_json)
VALUES ('gundam-card-game', 'Gundam Card Game', 'active', '{"assetNamespace":"gundam"}');

CREATE TABLE IF NOT EXISTS deck_game_links (
  deck_id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL DEFAULT 'gundam-card-game',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES game_modules(id)
);

CREATE INDEX IF NOT EXISTS idx_deck_game_links_game_id ON deck_game_links(game_id);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_membership_id TEXT,
  provider_tier_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'supporter')),
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TEXT,
  synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (provider, provider_membership_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON user_subscriptions(user_id, status);

CREATE TABLE IF NOT EXISTS user_entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  code TEXT NOT NULL,
  source TEXT NOT NULL,
  starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at TEXT,
  revoked_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, code, source)
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_lookup ON user_entitlements(user_id, code, ends_at, revoked_at);

CREATE TABLE IF NOT EXISTS asset_rights (
  asset_path TEXT PRIMARY KEY,
  game_id TEXT,
  source_url TEXT,
  owner_name TEXT,
  license_name TEXT,
  permitted_use TEXT,
  review_status TEXT NOT NULL DEFAULT 'review_required',
  reviewed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (game_id) REFERENCES game_modules(id)
);
