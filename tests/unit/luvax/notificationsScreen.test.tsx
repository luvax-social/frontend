import type * as SocialHooks from '@/features/luvax/hooks/useSocial';
import type { ReactNode } from 'react';
import type { NotificationItemResponse } from '@/types/domain';
import {
  notificationTarget,
  notificationFixture,
  notificationPage,
  notificationState,
} from '../../fixtures/domain';
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
  useAuthStore: <T,>(selector: (state: { user: { id: string } }) => T) =>
    selector({ user: { id: 'me' } }),
}));
vi.mock('@/features/luvax/hooks/useSocial', async (importOriginal) => {
  const actual = await importOriginal<typeof SocialHooks>();
  return {
    ...actual,
    useFollow: () => ({ mutate: vi.fn() }),
    usePendingFollowRequests: () => ({ data: { data: { content: [] } }, isLoading: false }),
    useApproveFollowRequest: () => ({ mutate: vi.fn() }),
    useRejectFollowRequest: () => ({ mutate: vi.fn() }),
  };
});

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useAdvanceSeen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls POST /notifications/seen with the given tuple', async () => {
    vi.mocked(notifService.advanceSeen).mockResolvedValue(
      notificationState({ seen: { activityAt: 'x', id: 'y' } })
    );
    const { result } = renderHook(() => useAdvanceSeen(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ activityAt: 'x', id: 'y' });
    });
    expect(notifService.advanceSeen).toHaveBeenCalledWith({ activityAt: 'x', id: 'y' });
  });
});

describe('useNotificationList', () => {
  it('requests the given filter and exposes the first page', async () => {
    vi.mocked(notifService.getNotifications).mockResolvedValue(
      notificationPage({
        content: [notificationFixture({ id: 'n1' })],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: null,
          startCursor: null,
        },
        head: { activityAt: 'a', id: 'n1' },
      })
    );
    const { result } = renderHook(() => useNotificationList('unread'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifService.getNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'unread', cursor: null, limit: 20 })
    );
  });
});

const renderRow = (item: NotificationItemResponse, navigate = vi.fn()) => {
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
  return { ...result, row: result.container.querySelector<HTMLElement>('.lx-focusable-row')! };
};

const baseItem = notificationFixture;

describe('NotificationRow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is a focusable button-role element (D15)', () => {
    const { row } = renderRow(baseItem());
    expect(row).toHaveAttribute('role', 'button');
    expect(row).toHaveAttribute('tabIndex', '0');
  });

  it('an unavailable target renders muted, does not navigate, and does not mark read on tap', async () => {
    vi.mocked(notifService.markRead).mockResolvedValue({ id: 'n1', readAt: 'x' });
    const navigate = vi.fn();
    const { row } = renderRow(
      baseItem({ target: notificationTarget({ postId: 'p1', available: false }) }),
      navigate
    );
    fireEvent.click(row);
    expect(navigate).not.toHaveBeenCalled();
    expect(notifService.markRead).not.toHaveBeenCalled();
  });

  it('a navigable row marks read (optimistically) and navigates on tap', async () => {
    vi.mocked(notifService.markRead).mockResolvedValue({ id: 'n1', readAt: 'x' });
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
    vi.mocked(notifService.getNotifications).mockResolvedValue(
      notificationPage({
        content: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: null,
          startCursor: null,
        },
        head: null,
      })
    );
    vi.mocked(notifService.getState).mockResolvedValue(
      notificationState({
        unseen: { count: 0, capped: false },
        seen: null,
        previous: null,
        followRequests: { count: 0, capped: false, recent: [] },
      })
    );
    renderScreen();
    await waitFor(() => expect(notifService.getNotifications).toHaveBeenCalled());
    expect(notifService.markRead).not.toHaveBeenCalled();
    expect(notifService.markAllRead).not.toHaveBeenCalled();
  });

  it('calls POST /seen exactly once with the first rendered head after the first page-0 all load', async () => {
    vi.mocked(notifService.getNotifications).mockResolvedValue(
      notificationPage({
        content: [
          notificationFixture({
            id: 'n1',
            type: 'like_post',
            category: 'like',
            actors: [],
            actorCount: 1,
            isRead: false,
            target: {
              kind: 'post',
              postId: 'p1',
              available: true,
              commentId: null,
              storyId: null,
              ticketId: null,
              userId: null,
            },
          }),
        ],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: null,
          startCursor: null,
        },
        head: { activityAt: '2026-09-23T10:00:00.000000Z', id: 'n1' },
      })
    );
    vi.mocked(notifService.getState).mockResolvedValue(
      notificationState({
        unseen: { count: 1, capped: false },
        seen: null,
        previous: null,
        followRequests: { count: 0, capped: false, recent: [] },
      })
    );
    vi.mocked(notifService.advanceSeen).mockResolvedValue(notificationState({}));
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
    vi.mocked(notifService.getNotifications).mockResolvedValue(
      notificationPage({
        content: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: null,
          startCursor: null,
        },
        head: null,
      })
    );
    vi.mocked(notifService.getState).mockResolvedValue(
      notificationState({
        unseen: { count: 0, capped: false },
        seen: null,
        previous: null,
        followRequests: { count: 0, capped: false, recent: [] },
      })
    );
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
    vi.mocked(notifService.getNotifications).mockResolvedValue(
      notificationPage({
        content: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: null,
          startCursor: null,
        },
        head: { activityAt: '2026-09-23T10:00:00.000000Z', id: 'n1' },
      })
    );
    vi.mocked(notifService.getState).mockResolvedValue(
      notificationState({
        unseen: { count: 3, capped: false },
        seen: null,
        previous: null,
        followRequests: { count: 0, capped: false, recent: [] },
      })
    );
    vi.mocked(notifService.markAllRead).mockResolvedValue({ updated: 3 });
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
    vi.mocked(notifService.getNotifications).mockResolvedValue(
      notificationPage({
        content: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: null,
          startCursor: null,
        },
        head: null,
      })
    );
    vi.mocked(notifService.getState).mockResolvedValue(
      notificationState({
        unseen: { count: 0, capped: false },
        seen: null,
        previous: null,
        followRequests: { count: 0, capped: false, recent: [] },
      })
    );
    renderScreen();
    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
  });
});
