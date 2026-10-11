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
 * The hashtag registry as an infinite cursor list. Administrator only. The only
 * declared filter is `status`; the query key carries it so a filter change
 * starts a fresh sequence.
 *
 * @param {{status?: string}} filters
 */
export function useHashtagList(filters: { status?: string } = {}) {
  const role = useAuthStore((state) => state.role);
  const status = filters.status || undefined;

  const query = useInfiniteQuery({
    queryKey: listQueryKey('hashtags', role, { status: status ?? null }),
    queryFn: ({ pageParam }) =>
      adminApi.getHashtags({ status, cursor: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: undefined as string | null | undefined,
    getNextPageParam,
    retry: panelQueryRetry,
    staleTime: STALE_TIME.SHORT,
  });

  const rows = useMemo(() => flatten(query), [query.data]);
  return surface(query, rows);
}

/**
 * Hashtag search as an infinite cursor list, under the same rate-limit
 * discipline as account search. Enabled only when `term` is a deliberate query
 * (gated upstream). An optional `status` narrows it.
 *
 * @param {string} term the debounced, length-checked term, or '' to idle
 * @param {{status?: string}} filters
 */
export function useHashtagSearch(term: string, filters: { status?: string } = {}) {
  const role = useAuthStore((state) => state.role);
  const status = filters.status || undefined;
  const active = Boolean(term);

  const query = useInfiniteQuery({
    queryKey: listQueryKey('hashtag-search', role, { q: term || null, status: status ?? null }),
    queryFn: ({ pageParam }) =>
      adminApi.searchHashtags({ q: term, status, cursor: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: undefined as string | null | undefined,
    getNextPageParam,
    enabled: active,
    retry: panelQueryRetry,
    staleTime: STALE_TIME.SHORT,
  });

  const rows = useMemo(() => flatten(query), [query.data]);
  return { ...surface(query, rows), active };
}
