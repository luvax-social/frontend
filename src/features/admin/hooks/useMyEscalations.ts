import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/useAuthStore';
import { STALE_TIME } from '@/config/constants';

import { adminApi } from '../api/adminApi';
import { getNextPageParam, listQueryKey, panelQueryRetry } from '../lib/pagination';

const PAGE_LIMIT = 20;

/**
 * The reports this caller escalated, as an infinite cursor list.
 *
 * This exists because escalating a report is the one moderation act whose
 * outcome a moderator otherwise loses sight of. A moderator's report queue
 * shows `pending` and `reviewing` only, and a closed report answers 404 to a
 * moderator — with the single exception of one it escalated itself, which is
 * what makes this list possible at all.
 *
 * **It carries no status filter, and that is the point.** A report an
 * administrator has since resolved or dismissed still appears here, because the
 * outcome is the thing the escalation was for. Adding a status filter would
 * hide exactly the rows the screen exists to show, so none is offered and none
 * is applied client-side.
 *
 * The role is in the query key like every other list, though this endpoint
 * scopes by caller rather than by role: an administrator calling it receives its
 * own escalations, not everyone's.
 */
export function useMyEscalations() {
  const role = useAuthStore((state) => state.role);

  const query = useInfiniteQuery({
    queryKey: listQueryKey('my-escalations', role, {}),
    queryFn: ({ pageParam }) => adminApi.getMyEscalations({ cursor: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: undefined as string | null | undefined,
    getNextPageParam,
    retry: panelQueryRetry,
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
