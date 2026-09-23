import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const useImpressionTrackingMock = vi.fn();
vi.mock('@/hooks/useImpressionTracking', () => ({
  useImpressionTracking: (...args) => {
    useImpressionTrackingMock(...args);
    return { ref: vi.fn() };
  },
}));

const getMock = vi.fn();
vi.mock('@/services/axiosInstance', () => ({ default: { get: (...args) => getMock(...args) } }));
vi.mock('@/hooks/useRateLimitCooldown', () => ({
  useRateLimitCooldown: () => ({ cooling: false, remaining: 0, start: vi.fn() }),
}));

const { RecommendedPostsGrid, SearchResultPost } =
  await import('@/features/luvax/components/RecommendedPostsGrid');

const post = { id: 'post-7', caption: 'x', tags: [], author: { id: 'a1', username: 'a1' } };

function withProviders(children) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RecommendedPostsGrid impression tracking', () => {
  beforeEach(() => {
    useImpressionTrackingMock.mockReset();
    getMock
      .mockReset()
      .mockResolvedValue({ data: { data: { content: [post], pageInfo: { hasNextPage: false } } } });
  });

  it('tracks each tile with the surface passed to the grid', async () => {
    render(withProviders(<RecommendedPostsGrid surface="explore" />));
    await waitFor(() =>
      expect(useImpressionTrackingMock).toHaveBeenCalledWith('post-7', 'explore')
    );
  });

  it('tracks with the search surface when rendered from Search', async () => {
    render(withProviders(<RecommendedPostsGrid surface="search" />));
    await waitFor(() => expect(useImpressionTrackingMock).toHaveBeenCalledWith('post-7', 'search'));
  });

  it('SearchResultPost stays untracked when no surface is passed', () => {
    render(withProviders(<SearchResultPost post={post} />));
    expect(useImpressionTrackingMock).toHaveBeenCalledWith('post-7', undefined);
  });
});
