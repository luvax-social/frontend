import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/useAuthStore';

import { adminApi } from '../api/adminApi';
import { panelQueryRetry } from '../lib/pagination';

/**
 * Which session the caller is signed in with.
 *
 * This exists for one purpose: marking the reader's own row in an account's
 * session list. The administrative session payload carries no per-row marker,
 * and one must not be invented — the `jti` on an access token is unique per
 * token rather than per session, and the refresh cookie is scoped to
 * `/api/v1/auth` so it never reaches the administrative tree. Correlating this
 * endpoint's `sessionId` against `row.id` is the only mechanism there is.
 *
 * `POST /api/v1/auth/session` answers `{ sessionId: null }` with a 200 whenever
 * the request carried no usable refresh token — including a token a later login
 * has rotated. Null therefore means **"cannot be determined"**, never "you have
 * no session", and the caller renders no marker at all rather than guessing.
 * That is why this returns `isKnown` separately from the id: a screen must be
 * able to say "not determined" instead of quietly marking nothing and letting a
 * reviewer read the absence as "none of these is mine".
 *
 * The refresh token lives in memory in the auth store and is never persisted, so
 * this is re-asked once per session of the panel and cached for the rest of it.
 */
export function useCurrentSession() {
  const refreshToken = useAuthStore((state) => state.refreshToken);

  const query = useQuery({
    queryKey: ['admin', 'current-session'],
    queryFn: () => adminApi.getCurrentSession(refreshToken),
    enabled: Boolean(refreshToken),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: panelQueryRetry,
    select: (data) => data?.sessionId ?? null,
  });

  return {
    /** The caller's session id, or null when it could not be determined. */
    sessionId: query.data ?? null,
    /** True only when the server actually named a session. */
    isKnown: query.isSuccess && Boolean(query.data),
    isLoading: query.isLoading,
  };
}
