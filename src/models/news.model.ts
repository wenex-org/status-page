import { getDb } from '../db/index.js';
import type { News } from './types.js';

/** Data access for news / announcement banners. */
export const NewsModel = {
  all(): News[] {
    return getDb().prepare('SELECT * FROM news ORDER BY created_at DESC').all() as News[];
  },

  active(): News[] {
    return getDb()
      .prepare('SELECT * FROM news WHERE active = 1 ORDER BY created_at DESC')
      .all() as News[];
  },

  create(input: { title: string; body: string; level: News['level'] }): News {
    const info = getDb()
      .prepare('INSERT INTO news (title, body, level) VALUES (?, ?, ?)')
      .run(input.title, input.body, input.level);
    return getDb()
      .prepare('SELECT * FROM news WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as News;
  },

  setActive(id: number, active: boolean): boolean {
    return (
      getDb()
        .prepare('UPDATE news SET active = ? WHERE id = ?')
        .run(active ? 1 : 0, id).changes > 0
    );
  },

  remove(id: number): boolean {
    return getDb().prepare('DELETE FROM news WHERE id = ?').run(id).changes > 0;
  },
};
