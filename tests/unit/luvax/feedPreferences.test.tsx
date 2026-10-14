import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { DismissedPostRow } from '@/features/luvax/components/feed/DismissedPostRow';
import { FeedInjectedList } from '@/features/luvax/components/FeedScreen';
import { useNotInterested, useShowFewer } from '@/features/luvax/hooks/useFeedPreferences';
import {
  useDismissedPostsStore,
  type PostDismissal,
} from '@/features/luvax/store/useDismissedPostsStore';
import * as feedbackService from '@/services/postFeedback.service';
import * as safetyService from '@/services/safety.service';
import { postFixture } from '../../fixtures/domain';

vi.mock('@/services/postFeedback.service');
vi.mock('@/services/safety.service');
vi.mock('@/features/luvax/components/PostCard', () => ({
  PostCard: ({ post, feedSurface }: { post: { id: string }; feedSurface?: string }) => (
    <div data-testid={`post-${post.id}`} data-surface={feedSurface} />
  ),
}));

const feedback = vi.mocked(feedbackService);
const safety = vi.mocked(safetyService);

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

const setup = () => {
  const queryClient = makeClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, invalidate, wrapper };
};

const dismissalOf = (postId: string) => useDismissedPostsStore.getState().byPostId[postId];

const hidden: PostDismissal = { kind: 'not-interested', authorId: 'a1', authorHandle: 'minh.tran' };
const fewer: PostDismissal = { kind: 'show-fewer', authorId: 'a1', authorHandle: 'minh.tran' };

const invalidatedKeys = (invalidate: ReturnType<typeof setup>['invalidate']) =>
  invalidate.mock.calls.map(([filter]) => filter?.queryKey);

beforeEach(() => {
  vi.resetAllMocks();
  useDismissedPostsStore.setState({ byPostId: {} });
});

describe('useNotInterested', () => {
  it('hides the post at once and sends the signal', async () => {
    let finish: () => void = () => {};
    feedback.markNotInterested.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    const { wrapper } = setup();
    const { result } = renderHook(() => useNotInterested(), { wrapper });

    act(() => {
      result.current.apply.mutate({ postId: 'p1', authorId: 'a1', authorHandle: 'minh.tran' });
    });

    await waitFor(() => expect(dismissalOf('p1')).toEqual(hidden));
    expect(feedback.markNotInterested).toHaveBeenCalledWith('p1');
    await act(async () => finish());
  });

  it('marks the feed and both recommendation lists stale without refetching them', async () => {
    feedback.markNotInterested.mockResolvedValue(undefined);
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useNotInterested(), { wrapper });

    await act(async () => {
      await result.current.apply.mutateAsync({
        postId: 'p1',
        authorId: 'a1',
        authorHandle: 'minh.tran',
      });
    });

    expect(invalidatedKeys(invalidate)).toEqual([
      ['feed'],
      ['recommendedFeed', false],
      ['recommendedFeed', true],
    ]);
    // A refetch would drop the post and its undo row from the list before the viewer could undo.
    invalidate.mock.calls.forEach(([filter]) => expect(filter?.refetchType).toBe('none'));
  });

  it('restores the snapshot taken before the change when the request fails', async () => {
    feedback.markNotInterested.mockRejectedValue(new Error('boom'));
    const onError = vi.fn();
    const { wrapper } = setup();
    const { result } = renderHook(() => useNotInterested({ onError }), { wrapper });

    await act(async () => {
      await result.current.apply
        .mutateAsync({ postId: 'p1', authorId: 'a1', authorHandle: 'minh.tran' })
        .catch(() => undefined);
    });

    expect(dismissalOf('p1')).toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('undo clears the dismissal, deletes the signal and marks the same keys stale', async () => {
    useDismissedPostsStore.setState({ byPostId: { p1: hidden } });
    feedback.undoNotInterested.mockResolvedValue(undefined);
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useNotInterested(), { wrapper });

    await act(async () => {
      await result.current.undo.mutateAsync({ postId: 'p1' });
    });

    expect(feedback.undoNotInterested).toHaveBeenCalledWith('p1');
    expect(dismissalOf('p1')).toBeUndefined();
    expect(invalidatedKeys(invalidate)).toEqual([
      ['feed'],
      ['recommendedFeed', false],
      ['recommendedFeed', true],
    ]);
  });

  it('keeps the row when the undo request fails', async () => {
    useDismissedPostsStore.setState({ byPostId: { p1: hidden } });
    feedback.undoNotInterested.mockRejectedValue(new Error('boom'));
    const { wrapper } = setup();
    const { result } = renderHook(() => useNotInterested(), { wrapper });

    await act(async () => {
      await result.current.undo.mutateAsync({ postId: 'p1' }).catch(() => undefined);
    });

    expect(dismissalOf('p1')).toEqual(hidden);
  });
});

