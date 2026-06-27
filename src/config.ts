import fs from 'node:fs';
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

/** Project version: the APP_VERSION env var if set, else package.json's version. */
function resolveVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const pkgPath = path.resolve(projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export const config = {
  projectRoot,
  version: resolveVersion(),
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
