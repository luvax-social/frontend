import type * as PostHooks from '@/features/luvax/hooks/usePosts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PostDetailScreen } from '@/features/luvax/components/PostDetailScreen';
import { useDismissedPostsStore } from '@/features/luvax/store/useDismissedPostsStore';
import * as feedbackService from '@/services/postFeedback.service';
import * as safetyService from '@/services/safety.service';
import { useAuthStore } from '@/store/useAuthStore';

vi.mock('@/services/post.service');
vi.mock('@/services/notification.service');
vi.mock('@/services/user.service');
vi.mock('@/services/social.service');
vi.mock('@/services/postFeedback.service');
vi.mock('@/services/safety.service');
vi.mock('@/services/realtime/stompConnection', () => ({
  subscribeTopic: () => () => undefined,
}));

vi.mock('@/features/luvax/hooks/usePosts', async (importOriginal) => {
  const actual = await importOriginal<typeof PostHooks>();
  return {
    ...actual,
    usePostDetail: () => ({
      data: {
        data: { id: 'p1', author: { id: 'author-1', username: 'linh.ng' }, media: [] },
      },
      isLoading: false,
      isError: false,
    }),
    useTopLevelComments: () => ({
      data: { pages: [{ data: { content: [] } }] },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }),
  };
});

const feedback = vi.mocked(feedbackService);
const safety = vi.mocked(safetyService);

type Surface = 'following' | 'for-you' | 'explore' | 'other';

const renderDetail = (options: { feedSurface?: Surface; owned?: boolean } = {}) => {
  useAuthStore.setState({
    user: { id: options.owned ? 'author-1' : 'viewer', username: 'viewer' },
    isAuthenticated: true,
  } as never);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          '/app',
          {
            pathname: '/app/p/p1',
            state: options.feedSurface ? { feedSurface: options.feedSurface } : undefined,
          },
        ]}
        initialIndex={1}
      >
        <Routes>
          <Route path="/app" element={<div>feed screen</div>} />
          <Route path="/app/p/:postId" element={<PostDetailScreen overlay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'post options' }));
};

const item = (name: string) => screen.queryByRole('button', { name });

beforeEach(() => {
  vi.resetAllMocks();
  useDismissedPostsStore.setState({ byPostId: {} });
});

describe('post detail menu: not interested and show fewer', () => {
  it('offers not interested on a post from another account', () => {
    renderDetail();

    expect(item('Not interested')).not.toBeNull();
  });

  it('offers neither on the viewer’s own post', () => {
    renderDetail({ feedSurface: 'for-you', owned: true });

    expect(item('Not interested')).toBeNull();
    expect(item('Show fewer from @linh.ng')).toBeNull();
  });

  it.each<[Surface | undefined, boolean]>([
    ['for-you', true],
    ['explore', true],
    ['following', false],
    ['other', false],
    [undefined, false],
  ])('show fewer when the post was opened from %s is present: %s', (feedSurface, present) => {
    renderDetail({ feedSurface });

    expect(Boolean(item('Show fewer from @linh.ng'))).toBe(present);
  });

  it('hides the post, sends the signal and closes the overlay', async () => {
    feedback.markNotInterested.mockResolvedValue(undefined);
    renderDetail({ feedSurface: 'following' });

    fireEvent.click(screen.getByRole('button', { name: 'Not interested' }));

    await waitFor(() => expect(feedback.markNotInterested).toHaveBeenCalledWith('p1'));
    expect(useDismissedPostsStore.getState().byPostId['p1']?.kind).toBe('not-interested');
    expect(await screen.findByText('feed screen')).toBeInTheDocument();
  });

  it('asks for fewer posts from the author and stays on the post', async () => {
    safety.showFewer.mockResolvedValue(undefined);
    renderDetail({ feedSurface: 'for-you' });

    fireEvent.click(screen.getByRole('button', { name: 'Show fewer from @linh.ng' }));

    await waitFor(() => expect(safety.showFewer).toHaveBeenCalledWith('author-1'));
    expect(screen.queryByText('feed screen')).toBeNull();
  });
});
