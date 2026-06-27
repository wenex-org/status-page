import { ResourceModel } from '../models/resource.model.js';
import { GroupModel } from '../models/group.model.js';
import { StatusHistoryModel } from '../models/statusHistory.model.js';
import type {
  AggregateStatus,
  GroupStatusView,
  ResourceStatusView,
} from '../models/types.js';

/** Builds the aggregated status view for every resource. */
export function buildStatusViews(): ResourceStatusView[] {
  return ResourceModel.all().map((resource) => {
    const latest = StatusHistoryModel.latest(resource.id);
    const history = StatusHistoryModel.recent(resource.id, 60);

    let current: ResourceStatusView['current'] = 'unknown';
    if (latest) current = latest.is_up ? 'up' : 'down';

    return {
      id: resource.id,
      name: resource.name,
      endpoint: resource.endpoint,
      intervalMinutes: resource.interval_minutes,
      enabled: resource.enabled === 1,
      groupId: resource.group_id,
      current: resource.enabled === 1 ? current : 'unknown',
      lastCheckedAt: latest?.checked_at ?? null,
      uptime24h: StatusHistoryModel.uptimePercent(
        resource.id,
        resource.interval_minutes,
        24,
      ),
      responseTimeMs: latest?.response_time_ms ?? null,
      history: history.map((h) => ({ checkedAt: h.checked_at, isUp: h.is_up === 1 })),
    };
  });
}

/**
 * Reduce a set of resource views to a single aggregate status. Used for both
 * per-group status and the overall page headline (single source of truth).
 */
export function aggregate(views: ResourceStatusView[]): AggregateStatus {
  const tracked = views.filter((v) => v.enabled);
  if (tracked.length === 0) return 'unknown';
  const downs = tracked.filter((v) => v.current === 'down').length;
  if (downs === 0) {
    return tracked.every((v) => v.current === 'unknown') ? 'unknown' : 'operational';
  }
  return downs === tracked.length ? 'down' : 'degraded';
}

/**
 * Groups resource views by their configured group (preserving group order),
 * appends an implicit "Other" bucket for ungrouped resources, and computes an
 * aggregate status per group plus an overall summary. Empty groups are omitted.
 */
export function buildGroupedStatus(): {
  overall: AggregateStatus;
  groups: GroupStatusView[];
} {
  const views = buildStatusViews();

  const byGroup = new Map<number | null, ResourceStatusView[]>();
  for (const view of views) {
    const key = view.groupId ?? null;
    const bucket = byGroup.get(key) ?? [];
    bucket.push(view);
    byGroup.set(key, bucket);
  }

  const groups: GroupStatusView[] = GroupModel.all().map((group) => {
    const resources = byGroup.get(group.id) ?? [];
    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      status: aggregate(resources),
      resources,
    };
  });

  const ungrouped = byGroup.get(null) ?? [];
  if (ungrouped.length > 0) {
    groups.push({
      id: null,
      name: 'Other',
      slug: 'other',
      status: aggregate(ungrouped),
      resources: ungrouped,
    });
  }

  return {
    overall: aggregate(views),
    groups: groups.filter((g) => g.resources.length > 0),
  };
}
