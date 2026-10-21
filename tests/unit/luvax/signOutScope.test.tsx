import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { MuteDialogHost } from '@/features/luvax/components/MuteDialog';
import { FeedInjectedList } from '@/features/luvax/components/FeedScreen';
import { useDismissedPostsStore } from '@/features/luvax/store/useDismissedPostsStore';
import { useMuteDialogStore } from '@/features/luvax/store/useMuteDialogStore';
import * as userService from '@/services/user.service';
import { useAuthStore } from '@/store/useAuthStore';
import { postFixture } from '../../fixtures/domain';

vi.mock('@/services/user.service');
vi.mock('@/features/luvax/components/PostCard', () => ({
  PostCard: ({ post }: { post: { id: string } }) => <div data-testid={`post-${post.id}`} />,
}));

const tweaks = { density: 'default', showTags: true, accent: 'ink', dark: false, font: 'sans' };

const signIn = (id: string) =>
  act(() => useAuthStore.setState({ user: { id, username: id }, isAuthenticated: true } as never));

const mount = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(
    <>
      <FeedInjectedList
        posts={[postFixture({ id: 'p1' })]}
        cards={{}}
        availability={{}}
        tweaks={tweaks as never}
        viewport="desktop"
        betweenPosts={56}
        feedSurface="for-you"
      />
      <MuteDialogHost />
    </>,
    { wrapper }
  );
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(userService.getUserProfile).mockReturnValue(new Promise(() => undefined));
  useAuthStore.setState({ user: null, isAuthenticated: false } as never);
  useDismissedPostsStore.setState({ byPostId: {} });
  useMuteDialogStore.setState({ target: null });
});

const dismissAsA = () => {
  signIn('user-a');
  act(() =>
    useDismissedPostsStore
      .getState()
      .set('p1', { kind: 'not-interested', authorId: 'x', authorHandle: 'x' })
  );
  act(() =>
    useMuteDialogStore.getState().open({
      user: { id: 'x', username: 'x', displayName: null, avatarUrl: null },
      returnFocusTo: null,
    })
  );
};

describe('state scoped to the signed-in account', () => {
  it('shows no dismissed row and no mute dialog after signing out', async () => {
    mount();
    dismissAsA();
    expect(screen.getByText('Post hidden')).toBeInTheDocument();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    act(() => useAuthStore.getState().logout());

    expect(screen.queryByText('Post hidden')).toBeNull();
    expect(screen.getByTestId('post-p1')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows none of the previous account when a different one signs in', () => {
    mount();
    dismissAsA();

    act(() => useAuthStore.getState().logout());
    signIn('user-b');

    expect(useDismissedPostsStore.getState().byPostId).toEqual({});
    expect(screen.queryByText('Post hidden')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clears them when the user changes without a sign-out in between', () => {
    mount();
    dismissAsA();

    signIn('user-b');

    expect(useDismissedPostsStore.getState().byPostId).toEqual({});
    expect(useMuteDialogStore.getState().target).toBeNull();
  });

  it('keeps them when the same account is refreshed', () => {
    mount();
    dismissAsA();

    signIn('user-a');

    expect(useDismissedPostsStore.getState().byPostId['p1']).toBeDefined();
    expect(useMuteDialogStore.getState().target).not.toBeNull();
  });
});
