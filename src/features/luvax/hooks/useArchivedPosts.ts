import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { ApiResponse, CursorPage } from '@/types/api';
import type { PostResponse } from '@/types/domain';
import { STALE_TIME } from '@/config/constants';
import { postService } from '@/services/post.service';
import { getNextCursor } from '@/utils/helpers';

import { invalidatePostAffectedQueries } from '../utils/postCacheKeys';

type ArchiveCache = InfiniteData<ApiResponse<CursorPage<PostResponse>>>;

export const archiveKeys = {
  all: ['archive'],
  posts: () => ['archive', 'posts'],
};

/**
 * The viewer's archived posts, most recently updated first.
 *
 * Query key `['archive', 'posts']`. It sits under the `archive` prefix the shared post
 * invalidation clears, so archiving, unarchiving and deleting refresh it.
 */
export const useArchivedPosts = () =>
  useInfiniteQuery({
    queryKey: archiveKeys.posts(),
    queryFn: ({ pageParam = null, signal }) =>
      postService.getMyPosts({ status: 'archived', cursor: pageParam, limit: 12, signal }),
    getNextPageParam: getNextCursor,
    initialPageParam: null,
    staleTime: STALE_TIME.SHORT,
  });

/**
 * Moves a post out of the archive, or puts it back.
 *
 * Unarchiving removes the tile at once and restores the list to the snapshot taken in `onMutate`
 * if the server refuses, so the grid never claims a post is back on the profile when it is not.
 * The undo that follows a success calls the same mutation with `archived` as the target, which
 * returns the post to the archive; the original publication time is kept either way because the
 * backend never clears it.
 */
export const useUnarchivePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, target }: { postId: string; target: 'published' | 'archived' }) =>
      postService.updatePostStatus(postId, target),
    onMutate: async ({ postId, target }) => {
      if (target !== 'published') return { snapshot: undefined };
      await queryClient.cancelQueries({ queryKey: archiveKeys.all });
      const snapshot = queryClient.getQueryData<ArchiveCache>(archiveKeys.posts());
      queryClient.setQueryData<ArchiveCache | undefined>(archiveKeys.posts(), (cache) =>
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
          : cache
      );
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      // Rolls back to the snapshot taken in onMutate, so a refused unarchive leaves the tile where
      // it was instead of making the grid disagree with the server.
      if (context?.snapshot) queryClient.setQueryData(archiveKeys.posts(), context.snapshot);
    },
    onSettled: (_data, _error, variables) =>
      invalidatePostAffectedQueries(queryClient, variables.postId),
  });
};
