import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ProfileScreen } from '@/features/luvax/components/ProfileScreen';
import { useMuteDialogStore } from '@/features/luvax/store/useMuteDialogStore';
import { postService } from '@/services/post.service';
import * as socialService from '@/services/social.service';
import * as userService from '@/services/user.service';
import { useAuthStore } from '@/store/useAuthStore';
import { profileFixture } from '../../fixtures/domain';
import { envelope } from './settings/settingsFixtures';
import { mutePage } from './settings/safetyFixtures';

vi.mock('@/services/user.service');
vi.mock('@/services/social.service');
vi.mock('@/services/post.service');
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}));

const users = vi.mocked(userService);
const social = vi.mocked(socialService);
const posts = vi.mocked(postService);

const renderProfile = (viewerId: string, blocking = false) => {
  useAuthStore.setState({
    user: { id: viewerId, username: 'viewer' },
    isAuthenticated: true,
  } as never);
  users.getUserProfile.mockResolvedValue(
    envelope(
      profileFixture({
        id: 'u1',
        username: 'an.pham',
        displayName: 'An Pham',
        viewerState: { ...profileFixture().viewerState, isBlocking: blocking },
      })
    )
  );
  social.getBlockedUsers.mockResolvedValue(mutePage([]) as never);
  posts.getUserPosts.mockResolvedValue({
    ...envelope({ content: [], pageInfo: { hasNextPage: false } }),
  } as never);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/u/u1']}>
        <Routes>
          <Route path="/app/u/:userId" element={<ProfileScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  vi.resetAllMocks();
  useMuteDialogStore.setState({ target: null });
});

describe('profile menu: mute', () => {
  it('opens the mute dialog for the account and hands it the menu button to return to', async () => {
    renderProfile('viewer');
    const trigger = await screen.findByRole('button', { name: 'more options for @an.pham' });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'mute @an.pham' }));

    const target = useMuteDialogStore.getState().target;
    expect(target?.user).toMatchObject({
      id: 'u1',
      username: 'an.pham',
      displayName: 'An Pham',
    });
    expect(target?.returnFocusTo).toBe(trigger);
  });

  it('leaves mute out while the account is blocked, because muting it would be refused', async () => {
    renderProfile('viewer', true);
    const trigger = await screen.findByRole('button', { name: 'more options for @an.pham' });

    fireEvent.click(trigger);

    expect(screen.getByRole('button', { name: 'unblock @an.pham' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'mute @an.pham' })).toBeNull();
  });

  it('offers no menu, so no mute, on the viewer’s own profile', async () => {
    renderProfile('u1');

    await screen.findByText('An Pham');
    expect(screen.queryByRole('button', { name: 'more options for @an.pham' })).toBeNull();
  });
});
