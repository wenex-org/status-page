import { config } from '../config.js';
import type { Resource } from '../models/types.js';
import { StatusHistoryModel, type CheckResult } from '../models/status-history.model.js';

/** True when the endpoint path ends with `/status` (the health-check convention). */
function isStatusEndpoint(endpoint: string): boolean {
  try {
    const path = new URL(endpoint).pathname.replace(/\/+$/, '').toLowerCase();
    return path.endsWith('/status');
  } catch {
    return false;
  }
}

/**
 * Performs a single health check against a resource's endpoint.
 *
 * When the endpoint path ends with `/status` it is treated as a structured
 * health check returning the NestJS Terminus / wenex gateway format:
 *   { "status": "ok" | "error", "info": {...}, "error": {...}, "details": {...} }
 * and is UP only when the request is 2xx AND the body's `status` is "ok"/"up".
 *
 * For any other endpoint we don't inspect the body — a 2xx HTTP status alone
 * means operational.
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

    // Only `/status` endpoints have their JSON body inspected; everything else
    // is judged purely by the HTTP status code (2xx = operational).
    if (isStatusEndpoint(resource.endpoint)) {
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
