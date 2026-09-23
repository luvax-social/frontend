import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const getFeedMock = vi.fn();
const getRecommendedFeedMock = vi.fn();

vi.mock('@/services/post.service', () => ({
  postService: { getFeed: (...args) => getFeedMock(...args) },
}));
vi.mock('@/services/recommendation.service', () => ({
  recommendationService: { getRecommendedFeed: (...args) => getRecommendedFeedMock(...args) },
}));
vi.mock('@/features/luvax/hooks/useStories', () => ({
  useStoryFeed: () => ({ tray: [] }),
}));
vi.mock('@/features/luvax/LuvaxTweaksContext', () => ({
  useLuvaxTweaks: () => ({ tweaks: { density: 'cozy', showTags: true }, viewport: 'desktop' }),
}));
const authState = { user: { id: 'u1' }, isAuthenticated: true };
const useAuthStoreMock = (selector) => selector(authState);
useAuthStoreMock.getState = () => authState;
useAuthStoreMock.subscribe = () => () => {};
vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: useAuthStoreMock,
}));

const { FeedScreen } = await import('@/features/luvax/components/FeedScreen');

function renderFeedScreen(initialPath = '/app') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <FeedScreen />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('FeedScreen lazy tab fetching', () => {
  beforeEach(() => {
    getFeedMock.mockReset().mockResolvedValue({
      data: { content: [], nextCursor: null, pageInfo: { hasNextPage: false } },
    });
    getRecommendedFeedMock.mockReset().mockResolvedValue({
      data: { content: [], nextCursor: null, pageInfo: { hasNextPage: false } },
    });
  });

  it('fetches only the default (for-you) tab on mount, not both', async () => {
    renderFeedScreen('/app');
    await screen.findByText('nothing to show yet');
    expect(getRecommendedFeedMock).toHaveBeenCalledTimes(1);
    expect(getFeedMock).not.toHaveBeenCalled();
  });

  it('fetches the following tab lazily, only once it is first selected', async () => {
    renderFeedScreen('/app');
    await screen.findByText('nothing to show yet');
    expect(getFeedMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('following'));
    await screen.findByText('your feed is quiet');
    expect(getFeedMock).toHaveBeenCalledTimes(1);
  });

  it('does not refetch a tab that was already activated when switching back to it', async () => {
    renderFeedScreen('/app');
    await screen.findByText('nothing to show yet');

    fireEvent.click(screen.getByText('following'));
    await screen.findByText('your feed is quiet');
    expect(getFeedMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('for you'));
    fireEvent.click(screen.getByText('following'));
    expect(getFeedMock).toHaveBeenCalledTimes(1);
    expect(getRecommendedFeedMock).toHaveBeenCalledTimes(1);
  });

  it('fetches only the following tab on a cold load at ?tab=following', async () => {
    renderFeedScreen('/app?tab=following');
    await screen.findByText('your feed is quiet');
    expect(getFeedMock).toHaveBeenCalledTimes(1);
    expect(getRecommendedFeedMock).not.toHaveBeenCalled();
  });
});
