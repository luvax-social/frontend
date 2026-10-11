import { getErrorCode, isRateLimited } from './errors';

/**
 * Cursor pagination for the panel's list queries.
 *
 * Every list endpoint uses the same keyset cursor page:
 * `{ content, pageInfo: { hasNextPage, endCursor, ... } }`.
 * The only correct termination signal is `pageInfo.hasNextPage` being false;
 * the final page usually still carries items and a non-null `endCursor`.
 */

/**
 * The `getNextPageParam` for TanStack `useInfiniteQuery`. Returns the next
 * cursor only while `hasNextPage` is true, and `undefined` (which stops the
 * query) otherwise. Never returns null, and never inspects page length.
 */
export const getNextPageParam = (
  lastPage: { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } } | null | undefined
) => {
  const info = lastPage?.pageInfo;
  return info?.hasNextPage ? info.endCursor : undefined;
};

/**
 * Retry policy for panel queries. Never retries a 429, because a burst would
 * become a longer burst, and never retries a stale cursor, which is recovered
 * by restarting pagination rather than by retrying the same request. Otherwise
 * allows a single retry, matching the application's default.
 */
export const panelQueryRetry = (failureCount: number, error: unknown) => {
  if (isRateLimited(error)) {
    return false;
  }
  if (getErrorCode(error) === 'INVALID_CURSOR') {
    return false;
  }
  return failureCount < 1;
};

/**
 * Builds a stable query key for a cursor list. The key includes the endpoint
 * name, the caller's role, and every filter value, so changing a filter or a
 * role starts a fresh sequence rather than replaying a cursor that no longer
 * applies. The role is included because at least one list endpoint, the report
 * queue, returns a different result set to a moderator than to an
 * administrator.
 *
 * @param {string} endpoint a short, unique endpoint label
 * @param {string|null} role the caller's normalised role
 * @param {Object} filters the filter values, serialised into the key
 */
export const listQueryKey = (
  endpoint: string,
  role: string | null | undefined,
  filters: Record<string, unknown> = {}
) => ['admin', endpoint, role ?? 'anon', filters];
