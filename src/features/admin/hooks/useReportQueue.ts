import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/useAuthStore';
import { STALE_TIME } from '@/config/constants';

import { adminApi } from '../api/adminApi';
import { getNextPageParam, listQueryKey, panelQueryRetry } from '../lib/pagination';

const PAGE_LIMIT = 20;

/**
 * The report queue as an infinite cursor list. The query key includes the
 * caller's role and both filters, so a filter change or a role change starts a
 * fresh sequence and never replays a cursor that no longer applies. The role is
 * part of the key because this endpoint returns a different result set to a
 * moderator than to an administrator.
 *
 * @param {{status?: string, reportType?: string}} filters
 */
export function useReportQueue(filters: { status?: string; reportType?: string } = {}) {
  const role = useAuthStore((state) => state.role);
  const status = filters.status || undefined;
  const reportType = filters.reportType || undefined;

  const query = useInfiniteQuery({
    queryKey: listQueryKey('reports', role, {
      status: status ?? null,
      reportType: reportType ?? null,
    }),
    queryFn: ({ pageParam }) =>
      adminApi.getReports({ status, reportType, cursor: pageParam, limit: PAGE_LIMIT }),
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
