import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import {
  invalidatePostAffectedQueries,
  POST_AFFECTED_KEYS,
} from '@/features/luvax/utils/postCacheKeys';

describe('invalidatePostAffectedQueries', () => {
  it('invalidates every post list, profile count, place, drafts and archive key', async () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await invalidatePostAffectedQueries(queryClient);

    const keys = spy.mock.calls.map(([filters]) => filters?.queryKey);
    for (const expected of [
      ['feed'],
      ['recommendedFeed'],
      ['userPosts'],
      ['savedPosts'],
      ['likedPosts'],
      ['hashtag'],
      ['exploreSearch'],
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
    ]) {
      expect(keys).toContainEqual(expected);
    }
    expect(keys).toHaveLength(POST_AFFECTED_KEYS.length);
  });

  it('also invalidates the detail query of the post that changed', async () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await invalidatePostAffectedQueries(queryClient, 'post-1');

    expect(spy.mock.calls.map(([filters]) => filters?.queryKey)).toContainEqual(['post', 'post-1']);
  });

  it('marks a cached drafts query stale', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['drafts', 'list'], { content: [] });

    await invalidatePostAffectedQueries(queryClient);

    expect(queryClient.getQueryState(['drafts', 'list'])?.isInvalidated).toBe(true);
  });
});
