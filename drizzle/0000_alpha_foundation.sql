PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'chatgpt',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'supporter', 'newtype', 'master')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'past_due', 'canceled', 'expired')),
  expiration TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
ON subscriptions(user_id, status, expiration);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  contact_email TEXT NOT NULL DEFAULT '',
  page_path TEXT NOT NULL DEFAULT '/',
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  release_channel TEXT NOT NULL DEFAULT 'alpha',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'resolved', 'rejected')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created_at
ON feedback(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_user_created_at
ON feedback(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

PRAGMA optimize;
