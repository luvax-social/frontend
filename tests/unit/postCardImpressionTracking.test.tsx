import { postFixture, userSummary } from '../fixtures/domain';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const useImpressionTrackingMock = vi.fn();
vi.mock('@/hooks/useImpressionTracking', () => ({
  useImpressionTracking: (...args: unknown[]) => useImpressionTrackingMock(...args),
}));

const authState = { user: { id: 'viewer' }, isAuthenticated: true };
const useAuthStoreMock = <T,>(selector: (state: typeof authState) => T) => selector(authState);
useAuthStoreMock.getState = () => authState;
useAuthStoreMock.subscribe = () => () => {};
vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: useAuthStoreMock,
}));

const { PostCard } = await import('@/features/luvax/components/PostCard');

const post = postFixture({
  id: 'post-42',
  caption: 'hello',
  author: userSummary({ id: 'author-1', username: 'author' }),
  media: [],
});

function renderPostCard(surface: 'feed' | 'explore' | 'search' | undefined) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PostCard post={post} surface={surface} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PostCard impression tracking', () => {
  beforeEach(() => {
    useImpressionTrackingMock.mockReset().mockReturnValue({ ref: vi.fn() });
  });

  it('tracks with the feed surface when passed one', () => {
    renderPostCard('feed');
    expect(useImpressionTrackingMock).toHaveBeenCalledWith('post-42', 'feed');
  });

  it('passes undefined surface through unchanged when the caller specifies none', () => {
    renderPostCard(undefined);
    expect(useImpressionTrackingMock).toHaveBeenCalledWith('post-42', undefined);
  });
});
