/** Row + DTO type definitions shared across models and controllers. */

/** Aggregate up/down state shared by groups and the overall summary. */
export type AggregateStatus = 'operational' | 'degraded' | 'down' | 'unknown';

/** A configurable category of services (e.g. gateway, services, workers, infra). */
export interface Group {
  id: number;
  name: string;
  slug: string;
  position: number;
  created_at: string;
}

export interface Resource {
  id: number;
  name: string;
  endpoint: string;
  interval_minutes: number;
  enabled: number; // 0 | 1
  group_id: number | null;
  position: number;
  created_at: string;
}

export interface StatusCheck {
  id: number;
  resource_id: number;
  checked_at: string;
  is_up: number; // 0 | 1
  response_time_ms: number | null;
  status_code: number | null;
  detail: string | null;
}

export interface News {
  id: number;
  title: string;
  body: string;
  level: 'info' | 'warning' | 'critical';
  active: number; // 0 | 1
  created_at: string;
}

export interface Credentials {
  id: number;
  username: string;
  password_hash: string;
  updated_at: string;
}

/** Aggregated view of a resource for the public status page. */
export interface ResourceStatusView {
  id: number;
  name: string;
  endpoint: string;
  intervalMinutes: number;
  enabled: boolean;
  groupId: number | null;
  current: 'up' | 'down' | 'unknown';
  lastCheckedAt: string | null;
  uptime24h: number | null; // percentage 0–100
  responseTimeMs: number | null;
  /** Most recent checks, oldest→newest, for a sparkline/uptime bar. */
  history: { checkedAt: string; isUp: boolean }[];
}

/** A group with its member resources and aggregated status. */
export interface GroupStatusView {
  id: number | null; // null = the implicit "Other" bucket for ungrouped resources
  name: string;
  slug: string;
  status: AggregateStatus;
  resources: ResourceStatusView[];
}
