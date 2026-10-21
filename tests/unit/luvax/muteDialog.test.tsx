import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MuteDialogHost } from '@/features/luvax/components/MuteDialog';
import { ToastHost } from '@/features/luvax/components/Toast';
import {
  useMuteDialogStore,
  type MuteDialogTarget,
} from '@/features/luvax/store/useMuteDialogStore';
import * as safetyService from '@/services/safety.service';
import * as userService from '@/services/user.service';
import type { ApiResponse } from '@/types/api';
import type { PublicUserProfileResponse } from '@/types/domain';
import { profileFixture } from '../../fixtures/domain';
import { apiError, envelope } from './settings/settingsFixtures';
import { muteFixture } from './settings/safetyFixtures';

vi.mock('@/services/safety.service');
vi.mock('@/services/user.service');

const safety = vi.mocked(safetyService);
const users = vi.mocked(userService);

const profileWith = (
  mutePosts: boolean,
  muteStories: boolean
): ApiResponse<PublicUserProfileResponse> =>
  envelope(
    profileFixture({
      id: 'u1',
      username: 'an.pham',
      viewerState: {
        isFollowing: false,
        isFollowRequested: false,
        isFollowedBy: false,
        isBlocking: false,
        hasReported: false,
        isMutingPosts: mutePosts,
        isMutingStories: muteStories,
        isShowingFewer: false,
      },
    })
  );

const target = (returnFocusTo: HTMLElement | null = null): MuteDialogTarget => ({
  user: { id: 'u1', username: 'an.pham', displayName: 'An Pham', avatarUrl: null },
  returnFocusTo,
});

function GoElsewhere() {
  const navigate = useNavigate();
  return (
    <button type="button" data-testid="go" onClick={() => navigate('/elsewhere')}>
      go
    </button>
  );
}

const renderHost = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(
    <MemoryRouter>
      <MuteDialogHost />
      <ToastHost />
      <GoElsewhere />
    </MemoryRouter>,
    { wrapper }
  );
};

const open = (returnFocusTo: HTMLElement | null = null) =>
  act(() => useMuteDialogStore.getState().open(target(returnFocusTo)));

const posts = () => screen.getByRole('switch', { name: 'posts' });
const stories = () => screen.getByRole('switch', { name: 'stories' });

beforeEach(() => {
  vi.resetAllMocks();
  useMuteDialogStore.setState({ target: null });
});

