import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { STALE_TIME } from '@/config/constants';

import { hiddenWordsApi } from '../api/hiddenWords';
import { getNextPageParam, panelQueryRetry } from '../lib/pagination';

const PAGE_LIMIT = 20;

/**
 * The platform-wide hidden words as an infinite cursor list. Administrator only.
 *
 * The query key is `['admin', 'hiddenWords', q]`, so a new search term starts a fresh cursor
 * sequence. A create, edit or delete invalidates it through `useHiddenWordActions`.
 *
 * @param q the debounced search term, or '' for the unfiltered list
 */
export function useHiddenWordList(q: string) {
  const query = useInfiniteQuery({
    queryKey: ['admin', 'hiddenWords', q],
    queryFn: ({ pageParam }) => hiddenWordsApi.list({ q, cursor: pageParam, limit: PAGE_LIMIT }),
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

// Every change writes an audit row whose reason is mandatory, so a blank one is refused before
// the request instead of costing a round trip to learn it.
const requireReason = (reason: string) => {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error('a reason is required');
  }
  return trimmed;
};

/**
 * Create, edit and delete for the hidden word list. Each requires a non-blank reason, which the
 * backend records on the audit row, and each invalidates the list queries and the action log so
 * the change and its audit entry appear without a reload. None auto-retries.
 */
export function useHiddenWordActions() {
  const queryClient = useQueryClient();

  const afterAction = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'hiddenWords'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'actions'] });
  };

  const create = useMutation({
    mutationFn: ({ phrase, reason }: { phrase: string; reason: string }) =>
      hiddenWordsApi.create({ phrase, reason: requireReason(reason) }),
    onSuccess: afterAction,
  });
  const update = useMutation({
    mutationFn: ({ id, phrase, reason }: { id: string; phrase: string; reason: string }) =>
      hiddenWordsApi.update(id, { phrase, reason: requireReason(reason) }),
    onSuccess: afterAction,
  });
  const remove = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      hiddenWordsApi.remove(id, { reason: requireReason(reason) }),
    onSuccess: afterAction,
  });

  return { create, update, remove };
}
