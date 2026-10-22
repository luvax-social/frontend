import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApiResponse, CursorPage } from '@/types/api';
import type { PostResponse, PostStatus } from '@/types/domain';
import { STALE_TIME } from '@/config/constants';
import { postService } from '@/services/post.service';
import { getNextCursor } from '@/utils/helpers';

import { invalidatePostAffectedQueries } from '../utils/postCacheKeys';

export type OwnerListStatus = 'draft' | 'scheduled' | 'archived';

type OwnerPostsCache = InfiniteData<ApiResponse<CursorPage<PostResponse>>>;

export const draftKeys = {
  all: ['drafts'],
  list: (status: OwnerListStatus) => ['drafts', 'list', status],
  counts: () => ['drafts', 'counts'],
};

/**
 * The viewer's own drafts or scheduled posts.
 *
 * Query key `['drafts', 'list', status]`. Drafts page by most recently updated and scheduled posts
 * by the time they are due, soonest first, as the backend orders them. Invalidated by
 * `invalidatePostAffectedQueries`, so publishing, scheduling and deleting refresh it.
 */
export const useOwnerPosts = (status: OwnerListStatus, { enabled = true } = {}) =>
  useInfiniteQuery({
    queryKey: draftKeys.list(status),
    queryFn: ({ pageParam = null, signal }) =>
      postService.getMyPosts({ status, cursor: pageParam, limit: 20, signal }),
    getNextPageParam: getNextCursor,
    initialPageParam: null,
    staleTime: STALE_TIME.SHORT,
    enabled,
  });

/**
 * How many drafts, scheduled posts and archived posts the viewer holds, and the cap the first two
 * share.
 *
 * Query key `['drafts', 'counts']`. The cap is the server's `max_drafts_and_scheduled_posts`
 * setting, so the limit shown is never a number the client chose.
 */
export const useMyPostCounts = ({ enabled = true } = {}) =>
  useQuery({
    queryKey: draftKeys.counts(),
    queryFn: ({ signal }) => postService.getMyPostCounts(signal),
    staleTime: STALE_TIME.SHORT,
    enabled,
  });

const withoutPost = (cache: OwnerPostsCache | undefined, postId: string) =>
  cache
    ? {
        ...cache,
        pages: cache.pages.map((page) => ({
          ...page,
          data: {
            ...page.data,
            content: page.data.content.filter((post) => post.id !== postId),
          },
        })),
      }
    : cache;

/**
 * Deletes a draft or a scheduled post.
 *
 * The row leaves every cached owner list at once. A refused delete restores each list to the
 * snapshot taken in `onMutate`; the counts and the drafts, scheduled and archive lists are then
 * refetched either way, so the number shown always comes from the server.
 */
export const useDeleteOwnedPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postService.deletePost(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: draftKeys.all });
      const snapshots = queryClient.getQueriesData<OwnerPostsCache>({
        queryKey: ['drafts', 'list'],
      });
      snapshots.forEach(([key, cache]) =>
        queryClient.setQueryData(key, withoutPost(cache, postId))
      );
      return { snapshots };
    },
    onError: (_error, _postId, context) => {
      // Rolls back to the snapshots taken in onMutate, so a refused delete leaves the row where it
      // was instead of making the list disagree with the server.
      context?.snapshots.forEach(([key, cache]) => queryClient.setQueryData(key, cache));
    },
    onSettled: (_data, _error, postId) => invalidatePostAffectedQueries(queryClient, postId),
  });
};

/**
 * Moves a post to another status: publish a draft or a scheduled post now, schedule a draft,
 * return a scheduled post to drafts, archive or unarchive.
 *
 * Every outcome moves the post between lists and changes the counts on profiles, so success
 * invalidates through the shared helper rather than naming a subset.
 */
export const useTransitionPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      status,
      scheduledAt,
    }: {
      postId: string;
      status: PostStatus;
      scheduledAt?: string | null;
    }) => postService.updatePostStatus(postId, status, scheduledAt),
    onSettled: (_data, _error, variables) =>
      invalidatePostAffectedQueries(queryClient, variables.postId),
  });
};
