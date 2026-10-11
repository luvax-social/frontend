import type { InfiniteData } from '@tanstack/react-query';
import type { CursorPage } from '@/types/api';
import type { AdminPostSummaryResponse, AdminCommentSummaryResponse } from '@/types/admin';
import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { STALE_TIME } from '@/config/constants';

import { adminApi } from '../api/adminApi';
import { getNextPageParam, panelQueryRetry } from '../lib/pagination';

const PAGE_LIMIT = 20;

/**
 * One account's posts or comments as an infinite cursor list. The `kind`
 * selects the endpoint; both are two views of the same screen. The result is
 * not role-scoped (both roles see the same rows), so the role is not part of the
 * key. Removed content is included, distinguished by the row's `removed` flag.
 *
 * @param {string} userId the account whose content to read
 * @param {'posts'|'comments'} kind which endpoint to page
 */
export function useUserContent(userId: string | null | undefined, kind: 'posts' | 'comments') {
  const query = useInfiniteQuery<
    CursorPage<AdminPostSummaryResponse | AdminCommentSummaryResponse>,
    Error,
    InfiniteData<CursorPage<AdminPostSummaryResponse | AdminCommentSummaryResponse>>,
    readonly unknown[],
    string | null | undefined
  >({
    queryKey: ['admin', 'content', kind, userId],
    queryFn: ({ pageParam }) =>
      kind === 'posts'
        ? adminApi.getUserPosts({ userId, cursor: pageParam, limit: PAGE_LIMIT })
        : adminApi.getUserComments({ userId, cursor: pageParam, limit: PAGE_LIMIT }),
    initialPageParam: undefined as string | null | undefined,
    getNextPageParam,
    retry: panelQueryRetry,
    enabled: Boolean(userId) && (kind === 'posts' || kind === 'comments'),
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

/**
 * Remove and restore for an account's content. These call the same `adminApi`
 * functions the report detail's `useReportActions` calls — the API request is
 * the single copy, reused rather than duplicated. Only the cache invalidation
 * differs, because the account content lists are a different query than the
 * report queries. No `reportId` is sent here, because the action originates
 * from the account context rather than from a report.
 *
 * Post restore and comment restore are kept separate because their response
 * shapes differ: post restore carries a dropped-hashtag array, comment restore
 * does not (see `restoreOutcome`).
 *
 * @param {string} userId the account whose content lists to invalidate
 */
export function useContentModeration(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'content', 'posts', userId] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'content', 'comments', userId] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'actions'] });
  };

  const removePost = useMutation({
    mutationFn: ({ entityId, reason }: { entityId: string; reason: string }) =>
      adminApi.removePost(entityId, reason),
    onSuccess: invalidate,
  });
  const restorePost = useMutation({
    mutationFn: ({ entityId, reason }: { entityId: string; reason: string }) =>
      adminApi.restorePost(entityId, reason),
    onSuccess: invalidate,
  });
  const removeComment = useMutation({
    mutationFn: ({ entityId, reason }: { entityId: string; reason: string }) =>
      adminApi.removeComment(entityId, reason),
    onSuccess: invalidate,
  });
  const restoreComment = useMutation({
    mutationFn: ({ entityId, reason }: { entityId: string; reason: string }) =>
      adminApi.restoreComment(entityId, reason),
    onSuccess: invalidate,
  });

  return { removePost, restorePost, removeComment, restoreComment };
}
