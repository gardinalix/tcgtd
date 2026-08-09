-- Community directory and verified local-scene foundation.
-- Geography is stored only when the importing source provides it explicitly.

CREATE TABLE IF NOT EXISTS community_players (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  country TEXT,
  bandai_tcg_plus_id TEXT,
  claimed_user_id TEXT REFERENCES users(id),
  source_name TEXT,
  source_url TEXT,
  first_seen_at TEXT,
  last_seen_at TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_players_bandai_id
ON community_players(bandai_tcg_plus_id)
WHERE bandai_tcg_plus_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_players_country_name
ON community_players(country, canonical_name);

CREATE TABLE IF NOT EXISTS community_venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address_line TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  postal_code TEXT,
  latitude REAL,
  longitude REAL,
  time_zone TEXT,
  bandai_tcg_plus_id TEXT,
  website_url TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_venues_bandai_id
ON community_venues(bandai_tcg_plus_id)
WHERE bandai_tcg_plus_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_venues_country_region_city
ON community_venues(country, region, city);

CREATE TABLE IF NOT EXISTS community_event_venues (
  event_id TEXT NOT NULL REFERENCES events(id),
  venue_id TEXT NOT NULL REFERENCES community_venues(id),
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  verified_at TEXT,
  PRIMARY KEY (event_id, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_community_event_venues_venue
ON community_event_venues(venue_id, event_id);

CREATE TABLE IF NOT EXISTS community_weekly_schedules (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL REFERENCES community_venues(id),
  name TEXT NOT NULL,
  weekday INTEGER,
  start_time TEXT,
  time_zone TEXT,
  recurrence_rule TEXT,
  entry_fee_text TEXT,
  registration_url TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  verified_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_community_weekly_schedules_venue_active
ON community_weekly_schedules(venue_id, active);

CREATE TABLE IF NOT EXISTS community_event_entries (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  player_id TEXT REFERENCES community_players(id),
  display_name TEXT NOT NULL,
  placing_rank INTEGER,
  match_points INTEGER,
  wins INTEGER,
  losses INTEGER,
  draws INTEGER,
  deck_id TEXT REFERENCES decks(id),
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_community_event_entries_event_rank
ON community_event_entries(event_id, placing_rank);

CREATE INDEX IF NOT EXISTS idx_community_event_entries_player_event
ON community_event_entries(player_id, event_id);

CREATE TABLE IF NOT EXISTS community_event_matches (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  round_number INTEGER,
  table_number INTEGER,
  player_a_id TEXT REFERENCES community_players(id),
  player_b_id TEXT REFERENCES community_players(id),
  outcome TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_event_matches_event_round
ON community_event_matches(event_id, round_number);

PRAGMA optimize;
