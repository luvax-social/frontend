import type { ApiResponse } from '@/types/api';
export interface ApiResult<T = unknown> {
  status: number;
  body: (Partial<ApiResponse<T>> & { raw?: string }) | null;
  headers: Headers;
}
interface ApiOptions {
  method?: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}
export const API_BASE = process.env.LUVAX_API_BASE || 'http://localhost:8080';
export const API_V1 = `${API_BASE}/api/v1`;
export const MAILPIT_BASE = process.env.LUVAX_MAILPIT_BASE || 'http://localhost:8025';

/**
 * Performs a request and always returns a structured result, never throwing on a non-2xx
 * status. Tests assert on `status` explicitly, so a 401 is data to be checked rather than
 * an exception to be caught.
 */
export async function api<T = unknown>(
  path: string,
  { method = 'GET', token, body, headers = {} }: ApiOptions = {}
): Promise<ApiResult<T>> {
  const url = path.startsWith('http') ? path : `${API_V1}${path}`;
  const finalHeaders: Record<string, string> = { Accept: 'application/json', ...headers };

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: ApiResult<T>['body'] = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  return { status: response.status, body: parsed, headers: response.headers };
}

/** Returns the envelope's `data`, throwing a readable error when the call failed. */
export function unwrap<T>(result: ApiResult<T>): T {
  if (!result.body || result.body.success !== true) {
    const code = result.body?.code ?? 'NO_CODE';
    const message = result.body?.message ?? 'no message';
    throw new Error(`Expected success, got ${result.status} ${code}: ${message}`);
  }
  return result.body.data as T;
}

/** Asserts the ApiResponse envelope shape every endpoint is contractually required to return. */
export function expectEnvelope<T>(
  result: ApiResult<T>
): asserts result is ApiResult<T> & { body: ApiResponse<T> } {
  if (!result.body || typeof result.body !== 'object') {
    throw new Error(`Response body is not an object: ${JSON.stringify(result.body)}`);
  }
  for (const key of ['success', 'code', 'message', 'timestamp']) {
    if (!(key in result.body)) {
      throw new Error(`Response envelope missing "${key}": ${JSON.stringify(result.body)}`);
    }
  }
}

/**
 * Fails the run once, with an actionable message, rather than letting every test time out
 * separately when the stack is not running.
 */
export async function assertStackReachable() {
  const checks = [
    [`${API_BASE}/actuator/health`, 'backend API'],
    [`${MAILPIT_BASE}/api/v1/messages?limit=1`, 'Mailpit'],
  ];

  for (const [url, label] of checks) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
    } catch (error) {
      throw new Error(
        `Live tests require the local stack. ${label} at ${url} is unreachable (${error instanceof Error ? error.message : String(error)}). ` +
          `Start it with: cd backend && docker compose up -d && ./mvnw spring-boot:run`,
        { cause: error }
      );
    }
  }
}
