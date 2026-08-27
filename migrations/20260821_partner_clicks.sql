-- Aggregate outbound-click telemetry for configured commerce partners.
-- This table deliberately excludes account identifiers, IP addresses and the
-- destination URL query string. It measures interest without profiling users.

CREATE TABLE IF NOT EXISTS partner_offer_clicks (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  source_code TEXT NOT NULL,
  card_number TEXT,
  printing_id TEXT,
  page_path TEXT NOT NULL,
  destination_host TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partner_offer_clicks_partner_created_at
ON partner_offer_clicks(partner_id, created_at);

PRAGMA optimize;
