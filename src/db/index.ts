import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

import { config } from '../config.js';

/**
 * Opens (and lazily initialises) the singleton SQLite connection.
 * Schema is applied idempotently; the data directory is created on demand.
 */
let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

  const db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Resolve schema.sql next to this file (dev: src/db, prod: dist/db);
  // fall back to the source tree for safety.
  const schemaCandidates = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(config.projectRoot, 'src/db/schema.sql'),
  ];
  const schemaPath = schemaCandidates.find((p) => fs.existsSync(p));
  if (!schemaPath) {
    throw new Error(`schema.sql not found (looked in: ${schemaCandidates.join(', ')})`);
  }
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
  runMigrations(db);

  dbInstance = db;
  return db;
}

/** Idempotent, additive migrations for databases created before a feature. */
function runMigrations(db: Database.Database): void {
  if (!hasColumn(db, 'resources', 'group_id')) {
    db.exec(
      'ALTER TABLE resources ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL',
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_resources_group ON resources (group_id)');
  }

  if (!hasColumn(db, 'resources', 'position')) {
    db.exec('ALTER TABLE resources ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
    // Backfill a stable initial order (by name) so existing rows are deterministic.
    const rows = db
      .prepare('SELECT id FROM resources ORDER BY name COLLATE NOCASE')
      .all() as { id: number }[];
    const upd = db.prepare('UPDATE resources SET position = ? WHERE id = ?');
    db.transaction((rs: { id: number }[]) =>
      rs.forEach((r, i) => upd.run(i, r.id)),
    )(rows);
  }
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
