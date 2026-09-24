import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as notifService from '@/services/notification.service';
import { useAdvanceSeen, useNotificationList } from '@/features/luvax/hooks/useNotifications';
import { NotificationRow } from '@/features/luvax/notifications/NotificationRow';
import { NotificationsScreen } from '@/features/luvax/notifications/NotificationsScreen';

vi.mock('@/services/notification.service');
vi.mock('@/services/realtime/stompConnection', () => ({
  NOTIFICATION_ENDPOINT: '/ws/notifications',
  subscribeTopic: vi.fn(() => () => {}),
}));
vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: (selector) => selector({ user: { id: 'me' } }),
}));
vi.mock('@/features/luvax/hooks/useSocial', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useFollow: () => ({ mutate: vi.fn() }),
    usePendingFollowRequests: () => ({ data: { data: { content: [] } }, isLoading: false }),
    useApproveFollowRequest: () => ({ mutate: vi.fn() }),
    useRejectFollowRequest: () => ({ mutate: vi.fn() }),
  };
});

const wrapper = ({ children }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useAdvanceSeen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls POST /notifications/seen with the given tuple', async () => {
    notifService.advanceSeen.mockResolvedValue({ seen: { activityAt: 'x', id: 'y' } });
    const { result } = renderHook(() => useAdvanceSeen(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ activityAt: 'x', id: 'y' });
    });
    expect(notifService.advanceSeen).toHaveBeenCalledWith({ activityAt: 'x', id: 'y' });
  });
});

describe('useNotificationList', () => {
  it('requests the given filter and exposes the first page', async () => {
    notifService.getNotifications.mockResolvedValue({
      content: [{ id: 'n1' }],
      pageInfo: { hasNextPage: false },
      head: { activityAt: 'a', id: 'n1' },
    });
    const { result } = renderHook(() => useNotificationList('unread'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifService.getNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'unread', cursor: null, limit: 20 })
    );
  });
});

describe('useLiveNotifications', () => {
  it('is not tested for socket wiring here - covered by the live E2E pass (plan Task 23), since stompConnection is mocked at the module boundary for every Vitest case', () => {
    expect(true).toBe(true);
  });
});

const renderRow = (item, navigate = vi.fn()) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationRow item={item} navigate={navigate} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  // The row itself and its "notification options" menu trigger are both role="button",
  // so tests reference the row by its stable class rather than the ambiguous bare role.
  return { ...result, row: result.container.querySelector('.lx-focusable-row') };
};

const baseItem = (overrides = {}) => ({
  id: 'n1',
  type: 'like_post',
  category: 'like',
  actors: [{ id: 'u1', username: 'anna', isVerified: false }],
  actorCount: 1,
  isRead: false,
  readAt: null,
  isNew: true,
  activityAt: '2026-09-23T10:00:00.000000Z',
  createdAt: '2026-09-23T10:00:00.000000Z',
  target: { kind: 'post', postId: 'p1', available: true },
  preview: null,
  moderation: null,
  relationship: null,
  ...overrides,
});

describe('NotificationRow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is a focusable button-role element (D15)', () => {
    const { row } = renderRow(baseItem());
    expect(row).toHaveAttribute('role', 'button');
    expect(row).toHaveAttribute('tabIndex', '0');
  });

  it('an unavailable target renders muted, does not navigate, and does not mark read on tap', async () => {
    notifService.markRead.mockResolvedValue({ id: 'n1', readAt: 'x' });
    const navigate = vi.fn();
    const { row } = renderRow(
      baseItem({ target: { kind: 'post', postId: 'p1', available: false } }),
      navigate
    );
    fireEvent.click(row);
    expect(navigate).not.toHaveBeenCalled();
    expect(notifService.markRead).not.toHaveBeenCalled();
  });

  it('a navigable row marks read (optimistically) and navigates on tap', async () => {
    notifService.markRead.mockResolvedValue({ id: 'n1', readAt: 'x' });
    const navigate = vi.fn();
    const { row } = renderRow(baseItem(), navigate);
    fireEvent.click(row);
    await waitFor(() => expect(notifService.markRead).toHaveBeenCalledWith('n1'));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/app/p/p1'));
  });

  it('renders the sentence with the actor name and phrase', () => {
    renderRow(baseItem());
    expect(screen.getByText(/liked your post/)).toBeInTheDocument();
  });

  it('renders no full-row tint for an unread row - only the trailing dot (D18)', () => {
    const { row } = renderRow(baseItem({ isRead: false }));
    expect(row.style.background).not.toMatch(/accent-dim/);
  });
});

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationsScreen />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return client;
};

