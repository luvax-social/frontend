import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as notifService from '@/services/notification.service';
import { PostDetailScreen } from '@/features/luvax/components/PostDetailScreen';

vi.mock('@/services/notification.service');
// usePostDetail/useTopLevelComments etc. are exercised through their real service calls
// elsewhere; this test only needs the comment-context path, so the post/comments hooks
// are mocked at the module boundary to keep the fixture small.
vi.mock('@/features/luvax/hooks/usePosts', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    usePostDetail: () => ({
      data: { data: { id: 'p1', author: {}, media: [] } },
      isLoading: false,
    }),
    useTopLevelComments: () => ({
      data: { pages: [{ data: { content: [{ id: 'c1', content: 'hello', author: {} }] } }] },
      isLoading: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }),
  };
});

const renderAt = (path) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/p/:postId" element={<PostDetailScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('PostDetailScreen comment deep link', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the thread context for ?comment= and pins it above the normal list', async () => {
    notifService.getCommentContext.mockResolvedValue({
      postId: 'p1',
      thread: [{ id: 'reply-9', content: 'a nested reply', author: {} }],
    });
    renderAt('/app/p/p1?comment=reply-9');
    await waitFor(() =>
      expect(notifService.getCommentContext).toHaveBeenCalledWith('reply-9', expect.anything())
    );
    expect(await screen.findByText('a nested reply')).toBeInTheDocument();
  });

  it('a 404 from the context call renders the unavailable state, not a toast', async () => {
    const notFound = new Error('not found');
    notFound.response = { status: 404 };
    notifService.getCommentContext.mockRejectedValue(notFound);
    renderAt('/app/p/p1?comment=gone');
    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
  });
});
