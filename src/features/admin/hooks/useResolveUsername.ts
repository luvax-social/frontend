import { useQuery } from '@tanstack/react-query';

import { loadUserSummary } from '../lib/userSummaries';
import { panelQueryRetry } from '../lib/pagination';

/**
 * Resolves a single user id to a username.
 *
 * The caller still asks for one id, because one row knows about one person. The
 * request underneath is shared: every id asked for in the same tick is
 * coalesced by `lib/userSummaries` into one `GET /admin/user-summaries` call,
 * split at the server's hundred-id bound. A page of twenty rows referencing
 * five distinct people costs **one** request, not five.
 *
 * This replaced a per-id resolver that called the single-account content
 * endpoint once per id and cached each result. That mechanism is gone, not
 * disabled — there is one way to turn an id into a name and this is it.
 *
 * The cache key is still the user id, so a repeated id across a list is free
 * and React Query deduplicates concurrent askers. A username does not change
 * within a session, so an entry never goes stale.
 *
 * An id the server reports as not found settles as `null` rather than as an
 * error. That is a resolved answer: it is cached like any other, so the row
 * renders a shortened id once and is never retried in a loop.
 */
export function useResolveUsername(userId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['admin', 'user-summary', userId],
    queryFn: () => loadUserSummary(userId!),
    enabled: Boolean(userId),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: panelQueryRetry,
    select: (user) => user?.username ?? null,
  });

  return {
    username: query.data ?? null,
    isResolved: query.isSuccess,
    isLoading: query.isLoading,
    /** The server answered, and answered that there is no such account. */
    isUnknown: query.isSuccess && !query.data,
  };
}

/** A stable, honest short form of an id for use before a name resolves. */
export const shortId = (id: string | null | undefined) =>
  typeof id === 'string' && id.length >= 8 ? id.slice(0, 8) : (id ?? '');
