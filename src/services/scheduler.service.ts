import cron, { type ScheduledTask } from 'node-cron';
import { config } from '../config.js';
import { ResourceModel } from '../models/resource.model.js';
import { StatusHistoryModel } from '../models/statusHistory.model.js';
import type { Resource } from '../models/types.js';
import { checkAndRecord } from './checker.service.js';

/**
 * Monitoring scheduler.
 *
 * A single cron tick fires every minute and checks each enabled resource that
 * is *due* — i.e. whose last check is older than its configured interval. This
 * keeps per-resource scheduling simple while honouring the 5 / 15-minute
 * options, and lets the downtime rule (StatusHistoryModel.uptimePercent)
 * reason about expected vs. recorded checks.
 *
 * A daily tick prunes history beyond the retention window.
 */
const tasks: ScheduledTask[] = [];
const inFlight = new Set<number>();

function isDue(resource: Resource): boolean {
  const last = StatusHistoryModel.latest(resource.id);
  if (!last) return true; // never checked → check now
  const lastMs = new Date(`${last.checked_at}Z`).getTime();
  // 30s grace so a check that lands slightly early still counts for the slot.
  const dueAfterMs = resource.interval_minutes * 60_000 - 30_000;
  return Date.now() - lastMs >= dueAfterMs;
}

async function runDueChecks(): Promise<void> {
  const resources = ResourceModel.enabled();
  await Promise.allSettled(
    resources.filter(isDue).map(async (resource) => {
      if (inFlight.has(resource.id)) return; // avoid overlap on slow endpoints
      inFlight.add(resource.id);
      try {
        const result = await checkAndRecord(resource);
        const state = result.isUp ? 'UP' : 'DOWN';
        console.log(
          `[monitor] ${resource.name} → ${state} (${result.detail ?? ''})`.trim(),
        );
      } catch (err) {
        console.error(`[monitor] failed checking ${resource.name}:`, err);
      } finally {
        inFlight.delete(resource.id);
      }
    }),
  );
}

export function startScheduler(): void {
  // Run an initial pass shortly after boot so the page isn't empty.
  setTimeout(() => void runDueChecks(), 2_000);

  tasks.push(
    cron.schedule('* * * * *', () => {
      void runDueChecks();
    }),
  );

  // Daily prune at 03:15.
  tasks.push(
    cron.schedule('15 3 * * *', () => {
      const removed = StatusHistoryModel.prune(config.retentionDays);
      if (removed > 0) console.log(`[monitor] pruned ${removed} old history rows`);
    }),
  );

  console.log('[monitor] scheduler started (1-minute tick)');
}

export function stopScheduler(): void {
  for (const task of tasks) task.stop();
  tasks.length = 0;
}

/** Trigger an immediate check of one resource (used by the admin panel). */
export async function checkNow(resourceId: number): Promise<void> {
  const resource = ResourceModel.find(resourceId);
  if (resource) await checkAndRecord(resource);
}
