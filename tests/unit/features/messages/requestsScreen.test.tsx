import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { LuvaxTweaksProvider } from '@/features/luvax/LuvaxTweaksContext';
import type { Viewport } from '@/features/luvax/LuvaxTweaksContext';
import { TWEAK_DEFAULTS } from '@/features/luvax/constants/data';
import { MessagesScreen } from '@/features/messages/MessagesScreen';
import type { Conversation } from '@/features/messages/types';
import { messageService } from '@/services/message.service';
import { useAuthStore } from '@/store/useAuthStore';
import type { ApiResponse, CursorPage } from '@/types/api';
import { conversationFixture, messageFixture, participantFixture } from '../../../fixtures/domain';
import { envelope } from '../../luvax/settings/settingsFixtures';

vi.mock('@/services/message.service');
vi.mock('@/services/realtime/stompConnection', () => ({
  MESSAGE_ENDPOINT: '/ws/messages',
  subscribeTopic: vi.fn(() => () => {}),
}));
vi.mock('@/features/luvax/hooks/useUsers', () => ({
  useUserProfile: () => ({ data: undefined }),
}));
vi.mock('@/features/luvax/hooks/useSocial', () => ({
  useBlock: () => ({ mutate: vi.fn(), isPending: false }),
  useBlockedUsers: () => ({ data: undefined }),
  invalidateAfterBlock: vi.fn(),
}));
vi.mock('@/features/luvax/hooks/useMediaUpload', () => ({ useMediaUpload: () => ({}) }));
vi.mock('@/features/luvax/hooks/useMediaConstraints', () => ({
  useMediaConstraints: () => ({ data: undefined }),
}));

const service = vi.mocked(messageService);

const request = conversationFixture({
  id: 'r1',
  participants: [
    participantFixture({ userId: 'me', username: 'me' }),
    participantFixture({ userId: 'hoa', username: 'hoa.nguyen', displayName: 'Hoa' }),
  ],
  requestStatus: 'pending',
  isRequestRecipient: true,
  lastMessage: messageFixture({ id: 'm1', conversationId: 'r1', senderId: 'hoa' }),
}) as Conversation;

const page = (rows: Conversation[]): ApiResponse<CursorPage<Conversation>> =>
  envelope({
    degraded: false,
    content: rows,
    pageInfo: { endCursor: null, startCursor: null, hasPreviousPage: false, hasNextPage: false },
  });

const messagePage = envelope({
  degraded: false,
  content: [messageFixture({ id: 'm1', conversationId: 'r1', senderId: 'hoa' })],
  pageInfo: { endCursor: null, startCursor: null, hasPreviousPage: false, hasNextPage: false },
});

const renderScreen = (viewport: Viewport) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <LuvaxTweaksProvider value={{ tweaks: TWEAK_DEFAULTS, setTweak: vi.fn(), viewport }}>
          <MessagesScreen />
        </LuvaxTweaksProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return queryClient;
};

const openRequest = async () => {
  fireEvent.click(await screen.findByRole('tab', { name: /requests/ }));
  fireEvent.click(await screen.findByText('Hoa'));
  await screen.findByRole('button', { name: 'accept' });
};

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ user: { id: 'me', username: 'me' } as never });
  service.listConversations.mockImplementation((async ({ folder }: { folder: string }) =>
    page(folder === 'requests' ? [request] : [])) as never);
  service.getUnreadCount.mockResolvedValue(envelope({ unreadCount: 0, requestCount: 1 }) as never);
  service.listMessages.mockResolvedValue(messagePage as never);
});

describe('message requests at the mobile width', () => {
  it('returns to the request list after a request is deleted', async () => {
    service.deleteRequest.mockResolvedValue(undefined as never);
    renderScreen('mobile');
    await openRequest();

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'delete this request?' });
    // The dialog ignores a confirm tap until its arming delay has passed.
    await waitFor(
      () => {
        fireEvent.click(within(dialog).getByRole('button', { name: 'delete' }));
        expect(service.deleteRequest).toHaveBeenCalledWith('r1');
      },
      { timeout: 3000 }
    );
    expect(await screen.findByRole('tab', { name: /requests/ })).toBeInTheDocument();
  });

  it('keeps the decision bar on screen while an accept is in flight', async () => {
    let resolve: (value: unknown) => void = () => {};
    service.acceptRequest.mockReturnValue(
      new Promise((res) => {
        resolve = res;
      }) as never
    );
    renderScreen('desktop');
    await openRequest();

    fireEvent.click(screen.getByRole('button', { name: 'accept' }));
    await waitFor(() => expect(service.acceptRequest).toHaveBeenCalledWith('r1'));

    expect(screen.getByRole('button', { name: 'accept' })).toBeInTheDocument();
    await act(async () => {
      resolve(envelope({ id: 'r1' }));
    });
  });
});
