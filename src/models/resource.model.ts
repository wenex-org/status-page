import type { Resource } from './types.js';
import { getDb } from '../db/index.js';

/** Data access for tracked resources. */
export const ResourceModel = {
  all(): Resource[] {
    return getDb()
      .prepare('SELECT * FROM resources ORDER BY name COLLATE NOCASE')
      .all() as Resource[];
  },

  enabled(): Resource[] {
    return getDb()
      .prepare('SELECT * FROM resources WHERE enabled = 1 ORDER BY name COLLATE NOCASE')
      .all() as Resource[];
  },

  find(id: number): Resource | undefined {
    return getDb().prepare('SELECT * FROM resources WHERE id = ?').get(id) as
      Resource | undefined;
  },

  create(input: {
    name: string;
    endpoint: string;
    intervalMinutes: number;
    groupId?: number | null;
  }): Resource {
    const info = getDb()
      .prepare(
        'INSERT INTO resources (name, endpoint, interval_minutes, group_id) VALUES (?, ?, ?, ?)',
      )
      .run(input.name, input.endpoint, input.intervalMinutes, input.groupId ?? null);
    return this.find(Number(info.lastInsertRowid))!;
  },

  update(
    id: number,
    input: Partial<{
      name: string;
      endpoint: string;
      intervalMinutes: number;
      enabled: boolean;
      // undefined = leave unchanged; null = move to ungrouped.
      groupId: number | null;
    }>,
  ): Resource | undefined {
    const existing = this.find(id);
    if (!existing) return undefined;

    const next = {
      name: input.name ?? existing.name,
      endpoint: input.endpoint ?? existing.endpoint,
      interval_minutes: input.intervalMinutes ?? existing.interval_minutes,
      enabled: input.enabled === undefined ? existing.enabled : input.enabled ? 1 : 0,
      group_id: input.groupId === undefined ? existing.group_id : input.groupId,
    };

    getDb()
      .prepare(
        'UPDATE resources SET name = ?, endpoint = ?, interval_minutes = ?, enabled = ?, group_id = ? WHERE id = ?',
      )
      .run(
        next.name,
        next.endpoint,
        next.interval_minutes,
        next.enabled,
        next.group_id,
        id,
      );
    return this.find(id);
  },

  remove(id: number): boolean {
    return getDb().prepare('DELETE FROM resources WHERE id = ?').run(id).changes > 0;
  },
};
