import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const getRecommendedFeedMock = vi.fn();
vi.mock('@/services/recommendation.service', () => ({
  recommendationService: {
    getRecommendedFeed: (...args: unknown[]) => getRecommendedFeedMock(...args),
  },
  getRecommendedFeed: (...args: unknown[]) => getRecommendedFeedMock(...args),
}));

const { useForYouFeed, useExplore } = await import('@/features/luvax/hooks/usePosts');

const wrapper = ({ children }: { children?: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
};

const page = (ids: string[], hasNextPage: boolean, endCursor?: string) => ({
  data: { content: ids.map((id) => ({ id })), pageInfo: { hasNextPage, endCursor } },
});

describe('useRecommendedFeed', () => {
  beforeEach(() => {
    getRecommendedFeedMock.mockReset();
  });

  it('passes excludeFollowed through to the service for the discovery variant', async () => {
    getRecommendedFeedMock.mockResolvedValue(page(['a'], false));
    const { result } = renderHook(() => useExplore(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRecommendedFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({ excludeFollowed: true })
    );
  });

  it('omits excludeFollowed for the for-you variant', async () => {
    getRecommendedFeedMock.mockResolvedValue(page(['a'], false));
    const { result } = renderHook(() => useForYouFeed(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRecommendedFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({ excludeFollowed: false })
    );
  });

  it('dedupes ids across pages in the returned data', async () => {
    getRecommendedFeedMock
      .mockResolvedValueOnce(page(['a', 'b'], true, 'c1'))
      .mockResolvedValueOnce(page(['b', 'c'], false));
    const { result, rerender } = renderHook(() => useForYouFeed(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    // TanStack Query's observer notification lands after `act`'s own flush in
    // this test harness; an explicit rerender picks up the settled state so
    // the following assertion reads it rather than a stale snapshot.
    rerender();
    await waitFor(() => expect(result.current.data!.pages).toHaveLength(2));
    const ids = result.current.data!.pages.flatMap((p) => p.data.content.map((r) => r.id));
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('does not retry on a 429', async () => {
    const err = { response: { status: 429, headers: {} }, isAxiosError: true };
    getRecommendedFeedMock.mockRejectedValue(err);
    const { result } = renderHook(() => useForYouFeed(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getRecommendedFeedMock).toHaveBeenCalledTimes(1);
  });
});
