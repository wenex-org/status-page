import type { Group } from './types.js';
import { getDb } from '../db/index.js';

/** Turn a display name into a URL-safe, stable slug. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'group'
  );
}

/** Data access for service groups (configurable categories). */
export const GroupModel = {
  all(): Group[] {
    return getDb()
      .prepare('SELECT * FROM groups ORDER BY position, name COLLATE NOCASE')
      .all() as Group[];
  },

  find(id: number): Group | undefined {
    return getDb().prepare('SELECT * FROM groups WHERE id = ?').get(id) as
      Group | undefined;
  },

  create(name: string): Group {
    const db = getDb();
    const slug = this.uniqueSlug(slugify(name));
    const nextPos =
      (
        db.prepare('SELECT COALESCE(MAX(position), -1) AS p FROM groups').get() as {
          p: number;
        }
      ).p + 1;
    const info = db
      .prepare('INSERT INTO groups (name, slug, position) VALUES (?, ?, ?)')
      .run(name, slug, nextPos);
    return this.find(Number(info.lastInsertRowid))!;
  },

  /** Rename a group. The slug stays stable so existing links keep working. */
  rename(id: number, name: string): Group | undefined {
    const existing = this.find(id);
    if (!existing) return undefined;
    getDb().prepare('UPDATE groups SET name = ? WHERE id = ?').run(name, id);
    return this.find(id);
  },

  remove(id: number): boolean {
    // Member resources are detached (group_id → NULL) by the FK rule.
    return getDb().prepare('DELETE FROM groups WHERE id = ?').run(id).changes > 0;
  },

  /** Persist an explicit ordering. Ids absent from `orderedIds` are untouched. */
  reorder(orderedIds: number[]): void {
    const db = getDb();
    const stmt = db.prepare('UPDATE groups SET position = ? WHERE id = ?');
    const tx = db.transaction((ids: number[]) => {
      ids.forEach((id, index) => stmt.run(index, id));
    });
    tx(orderedIds);
  },

  /** Seed the conventional groups on first run (only when none exist). */
  seedDefaults(defaults: string[]): void {
    if (this.all().length > 0) return;
    for (const name of defaults) this.create(name);
  },

  uniqueSlug(base: string): string {
    const db = getDb();
    const exists = (s: string) =>
      db.prepare('SELECT 1 FROM groups WHERE slug = ?').get(s) !== undefined;
    if (!exists(base)) return base;
    let n = 2;
    while (exists(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
  },
};
