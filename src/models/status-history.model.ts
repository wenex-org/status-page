import type { StatusCheck } from './types.js';
import { getDb } from '../db/index.js';

export interface CheckResult {
  resourceId: number;
  isUp: boolean;
  responseTimeMs: number | null;
  statusCode: number | null;
  detail: string | null;
}

/** Data access + aggregation for the status_history table. */
export const StatusHistoryModel = {
  record(result: CheckResult): void {
    getDb()
      .prepare(
        `INSERT INTO status_history (resource_id, is_up, response_time_ms, status_code, detail)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        result.resourceId,
        result.isUp ? 1 : 0,
        result.responseTimeMs,
        result.statusCode,
        result.detail,
      );
  },

  latest(resourceId: number): StatusCheck | undefined {
    return getDb()
      .prepare(
        'SELECT * FROM status_history WHERE resource_id = ? ORDER BY checked_at DESC LIMIT 1',
      )
      .get(resourceId) as StatusCheck | undefined;
  },

  /** Recent checks, returned oldest→newest for rendering an uptime bar. */
  recent(resourceId: number, limit = 60): StatusCheck[] {
    const rows = getDb()
      .prepare(
        'SELECT * FROM status_history WHERE resource_id = ? ORDER BY checked_at DESC LIMIT ?',
      )
      .all(resourceId, limit) as StatusCheck[];
    return rows.reverse();
  },

  /**
   * Uptime percentage over the trailing `windowHours`.
   *
   * Downtime rule: every *expected* check interval that did not report a
   * successful status counts as downtime. We therefore divide the number of
   * successful checks by the number of intervals that *should* have run in
   * the window — so missed checks (process down, network gone) lower uptime
   * just like recorded failures do.
   */
  uptimePercent(
    resourceId: number,
    intervalMinutes: number,
    windowHours: number,
  ): number | null {
    const db = getDb();
    const since = `-${windowHours} hours`;

    const firstCheck = db
      .prepare(
        `SELECT MIN(checked_at) AS first FROM status_history WHERE resource_id = ?`,
      )
      .get(resourceId) as { first: string | null };
    if (!firstCheck.first) return null; // never checked yet

    const successful = db
      .prepare(
        `SELECT COUNT(*) AS n FROM status_history
         WHERE resource_id = ? AND is_up = 1 AND checked_at >= datetime('now', ?)`,
      )
      .get(resourceId, since) as { n: number };

    // Expected intervals: clamp the window to the resource's monitoring age so
    // a freshly added resource isn't penalised for time before it existed.
    const ageMs = Date.now() - new Date(`${firstCheck.first}Z`).getTime();
    const windowMs = windowHours * 3_600_000;
    const effectiveMs = Math.min(windowMs, ageMs);
    const expected = Math.max(1, Math.round(effectiveMs / (intervalMinutes * 60_000)));

    const pct = (successful.n / expected) * 100;
    return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
  },

  /** Delete rows older than the retention window. Returns rows removed. */
  prune(retentionDays: number): number {
    return getDb()
      .prepare(`DELETE FROM status_history WHERE checked_at < datetime('now', ?)`)
      .run(`-${retentionDays} days`).changes;
  },
};
