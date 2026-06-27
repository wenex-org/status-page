import { config } from '../config.js';
import type { Resource } from '../models/types.js';
import { StatusHistoryModel, type CheckResult } from '../models/statusHistory.model.js';

/**
 * Performs a single health check against a resource's endpoint.
 *
 * Endpoints return the NestJS Terminus / wenex gateway format:
 *   { "status": "ok" | "error", "info": {...}, "error": {...}, "details": {...} }
 *
 * A resource is considered UP when the HTTP request succeeds with a 2xx status
 * and the body's top-level `status` is "ok" (or "up"). If the body isn't the
 * expected shape we fall back to treating any 2xx response as up.
 */
export async function checkResource(resource: Resource): Promise<CheckResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.checkTimeoutMs);

  try {
    const res = await fetch(resource.endpoint, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      redirect: 'follow',
    });
    const responseTimeMs = Date.now() - started;

    let isUp = res.ok;
    let detail: string | null = `HTTP ${res.status}`;

    try {
      const body = (await res.json()) as { status?: string };
      if (body && typeof body.status === 'string') {
        const s = body.status.toLowerCase();
        isUp = res.ok && (s === 'ok' || s === 'up');
        detail = `status=${body.status}`;
      }
    } catch {
      // Non-JSON body: rely on the HTTP status code already captured.
    }

    return {
      resourceId: resource.id,
      isUp,
      responseTimeMs,
      statusCode: res.status,
      detail,
    };
  } catch (err) {
    const responseTimeMs = Date.now() - started;
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      resourceId: resource.id,
      isUp: false,
      responseTimeMs,
      statusCode: null,
      detail: aborted ? 'timeout' : err instanceof Error ? err.message : 'request failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Check a resource and persist the result. Returns the recorded result. */
export async function checkAndRecord(resource: Resource): Promise<CheckResult> {
  const result = await checkResource(resource);
  StatusHistoryModel.record(result);
  return result;
}
