import type { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import type { CursorPage } from '@/types/api';
import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/useAuthStore';
import { STALE_TIME } from '@/config/constants';

import { adminApi } from '../api/adminApi';
import { getNextPageParam, listQueryKey, panelQueryRetry } from '../lib/pagination';

const PAGE_LIMIT = 20;

const flatten = <T, E>(query: UseInfiniteQueryResult<InfiniteData<CursorPage<T>>, E>) =>
  (query.data?.pages ?? []).flatMap((page) => page?.content ?? []);

const surface = <T, E>(
  query: UseInfiniteQueryResult<InfiniteData<CursorPage<T>>, E>,
  rows: T[]
) => ({
  rows,
  isLoading: query.isLoading,
  isError: query.isError,
  error: query.error,
  isFetchingNextPage: query.isFetchingNextPage,
  hasNextPage: Boolean(query.hasNextPage),
  fetchNextPage: query.fetchNextPage,
  refetch: query.refetch,
});

/**
 * The account list as an infinite cursor list. Administrator only. The only
 * filters are the two the endpoint declares, `status` and `role`; nothing is
 * filtered client-side. The query key carries both filters so changing one
 * starts a fresh sequence rather than replaying a cursor that no longer applies.
 *
 * @param {{status?: string, role?: string}} filters
 */
export function useAccountList(filters: { status?: string; role?: string } = {}) {
  const callerRole = useAuthStore((state) => state.role);
  const status = filters.status || undefined;
  const role = filters.role || undefined;

  const query = useInfiniteQuery({
    queryKey: listQueryKey('accounts', callerRole, { status: status ?? null, role: role ?? null }),
    queryFn: ({ pageParam }) =>
      adminApi.getUsers({ status, role, cursor: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: undefined as string | null | undefined,
    getNextPageParam,
    retry: panelQueryRetry,
    staleTime: STALE_TIME.SHORT,
  });

  const rows = useMemo(() => flatten(query), [query.data]);
  return surface(query, rows);
}

/**
 * Account search as an infinite cursor list. Enabled only when `term` is a
 * deliberate, valid query (the caller gates length and blankness upstream), so a
 * request never fires per keystroke or on a short query. Returns the same row
 * shape as the list, so one renderer serves both.
 *
 * @param {string} term the debounced, length-checked search term, or '' to idle
 */
export function useAccountSearch(term: string) {
  const callerRole = useAuthStore((state) => state.role);
  const active = Boolean(term);

  const query = useInfiniteQuery({
    queryKey: listQueryKey('account-search', callerRole, { q: term || null }),
    queryFn: ({ pageParam }) =>
      adminApi.searchUsers({ q: term, cursor: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: undefined as string | null | undefined,
    getNextPageParam,
    enabled: active,
    // A rate-limit refusal is never retried; the cooldown in useDebouncedSearch
    // is what governs when a search may run again.
    retry: panelQueryRetry,
    staleTime: STALE_TIME.SHORT,
  });

  const rows = useMemo(() => flatten(query), [query.data]);
  return { ...surface(query, rows), active };
}