describe('NotificationsScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('never calls a read endpoint on mount', async () => {
    notifService.getNotifications.mockResolvedValue({
      content: [],
      pageInfo: { hasNextPage: false },
      head: null,
    });
    notifService.getState.mockResolvedValue({
      unseen: { count: 0, capped: false },
      seen: null,
      previous: null,
      followRequests: { count: 0, capped: false, recent: [] },
    });
    renderScreen();
    await waitFor(() => expect(notifService.getNotifications).toHaveBeenCalled());
    expect(notifService.markRead).not.toHaveBeenCalled();
    expect(notifService.markAllRead).not.toHaveBeenCalled();
  });

  it('calls POST /seen exactly once with the first rendered head after the first page-0 all load', async () => {
    notifService.getNotifications.mockResolvedValue({
      content: [
        {
          id: 'n1',
          type: 'like_post',
          category: 'like',
          actors: [],
          actorCount: 1,
          isRead: false,
          target: { kind: 'post', postId: 'p1', available: true },
        },
      ],
      pageInfo: { hasNextPage: false },
      head: { activityAt: '2026-09-23T10:00:00.000000Z', id: 'n1' },
    });
    notifService.getState.mockResolvedValue({
      unseen: { count: 1, capped: false },
      seen: null,
      previous: null,
      followRequests: { count: 0, capped: false, recent: [] },
    });
    notifService.advanceSeen.mockResolvedValue({});
    renderScreen();
    await waitFor(() =>
      expect(notifService.advanceSeen).toHaveBeenCalledWith({
        activityAt: '2026-09-23T10:00:00.000000Z',
        id: 'n1',
      })
    );
    expect(notifService.advanceSeen).toHaveBeenCalledTimes(1);
  });

  it('switching chips issues a request for that filter and does not call POST /seen again', async () => {
    notifService.getNotifications.mockResolvedValue({
      content: [],
      pageInfo: { hasNextPage: false },
      head: null,
    });
    notifService.getState.mockResolvedValue({
      unseen: { count: 0, capped: false },
      seen: null,
      previous: null,
      followRequests: { count: 0, capped: false, recent: [] },
    });
    renderScreen();
    await waitFor(() => expect(notifService.getNotifications).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'unread' }));
    await waitFor(() =>
      expect(notifService.getNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ filter: 'unread' })
      )
    );
    expect(notifService.advanceSeen).not.toHaveBeenCalled();
  });

  it('mark all as read sends upTo = the head of the most recently fetched page 0', async () => {
    notifService.getNotifications.mockResolvedValue({
      content: [],
      pageInfo: { hasNextPage: false },
      head: { activityAt: '2026-09-23T10:00:00.000000Z', id: 'n1' },
    });
    notifService.getState.mockResolvedValue({
      unseen: { count: 3, capped: false },
      seen: null,
      previous: null,
      followRequests: { count: 0, capped: false, recent: [] },
    });
    notifService.markAllRead.mockResolvedValue({ updated: 3 });
    renderScreen();
    // The button stays disabled until pageHead resolves; clicking before then is swallowed by
    // the DOM's own disabled-button handling, exactly as it would be for a real user.
    const markAllButton = await screen.findByRole('button', { name: /mark all as read/i });
    await waitFor(() => expect(markAllButton).not.toBeDisabled());
    fireEvent.click(markAllButton);
    await waitFor(() =>
      expect(notifService.markAllRead).toHaveBeenCalledWith({
        activityAt: '2026-09-23T10:00:00.000000Z',
        id: 'n1',
      })
    );
  });

  it('an empty all-filter state renders a sentence-case empty state (D28)', async () => {
    notifService.getNotifications.mockResolvedValue({
      content: [],
      pageInfo: { hasNextPage: false },
      head: null,
    });
    notifService.getState.mockResolvedValue({
      unseen: { count: 0, capped: false },
      seen: null,
      previous: null,
      followRequests: { count: 0, capped: false, recent: [] },
    });
    renderScreen();
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
  });
});
