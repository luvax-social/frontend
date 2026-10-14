import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MutedAccountsCategory } from '@/features/luvax/components/settings/MutedAccountsCategory';
import * as safetyService from '@/services/safety.service';
import type { MuteResponse } from '@/types/domain';

import { apiError, envelope } from './settingsFixtures';
import { muteFixture, mutePage } from './safetyFixtures';

vi.mock('@/services/safety.service');

const safety = vi.mocked(safetyService);

const threeRows = () => [
  muteFixture('u1', 'an.pham', true, false),
  muteFixture('u2', 'quang.do', true, true),
  muteFixture('u3', 'thao.le', false, true),
];

// A server that remembers what it was told, because every change is followed by a reload of the
// list it is read from.
const serve = (initial: MuteResponse[]) => {
  let rows = initial;
  safety.getMutes.mockImplementation(async () => mutePage(rows));
  safety.setMute.mockImplementation(async (userId, body) => {
    rows =
      body.mutePosts || body.muteStories
        ? rows.map((row) => (row.userId === userId ? { ...row, ...body } : row))
        : rows.filter((row) => row.userId !== userId);
    const row = initial.find((entry) => entry.userId === userId)!;
    return envelope({ ...row, ...body });
  });
  safety.unmute.mockImplementation(async (userId) => {
    rows = rows.filter((row) => row.userId !== userId);
  });
};

const renderCategory = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<MutedAccountsCategory />, { wrapper });
};

const loaded = async (rows = threeRows()) => {
  serve(rows);
  renderCategory();
  await screen.findAllByRole('listitem');
};

const postsSwitch = (handle: string) =>
  screen.getByRole('switch', { name: `mute posts from @${handle}` });
const storiesSwitch = (handle: string) =>
  screen.getByRole('switch', { name: `mute stories from @${handle}` });
const unmuteButton = (handle: string) => screen.getByRole('button', { name: `unmute @${handle}` });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('muted accounts: the list', () => {
  it('lists each account with its names, both switches and an unmute button', async () => {
    await loaded();

    expect(screen.getByText('@quang.do')).toBeInTheDocument();
    expect(screen.getByText('Quang Do')).toBeInTheDocument();
    expect(postsSwitch('an.pham')).toHaveAttribute('aria-checked', 'true');
    expect(storiesSwitch('an.pham')).toHaveAttribute('aria-checked', 'false');
    expect(postsSwitch('thao.le')).toHaveAttribute('aria-checked', 'false');
    expect(storiesSwitch('thao.le')).toHaveAttribute('aria-checked', 'true');
    expect(unmuteButton('quang.do')).toHaveTextContent('unmute');
  });

  it('names an account deleted since by its placeholder and still lets it be unmuted', async () => {
    const gone = muteFixture('u9', 'gone', true, false);
    await loaded([
      { ...gone, user: { ...gone.user, username: null, displayName: 'Deleted user' } },
    ]);

    expect(await screen.findByText('Deleted user')).toBeInTheDocument();
    expect(screen.queryByText('@null')).toBeNull();
    expect(screen.getByRole('button', { name: 'unmute Deleted user' })).toBeInTheDocument();
  });

  it('says so when nothing is muted', async () => {
    safety.getMutes.mockResolvedValue(mutePage([]));
    renderCategory();

    expect(await screen.findByText("You haven't muted anyone.")).toBeInTheDocument();
    expect(
      screen.getByText("Mute someone from their profile or a post's menu.")
    ).toBeInTheDocument();
  });

  it('says so when the list cannot be loaded', async () => {
    safety.getMutes.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));
    renderCategory();

    expect(await screen.findByText('we could not load this')).toBeInTheDocument();
  });

  it('shows more accounts on request', async () => {
    safety.getMutes.mockResolvedValueOnce(
      mutePage([muteFixture('u1', 'an.pham', true, false)], 'c1')
    );
    safety.getMutes.mockResolvedValueOnce(mutePage([muteFixture('u2', 'quang.do', true, true)]));
    renderCategory();
    await screen.findByText('@an.pham');

    fireEvent.click(screen.getByRole('button', { name: 'show more' }));

    expect(await screen.findByText('@quang.do')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'show more' })).toBeNull();
  });
});

describe('muted accounts: changing a mute', () => {
  it('saves a switch on change, sending both values, and keeps the row', async () => {
    await loaded();

    fireEvent.click(postsSwitch('quang.do'));

    await waitFor(() =>
      expect(safety.setMute).toHaveBeenCalledWith('u2', { mutePosts: false, muteStories: true })
    );
    await waitFor(() => expect(postsSwitch('quang.do')).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText('@quang.do')).toBeInTheDocument();
  });

  it('removes the row when the last switch that was on is turned off', async () => {
    await loaded();

    fireEvent.click(postsSwitch('an.pham'));

    await waitFor(() => expect(screen.queryByText('@an.pham')).toBeNull());
    expect(safety.setMute).toHaveBeenCalledWith('u1', { mutePosts: false, muteStories: false });
  });

  it('unmutes with the unmute button and removes the row', async () => {
    await loaded();

    fireEvent.click(unmuteButton('quang.do'));

    await waitFor(() => expect(screen.queryByText('@quang.do')).toBeNull());
    expect(safety.unmute).toHaveBeenCalledWith('u2');
    expect(screen.getByText('@an.pham')).toBeInTheDocument();
  });

  it('puts the row back and says so when a switch is refused', async () => {
    await loaded();
    safety.setMute.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));

    fireEvent.click(postsSwitch('an.pham'));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save that");
    await waitFor(() => expect(screen.getByText('@an.pham')).toBeInTheDocument());
    expect(postsSwitch('an.pham')).toHaveAttribute('aria-checked', 'true');
  });

  it('puts the row back and says so when an unmute is refused', async () => {
    await loaded();
    safety.unmute.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));

    fireEvent.click(unmuteButton('quang.do'));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't unmute them");
    await waitFor(() => expect(screen.getByText('@quang.do')).toBeInTheDocument());
  });
});

describe('muted accounts: focus after a row leaves', () => {
  it('moves to the next row, else the previous row, once an account is unmuted', async () => {
    await loaded();

    fireEvent.click(unmuteButton('quang.do'));
    await waitFor(() => expect(screen.queryByText('@quang.do')).toBeNull());
    expect(postsSwitch('thao.le')).toHaveFocus();

    fireEvent.click(unmuteButton('thao.le'));
    await waitFor(() => expect(screen.queryByText('@thao.le')).toBeNull());
    expect(postsSwitch('an.pham')).toHaveFocus();
  });

  it('moves to the empty message when the last account leaves', async () => {
    await loaded([muteFixture('u1', 'an.pham', true, false)]);

    fireEvent.click(unmuteButton('an.pham'));

    const message = await screen.findByText("You haven't muted anyone.");
    await waitFor(() => expect(message.closest('[tabindex="-1"]')).toHaveFocus());
  });

  it('moves focus the same way when turning off a switch removes the row', async () => {
    await loaded();

    fireEvent.click(storiesSwitch('thao.le'));

    await waitFor(() => expect(screen.queryByText('@thao.le')).toBeNull());
    expect(postsSwitch('quang.do')).toHaveFocus();
  });
});
