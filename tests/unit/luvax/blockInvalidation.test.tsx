import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';

import { useBlock, useUnblock } from '@/features/luvax/hooks/useSocial';
import * as socialService from '@/services/social.service';

vi.mock('@/services/social.service');

const social = vi.mocked(socialService);

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const reset = vi.spyOn(queryClient, 'resetQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, reset, wrapper };
};

const touched = (spy: ReturnType<typeof setup>['invalidate']) =>
  spy.mock.calls.map(([filter]) => JSON.stringify(filter?.queryKey));

// Every cache that can list an account other than the feeds the block already resets.
const SURFACES = [
  ['storyFeed'],
  ['trendingPreviews'],
  ['suggestions'],
  ['search'],
  ['hashtag'],
].map((key) => JSON.stringify(key));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('block and unblock cache invalidation', () => {
  it('blocking refreshes the story tray, discovery, suggestions, search and hashtag caches', async () => {
    social.blockUser.mockResolvedValue({
      success: true,
      code: 'OK',
      message: 'ok',
      data: null,
      timestamp: '',
    });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useBlock(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('u1');
    });

    expect(touched(invalidate)).toEqual(expect.arrayContaining(SURFACES));
  });

  it('blocking still resets the feeds and refreshes the lists it did before', async () => {
    social.blockUser.mockResolvedValue({
      success: true,
      code: 'OK',
      message: 'ok',
      data: null,
      timestamp: '',
    });
    const { invalidate, reset, wrapper } = setup();
    const { result } = renderHook(() => useBlock(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('u1');
    });

    expect(touched(invalidate)).toEqual(
      expect.arrayContaining(
        [['social', 'blocked'], ['users'], ['post']].map((key) => JSON.stringify(key))
      )
    );
    expect(touched(reset)).toEqual(
      expect.arrayContaining(
        [['feed'], ['recommendedFeed'], ['explore'], ['userPosts']].map((key) =>
          JSON.stringify(key)
        )
      )
    );
  });

  it('unblocking refreshes the same caches, so the account can come back everywhere', async () => {
    social.unblockUser.mockResolvedValue({
      success: true,
      code: 'OK',
      message: 'ok',
      data: null,
      timestamp: '',
    });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useUnblock(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('u1');
    });

    expect(touched(invalidate)).toEqual(
      expect.arrayContaining([...SURFACES, JSON.stringify(['social', 'blocked'])])
    );
  });

  it('does not refresh any of them when the request fails', async () => {
    social.blockUser.mockRejectedValue(new Error('boom'));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useBlock(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('u1').catch(() => undefined);
    });

    expect(touched(invalidate)).toEqual([]);
  });
});
