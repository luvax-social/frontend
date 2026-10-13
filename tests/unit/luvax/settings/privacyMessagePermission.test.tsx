import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { PrivacyCategory } from '@/features/luvax/components/settingsCategories';
import * as userService from '@/services/user.service';
import type { UserProfileResponse } from '@/types/domain';

import { apiError, envelope, settingsFixture } from './settingsFixtures';

vi.mock('@/services/user.service');

const service = vi.mocked(userService);

const profile = { id: 'me', username: 'minh', isPrivate: false } as UserProfileResponse;

const renderPrivacy = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
  return render(<PrivacyCategory />, { wrapper });
};

const radio = (name: RegExp) => screen.getByRole('radio', { name });

const loaded = async () => {
  renderPrivacy();
  await screen.findByRole('radiogroup', { name: 'who can message you' });
  await waitFor(() => expect(radio(/^everyone$/)).toBeEnabled());
};

// The server's copy of the settings: PATCH applies to it and GET reads it, so a refetch after a
// save returns what the server really holds.
let stored = settingsFixture();

beforeEach(() => {
  vi.resetAllMocks();
  stored = settingsFixture();
  service.getMyProfile.mockResolvedValue(envelope(profile));
  service.getMySettings.mockImplementation(async () => envelope({ ...stored }));
  service.updateMySettings.mockImplementation(async (patch) => {
    if (patch.messagePermission) stored = { ...stored, messagePermission: patch.messagePermission };
    return envelope({ ...stored });
  });
});

describe('privacy: who can message you', () => {
  it('offers everyone, people you follow and no one, each with its explanation', async () => {
    await loaded();

    expect(
      screen.getAllByRole('radio').map((option) => option.getAttribute('aria-checked'))
    ).toEqual(['true', 'false', 'false']);
    expect(radio(/^everyone$/)).toHaveAccessibleDescription(
      "People you don't follow can send one message. It arrives in your requests."
    );
    expect(radio(/^people you follow$/)).toHaveAccessibleDescription(
      'Only people you follow can start a conversation with you.'
    );
    expect(radio(/^no one$/)).toHaveAccessibleDescription(
      'No one new can message you. People you follow each other with still can.'
    );
  });

  it('no longer renders the allow message requests toggle', async () => {
    await loaded();

    expect(screen.queryByRole('switch', { name: /allow message requests/i })).toBeNull();
    expect(
      screen.getAllByRole('switch').map((toggle) => toggle.getAttribute('aria-label'))
    ).toEqual([
      'private account',
      'show activity status',
      'allow story replies',
      'suggest my account to others',
    ]);
  });

  it('reflects the saved permission', async () => {
    stored = settingsFixture({ messagePermission: 'nobody' });
    await loaded();

    expect(radio(/^no one$/)).toHaveAttribute('aria-checked', 'true');
  });

  it('saves a chosen option with a partial body', async () => {
    await loaded();

    fireEvent.click(radio(/^people you follow$/));

    await waitFor(() =>
      expect(radio(/^people you follow$/)).toHaveAttribute('aria-checked', 'true')
    );
    expect(service.updateMySettings).toHaveBeenCalledWith({ messagePermission: 'following' });
  });

  it('moves and saves with the arrow keys, wrapping at both ends', async () => {
    await loaded();

    radio(/^everyone$/).focus();
    fireEvent.keyDown(radio(/^everyone$/), { key: 'ArrowDown' });
    await waitFor(() =>
      expect(radio(/^people you follow$/)).toHaveAttribute('aria-checked', 'true')
    );
    expect(radio(/^people you follow$/)).toHaveFocus();
    expect(service.updateMySettings).toHaveBeenLastCalledWith({ messagePermission: 'following' });

    fireEvent.keyDown(radio(/^people you follow$/), { key: 'ArrowUp' });
    await waitFor(() => expect(radio(/^everyone$/)).toHaveAttribute('aria-checked', 'true'));

    fireEvent.keyDown(radio(/^everyone$/), { key: 'ArrowLeft' });
    await waitFor(() => expect(radio(/^no one$/)).toHaveAttribute('aria-checked', 'true'));
    expect(service.updateMySettings).toHaveBeenLastCalledWith({ messagePermission: 'nobody' });
  });

  it('keeps only the selected option in the tab order', async () => {
    await loaded();

    expect(radio(/^everyone$/)).toHaveAttribute('tabindex', '0');
    expect(radio(/^people you follow$/)).toHaveAttribute('tabindex', '-1');
    expect(radio(/^no one$/)).toHaveAttribute('tabindex', '-1');
  });

  it('rolls back to the previous option and says so when the save fails', async () => {
    service.updateMySettings.mockRejectedValue(apiError('MALFORMED_REQUEST_BODY', 400));
    await loaded();

    fireEvent.click(radio(/^no one$/));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't save that just now. Try again in a moment."
    );
    expect(radio(/^everyone$/)).toHaveAttribute('aria-checked', 'true');
    expect(radio(/^no one$/)).toHaveAttribute('aria-checked', 'false');
  });

  it('shows the failure of an earlier change when a later change succeeds', async () => {
    let refuseFirst = () => {};
    service.updateMySettings.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          refuseFirst = () => reject(apiError('INTERNAL_SERVER_ERROR', 500));
        })
    );
    await loaded();

    fireEvent.keyDown(radio(/^everyone$/), { key: 'ArrowDown' });
    await waitFor(() =>
      expect(radio(/^people you follow$/)).toHaveAttribute('aria-checked', 'true')
    );
    fireEvent.keyDown(radio(/^people you follow$/), { key: 'ArrowDown' });
    await waitFor(() => expect(radio(/^no one$/)).toHaveAttribute('aria-checked', 'true'));
    await act(async () => refuseFirst());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't save that just now. Try again in a moment."
    );
    await waitFor(() => expect(radio(/^no one$/)).toHaveAttribute('aria-checked', 'true'));
    expect(service.updateMySettings).toHaveBeenNthCalledWith(2, { messagePermission: 'nobody' });
  });
});
