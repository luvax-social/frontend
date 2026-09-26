import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { STALE_TIME } from '@/config/constants';
import { hashtagService } from '@/services/hashtag.service';
import { getNextCursor } from '@/utils/helpers';

export const hashtagKeys = {
  all: ['hashtag'],
  detail: (name) => [...hashtagKeys.all, 'detail', name],
  posts: (hashtagId) => [...hashtagKeys.all, 'posts', hashtagId],
  trending: (scope, size) => [...hashtagKeys.all, 'trending', scope, size],
};

/**
 * Resolves a hashtag name to its record.
 *
 * A 404 is a real answer here, not a transport failure, so it is never retried: the hashtag either
 * does not exist or is out of circulation, and retrying cannot change either. The screen reads the
 * error code to tell those two states apart from a hashtag that exists with no posts.
 * @param {string} name - Hashtag name from the route.
 * @returns {import('@tanstack/react-query').UseQueryResult} The query result.
 */
export function useHashtagDetail(name) {
  return useQuery({
    queryKey: hashtagKeys.detail(name),
    queryFn: ({ signal }) => hashtagService.getHashtagByName(name, signal),
    enabled: Boolean(name),
    staleTime: STALE_TIME.MEDIUM,
    retry: (failureCount, error) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

/**
 * Pages the posts carrying a hashtag.
 *
 * Disabled until the name lookup has produced an id, so a hashtag that turned out to be
 * unavailable never issues a posts request that would answer the same 404 a second time.
 * @param {string|undefined} hashtagId - Identifier from {@link useHashtagDetail}.
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult} The infinite query result.
 */
export function useHashtagPosts(hashtagId) {
  return useInfiniteQuery({
    queryKey: hashtagKeys.posts(hashtagId),
    queryFn: ({ pageParam, signal }) =>
      hashtagService.getPostsByHashtag(hashtagId, pageParam, undefined, signal),
    initialPageParam: null,
    getNextPageParam: getNextCursor,
    enabled: Boolean(hashtagId),
    staleTime: STALE_TIME.SHORT,
  });
}

/**
 * Reads one of the two trending surfaces.
 *
 * Both answer the same shape, so the caller passes a scope rather than choosing a hook.
 * @param {'platform'|'for-you'} scope - Which surface to read.
 * @param {number} [size] - Page size.
 * @param {boolean} [enabled] - Whether to issue the request at all.
 * @returns {import('@tanstack/react-query').UseQueryResult} The query result.
 */
export function useTrendingHashtags(scope, size = 10, enabled = true) {
  return useQuery({
    queryKey: hashtagKeys.trending(scope, size),
    queryFn: ({ signal }) =>
      scope === 'for-you'
        ? hashtagService.getTrendingForYou(size, signal)
        : hashtagService.getTrending(size, signal),
    enabled,
    // Both surfaces are periodic snapshots behind scheduled jobs, and the personalised one is
    // additionally cached server-side for ten minutes, so a shorter client stale time would
    // re-request data that cannot have changed.
    staleTime: STALE_TIME.MEDIUM,
  });
}