describe('useShowFewer', () => {
  it('records a show fewer dismissal and posts the author id', async () => {
    safety.showFewer.mockResolvedValue(undefined);
    const { wrapper } = setup();
    const { result } = renderHook(() => useShowFewer(), { wrapper });

    await act(async () => {
      await result.current.apply.mutateAsync({
        postId: 'p1',
        authorId: 'a1',
        authorHandle: 'minh.tran',
      });
    });

    expect(safety.showFewer).toHaveBeenCalledWith('a1');
    expect(dismissalOf('p1')).toEqual(fewer);
  });

  it('marks only the two recommendation lists stale, never the following feed', async () => {
    safety.showFewer.mockResolvedValue(undefined);
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useShowFewer(), { wrapper });

    await act(async () => {
      await result.current.apply.mutateAsync({
        postId: 'p1',
        authorId: 'a1',
        authorHandle: 'minh.tran',
      });
    });

    expect(invalidatedKeys(invalidate)).toEqual([
      ['recommendedFeed', false],
      ['recommendedFeed', true],
    ]);
    invalidate.mock.calls.forEach(([filter]) => expect(filter?.refetchType).toBe('none'));
  });

  it('restores the snapshot when the request fails', async () => {
    safety.showFewer.mockRejectedValue(new Error('boom'));
    const { wrapper } = setup();
    const { result } = renderHook(() => useShowFewer(), { wrapper });

    await act(async () => {
      await result.current.apply
        .mutateAsync({ postId: 'p1', authorId: 'a1', authorHandle: 'minh.tran' })
        .catch(() => undefined);
    });

    expect(dismissalOf('p1')).toBeUndefined();
  });

  it('undo deletes show fewer for the author and clears the dismissal', async () => {
    useDismissedPostsStore.setState({ byPostId: { p1: fewer } });
    safety.undoShowFewer.mockResolvedValue(undefined);
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useShowFewer(), { wrapper });

    await act(async () => {
      await result.current.undo.mutateAsync({ postId: 'p1', authorId: 'a1' });
    });

    expect(safety.undoShowFewer).toHaveBeenCalledWith('a1');
    expect(dismissalOf('p1')).toBeUndefined();
    expect(invalidatedKeys(invalidate)).toEqual([
      ['recommendedFeed', false],
      ['recommendedFeed', true],
    ]);
  });
});

describe('DismissedPostRow', () => {
  const renderRow = (dismissal: PostDismissal) => {
    const { wrapper } = setup();
    return render(<DismissedPostRow postId="p1" dismissal={dismissal} />, { wrapper });
  };

  it('says the post is hidden and offers undo', () => {
    renderRow(hidden);
    expect(screen.getByText('post hidden')).toBeInTheDocument();
    expect(screen.getByText("We'll show you fewer posts like this.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'undo' })).toBeInTheDocument();
  });

  it('names the author and the surfaces it covers after show fewer', () => {
    renderRow(fewer);
    expect(screen.getByText("you'll see fewer posts from @minh.tran")).toBeInTheDocument();
    expect(
      screen.getByText("This only changes for you and explore. You'll still see them in following.")
    ).toBeInTheDocument();
  });

  it('undoing not interested deletes the signal and restores the card', async () => {
    useDismissedPostsStore.setState({ byPostId: { p1: hidden } });
    feedback.undoNotInterested.mockResolvedValue(undefined);
    renderRow(hidden);

    fireEvent.click(screen.getByRole('button', { name: 'undo' }));

    await waitFor(() => expect(dismissalOf('p1')).toBeUndefined());
    expect(feedback.undoNotInterested).toHaveBeenCalledWith('p1');
  });

  it('undoing show fewer deletes it for the author and restores the card', async () => {
    useDismissedPostsStore.setState({ byPostId: { p1: fewer } });
    safety.undoShowFewer.mockResolvedValue(undefined);
    renderRow(fewer);

    fireEvent.click(screen.getByRole('button', { name: 'undo' }));

    await waitFor(() => expect(dismissalOf('p1')).toBeUndefined());
    expect(safety.undoShowFewer).toHaveBeenCalledWith('a1');
  });

  it('keeps the row and says so when the undo is refused', async () => {
    useDismissedPostsStore.setState({ byPostId: { p1: hidden } });
    feedback.undoNotInterested.mockRejectedValue(new Error('boom'));
    renderRow(hidden);

    fireEvent.click(screen.getByRole('button', { name: 'undo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't undo that");
    expect(dismissalOf('p1')).toEqual(hidden);
  });
});

describe('FeedInjectedList dismissals', () => {
  const tweaks = { density: 'default', showTags: true, accent: 'ink', dark: false, font: 'sans' };
  const posts = [postFixture({ id: 'p1' }), postFixture({ id: 'p2' })];

  const renderList = (feedSurface: 'following' | 'for-you') => {
    const { wrapper: Query } = setup();
    return render(
      <Query>
        <MemoryRouter>
          <FeedInjectedList
            posts={posts}
            cards={{}}
            availability={{}}
            tweaks={tweaks as never}
            viewport="desktop"
            betweenPosts={56}
            feedSurface={feedSurface}
          />
        </MemoryRouter>
      </Query>
    );
  };

  it('replaces the card in place with the undo row and leaves its neighbours alone', () => {
    useDismissedPostsStore.setState({ byPostId: { p1: hidden } });
    renderList('for-you');

    expect(screen.queryByTestId('post-p1')).toBeNull();
    expect(screen.getByText('post hidden')).toBeInTheDocument();
    expect(screen.getByTestId('post-p2')).toBeInTheDocument();
  });

  it('shows the show fewer row on for you', () => {
    useDismissedPostsStore.setState({ byPostId: { p1: fewer } });
    renderList('for-you');

    expect(screen.queryByTestId('post-p1')).toBeNull();
    expect(screen.getByText("you'll see fewer posts from @minh.tran")).toBeInTheDocument();
  });

  it('keeps the card on following after show fewer, because following is unaffected', () => {
    useDismissedPostsStore.setState({ byPostId: { p1: fewer } });
    renderList('following');

    expect(screen.getByTestId('post-p1')).toBeInTheDocument();
    expect(screen.queryByText(/you'll see fewer posts/)).toBeNull();
  });

  it('hides a not interested post on following as well', () => {
    useDismissedPostsStore.setState({ byPostId: { p1: hidden } });
    renderList('following');

    expect(screen.queryByTestId('post-p1')).toBeNull();
    expect(screen.getByText('post hidden')).toBeInTheDocument();
  });

  it('passes the surface down to each card', () => {
    renderList('for-you');
    expect(screen.getByTestId('post-p2')).toHaveAttribute('data-surface', 'for-you');
  });
});