describe('MuteDialog', () => {
  it('renders nothing until a target is opened', () => {
    renderHost();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a loading state, never a guessed one, until the profile has answered', async () => {
    let answer: (value: ApiResponse<PublicUserProfileResponse>) => void = () => {};
    users.getUserProfile.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    renderHost();
    open();

    expect(await screen.findByRole('dialog', { name: 'mute @an.pham' })).toBeInTheDocument();
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();

    await act(async () => answer(profileWith(true, false)));

    await screen.findByRole('switch', { name: 'posts' });
    expect(posts()).toHaveAttribute('aria-checked', 'true');
    expect(stories()).toHaveAttribute('aria-checked', 'false');
    expect(users.getUserProfile).toHaveBeenCalledWith('u1');
  });

  it('says what muting does and does not do', async () => {
    users.getUserProfile.mockResolvedValue(profileWith(false, false));
    renderHost();
    open();

    await screen.findByRole('switch', { name: 'posts' });
    expect(screen.getByText("They won't know you muted them.")).toBeInTheDocument();
    expect(
      screen.getByText('Hide their posts from following, for you and explore.')
    ).toBeInTheDocument();
    expect(screen.getByText('Hide their stories from your story tray.')).toBeInTheDocument();
    expect(
      screen.getByText(
        "You'll still see their profile, comments and messages. You can change this in settings, under muted accounts."
      )
    ).toBeInTheDocument();
  });

  it('offers no toggles when the profile cannot be read', async () => {
    users.getUserProfile.mockRejectedValue(apiError('USER_NOT_FOUND', 404));
    renderHost();
    open();

    expect(
      await screen.findByText("We couldn't load this. Try again in a moment.")
    ).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('saves on change, sending both values with the untouched one as it stands', async () => {
    // A server that remembers what it was told, because saving reloads the profile it reads from.
    let stored = { mutePosts: false, muteStories: false };
    users.getUserProfile.mockImplementation(async () =>
      profileWith(stored.mutePosts, stored.muteStories)
    );
    safety.setMute.mockImplementation(async (_id, body) => {
      stored = body;
      return envelope(muteFixture('u1', 'an.pham', body.mutePosts, body.muteStories));
    });
    renderHost();
    open();
    await screen.findByRole('switch', { name: 'posts' });

    fireEvent.click(posts());
    await waitFor(() =>
      expect(safety.setMute).toHaveBeenLastCalledWith('u1', { mutePosts: true, muteStories: false })
    );

    // The second change reads the first from what is on screen, so it waits for the switch to show it.
    await waitFor(() => expect(posts()).toHaveAttribute('aria-checked', 'true'));
    fireEvent.click(stories());
    await waitFor(() =>
      expect(safety.setMute).toHaveBeenLastCalledWith('u1', { mutePosts: true, muteStories: true })
    );
    expect(posts()).toHaveAttribute('aria-checked', 'true');
    expect(stories()).toHaveAttribute('aria-checked', 'true');
  });

  it('puts the switch back and says so when the save is refused', async () => {
    users.getUserProfile.mockResolvedValue(profileWith(false, false));
    safety.setMute.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));
    renderHost();
    open();
    await screen.findByRole('switch', { name: 'posts' });

    fireEvent.click(posts());

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save that");
    await waitFor(() => expect(posts()).toHaveAttribute('aria-checked', 'false'));
  });

  it('closes on done', async () => {
    users.getUserProfile.mockResolvedValue(profileWith(false, false));
    renderHost();
    open();
    await screen.findByRole('switch', { name: 'posts' });

    fireEvent.click(screen.getByRole('button', { name: 'done' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useMuteDialogStore.getState().target).toBeNull();
  });

  it('closes on Escape and returns focus to the control that opened it', async () => {
    users.getUserProfile.mockResolvedValue(profileWith(false, false));
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    renderHost();
    open(trigger);
    await screen.findByRole('switch', { name: 'posts' });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('keeps Escape from also closing the post overlay behind it', async () => {
    users.getUserProfile.mockResolvedValue(profileWith(false, false));
    const behind = vi.fn();
    document.addEventListener('keydown', behind);
    renderHost();
    open();
    await screen.findByRole('switch', { name: 'posts' });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(behind).not.toHaveBeenCalled();
    document.removeEventListener('keydown', behind);
  });

  it('closes when the route changes, so back never leaves it over another screen', async () => {
    users.getUserProfile.mockResolvedValue(profileWith(false, false));
    renderHost();
    open();
    await screen.findByRole('switch', { name: 'posts' });

    fireEvent.click(screen.getByTestId('go'));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useMuteDialogStore.getState().target).toBeNull();
  });

  it('says so with a toast when a save fails after the dialog was closed', async () => {
    users.getUserProfile.mockResolvedValue(profileWith(false, false));
    let refuse: (error: unknown) => void = () => {};
    safety.setMute.mockReturnValue(new Promise((_resolve, reject) => (refuse = reject)));
    renderHost();
    open();
    await screen.findByRole('switch', { name: 'posts' });

    fireEvent.click(posts());
    await waitFor(() => expect(safety.setMute).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => refuse(apiError('INTERNAL_SERVER_ERROR', 500)));

    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't save that. Try again.");
  });

  it('moves focus into the dialog and keeps Tab and Shift+Tab inside it', async () => {
    users.getUserProfile.mockResolvedValue(profileWith(false, false));
    renderHost();
    open();
    const dialog = await screen.findByRole('dialog');
    await screen.findByRole('switch', { name: 'posts' });
    expect(dialog.contains(document.activeElement)).toBe(true);

    screen.getByRole('button', { name: 'done' }).focus();
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    expect(posts()).toHaveFocus();

    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'done' })).toHaveFocus();
  });
});
