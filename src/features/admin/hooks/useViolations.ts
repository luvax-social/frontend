import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/useAuthStore';
import { STALE_TIME } from '@/config/constants';

import { adminApi } from '../api/adminApi';
import { getNextPageParam, listQueryKey, panelQueryRetry } from '../lib/pagination';

const PAGE_LIMIT = 20;

/**
 * An account's violation history as an infinite cursor list.
 *
 * The query key includes the caller's role because the result set and the
 * cursor are both role-scoped: a moderator sees warnings only and an
 * administrator sees warnings and strikes, and a cursor issued to one role
 * returns INVALID_CURSOR if replayed by the other. Keying on the role means the
 * panel never issues a cross-role cursor, so that error never surfaces.
 *
 * Rows are a discriminated union on `kind`; the caller renders by branching on
 * `kind`, never on the presence of a field.
 *
 * The cursor is scoped on `includeRevoked` as well as on the role: a cursor
 * issued by one setting of the flag is rejected by the other with
 * INVALID_CURSOR. The flag is therefore part of the query key, so flipping the
 * toggle starts a fresh sequence instead of replaying a cursor the other
 * listing will refuse.
 *
 * @param {string} userId the account whose history to read
 * @param {boolean} includeRevoked whether revoked records are listed too;
 *   false by default, matching the server
 */
export function useViolations(userId: string | null | undefined, includeRevoked = false) {
  const role = useAuthStore((state) => state.role);

  const query = useInfiniteQuery({
    queryKey: listQueryKey('violations', role, {
      userId: userId ?? null,
      includeRevoked: Boolean(includeRevoked),
    }),
    queryFn: ({ pageParam }) =>
      adminApi.getViolations({
        userId,
        cursor: pageParam,
        limit: PAGE_LIMIT,
        // Sent only when true: false is the server's own default and the
        // request contract carries no redundant keys.
        includeRevoked: includeRevoked ? true : undefined,
      }),
    initialPageParam: undefined as string | null | undefined,
    getNextPageParam,
    retry: panelQueryRetry,
    enabled: Boolean(userId),
    staleTime: STALE_TIME.SHORT,
  });

  const rows = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page?.content ?? []),
    [query.data]
  );

  return {
    rows,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: Boolean(query.hasNextPage),
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}

/** The query-key prefix a mutation invalidates to refetch a user's history. */
export const violationsKeyPrefix = (
  role: string | null | undefined,
  userId: string | null | undefined
) => listQueryKey('violations', role, { userId: userId ?? null });
