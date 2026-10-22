import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Every cached query that can show a post, a post count or a post's author line.
 *
 * Keyed by prefix, so each parameter variant a screen currently holds is reached. The list is
 * the single place that knows which screens depend on a post's lifecycle; a new screen that
 * renders posts adds its key here instead of every publishing mutation learning about it.
 */
export const POST_AFFECTED_KEYS: readonly QueryKey[] = [
  ['feed'],
  ['recommendedFeed'],
  ['explore'],
  ['exploreSearch'],
  ['userPosts'],
  ['savedPosts'],
  ['likedPosts'],
  ['hashtag'],
  ['search'],
  ['suggestions'],
  ['storyFeed'],
  ['trendingPreviews'],
  ['users', 'profile'],
  ['users', 'me'],
  ['place'],
  ['taggedPosts'],
  ['drafts'],
  ['archive'],
  ['notifications'],
];

/**
 * Invalidates everything a publishing or unpublishing mutation can change.
 *
 * Publishing, scheduling, archiving, unarchiving, deleting and changing who co-authors a post all
 * move it between lists and change the post counts on profiles, so they call this one helper
 * rather than each naming a subset and leaving a stale screen behind.
 *
 * @param queryClient the client holding the cache
 * @param postId the post that changed, when one did; its detail query is invalidated as well
 */
export const invalidatePostAffectedQueries = (
  queryClient: QueryClient,
  postId?: string | null
): Promise<unknown> => {
  const keys = postId ? [...POST_AFFECTED_KEYS, ['post', postId]] : POST_AFFECTED_KEYS;
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
};
