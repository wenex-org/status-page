import path from 'node:path';

/**
 * Centralised, typed application configuration sourced from environment
 * variables with sensible defaults. Imported by every layer of the app.
 */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const projectRoot = path.resolve(__dirname, '..');

export const config = {
  projectRoot,
  port: envInt('PORT', 1045),
  host: process.env.HOST ?? '0.0.0.0',
  dbPath: path.resolve('data/status.db'),
  retentionDays: envInt('RETENTION_DAYS', 90),
  publicDir: path.resolve(projectRoot, 'public'),
  checkTimeoutMs: envInt('CHECK_TIMEOUT_MS', 10_000),
  defaultAdmin: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'admin',
  },
  /** Allowed polling intervals (minutes) exposed in the admin UI. */
  allowedIntervals: [5, 15, 30, 45, 90] as const,
  /** Groups seeded on first run (only when no groups exist yet). */
  defaultGroups: ['Services', 'Workers'] as const,
} as const;

export type AllowedInterval = (typeof config.allowedIntervals)[number];
