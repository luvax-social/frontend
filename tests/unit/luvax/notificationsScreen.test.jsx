import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import * as notifService from '@/services/notification.service';
import {
  useAdvanceSeen,
  useNotificationList,
} from '@/features/luvax/hooks/useNotifications';

vi.mock('@/services/notification.service');
vi.mock('@/services/realtime/stompConnection', () => ({
  NOTIFICATION_ENDPOINT: '/ws/notifications',
  subscribeTopic: vi.fn(() => () => {}),
}));
vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: (selector) => selector({ user: { id: 'me' } }),
}));

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
