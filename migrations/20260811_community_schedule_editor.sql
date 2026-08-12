-- Store-managed recurring schedules and per-date exceptions.
-- This complements the historical community archive: these rows are the
-- organizer-confirmed source for future weekly occurrences.

ALTER TABLE community_weekly_schedules ADD COLUMN format_name TEXT;
ALTER TABLE community_weekly_schedules ADD COLUMN description TEXT;
ALTER TABLE community_weekly_schedules ADD COLUMN start_date TEXT;
ALTER TABLE community_weekly_schedules ADD COLUMN end_date TEXT;

CREATE TABLE IF NOT EXISTS community_schedule_exceptions (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES community_weekly_schedules(id) ON DELETE CASCADE,
  occurrence_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cancelled', 'override')),
  name TEXT,
  start_time TEXT,
  format_name TEXT,
  description TEXT,
  registration_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  UNIQUE(schedule_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_community_schedule_exceptions_schedule_date
ON community_schedule_exceptions(schedule_id, occurrence_date);

PRAGMA optimize;
