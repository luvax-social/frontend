import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useDismissedPostsStore } from '@/features/luvax/store/useDismissedPostsStore';
import { postFixture, userSummary } from '../../fixtures/domain';

vi.mock('@/hooks/useImpressionTracking', () => ({
  useImpressionTracking: () => ({ ref: vi.fn() }),
}));
vi.mock('@/hooks/useRateLimitCooldown', () => ({
  useRateLimitCooldown: () => ({ cooling: false, remaining: 0, start: vi.fn() }),
}));
const getMock = vi.fn();
vi.mock('@/services/axiosInstance', () => ({
  default: { get: (...args: unknown[]) => getMock(...args) },
}));

const { RecommendedPostsGrid } = await import('@/features/luvax/components/RecommendedPostsGrid');

const post = (id: string) =>
  postFixture({
    id,
    caption: `caption of ${id}`,
    author: userSummary({ id: 'a1', username: 'a1' }),
  });

const renderGrid = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<RecommendedPostsGrid surface="explore" />, { wrapper });
};

beforeEach(() => {
  getMock.mockReset().mockResolvedValue({
    data: { data: { content: [post('p1'), post('p2')], pageInfo: { hasNextPage: false } } },
  });
  useDismissedPostsStore.setState({ byPostId: {} });
});

describe('explore grid and dismissed posts', () => {
  it('leaves a dismissed post out of the grid and keeps the rest', async () => {
    useDismissedPostsStore
      .getState()
      .set('p1', { kind: 'not-interested', authorId: 'a1', authorHandle: 'a1' });
    renderGrid();

    expect(await screen.findByText('caption of p2')).toBeInTheDocument();
    expect(screen.queryByText('caption of p1')).toBeNull();
  });

  it('leaves out a post the viewer asked to see fewer of, too', async () => {
    useDismissedPostsStore
      .getState()
      .set('p1', { kind: 'show-fewer', authorId: 'a1', authorHandle: 'a1' });
    renderGrid();

    await screen.findByText('caption of p2');
    expect(screen.queryByText('caption of p1')).toBeNull();
  });

  it('brings the tile back when the dismissal is undone', async () => {
    useDismissedPostsStore
      .getState()
      .set('p1', { kind: 'not-interested', authorId: 'a1', authorHandle: 'a1' });
    renderGrid();
    await screen.findByText('caption of p2');

    act(() => useDismissedPostsStore.getState().clear('p1'));

    expect(await screen.findByText('caption of p1')).toBeInTheDocument();
  });
});
