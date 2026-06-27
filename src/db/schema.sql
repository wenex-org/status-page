-- SQLite schema for the status page.
-- Applied idempotently on boot via db/index.ts.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Configurable categories of services (gateway, services, workers, infra, …).
CREATE TABLE IF NOT EXISTS groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  slug       TEXT    NOT NULL UNIQUE,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Tracked resources: a name + an endpoint to health-check, optionally grouped.
CREATE TABLE IF NOT EXISTS resources (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  endpoint         TEXT    NOT NULL,
  interval_minutes INTEGER NOT NULL DEFAULT 5,
  enabled          INTEGER NOT NULL DEFAULT 1,
  group_id         INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resources_group ON resources (group_id);

-- One row per executed health check (success or failure).
CREATE TABLE IF NOT EXISTS status_history (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id      INTEGER NOT NULL,
  checked_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  is_up            INTEGER NOT NULL,
  response_time_ms INTEGER,
  status_code      INTEGER,
  detail           TEXT,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_status_history_resource_time
  ON status_history (resource_id, checked_at);

-- News / announcement banners shown on the public page.
CREATE TABLE IF NOT EXISTS news (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  level      TEXT    NOT NULL DEFAULT 'info', -- info | warning | critical
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Single-row admin credentials table (id is pinned to 1).
CREATE TABLE IF NOT EXISTS credentials (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  username      TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
