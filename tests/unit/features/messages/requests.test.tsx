import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';

import { ChatCenterPanel } from '@/features/messages/components/ChatCenterPanel';
import { InboxTabs } from '@/features/messages/components/InboxTabs';
import { PendingRequestNotice } from '@/features/messages/components/PendingRequestNotice';
import { RequestActionBar } from '@/features/messages/components/RequestActionBar';
import { deleteRequestConfirm } from '@/features/messages/utils/requestConfirm';
import { useConversations, useInboxCounts } from '@/features/messages/hooks/useConversations';
import { useInboxLive } from '@/features/messages/hooks/useInboxLive';
import {
  useAcceptRequest,
  useBlockRequester,
  useDeleteRequest,
} from '@/features/messages/hooks/useMessageRequests';
import { UNAVAILABLE_NOTICE, isNotFoundError } from '@/features/messages/utils/unavailable';
import { toThread } from '@/features/messages/utils/messageViewModel';
import type { Conversation } from '@/features/messages/types';
import { messageService } from '@/services/message.service';
import { subscribeTopic } from '@/services/realtime/stompConnection';
import type { ApiResponse, CursorPage } from '@/types/api';
import type { ConversationSummaryResponse } from '@/types/domain';
import { conversationFixture, participantFixture } from '../../../fixtures/domain';
import { apiError, envelope } from '../../luvax/settings/settingsFixtures';

vi.mock('@/services/message.service');
vi.mock('@/services/realtime/stompConnection', () => ({
  MESSAGE_ENDPOINT: '/ws/messages',
  subscribeTopic: vi.fn(() => () => {}),
}));

const service = vi.mocked(messageService);
const subscribe = vi.mocked(subscribeTopic);

const REQUESTS_KEY = ['conversations', 'requests'];
const PRIMARY_KEY = ['conversations', 'primary'];
const UNREAD_KEY = ['conversations', 'unread-count'];

const row = (id: string, overrides: Partial<ConversationSummaryResponse> = {}) =>
  conversationFixture({
    id,
    participants: [
      participantFixture({ userId: 'me', username: 'me' }),
      participantFixture({ userId: `from-${id}`, username: `from.${id}` }),
    ],
    requestStatus: 'pending',
    isRequestRecipient: true,
    ...overrides,
  }) as Conversation;

const page = (rows: Conversation[]): ApiResponse<CursorPage<Conversation>> =>
  envelope({
    degraded: false,
    content: rows,
    pageInfo: { endCursor: null, startCursor: null, hasPreviousPage: false, hasNextPage: false },
  });

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
  return { queryClient, invalidate, wrapper };
};

const seedRequests = (queryClient: QueryClient, rows: Conversation[]) =>
  queryClient.setQueryData(REQUESTS_KEY, { pages: [page(rows)], pageParams: [null] });

const cachedIds = (queryClient: QueryClient) =>
  queryClient
    .getQueryData<{ pages: ApiResponse<CursorPage<Conversation>>[] }>(REQUESTS_KEY)
    ?.pages.flatMap((p) => p.data.content.map((c) => c.id)) ?? [];

const filterKeys = (spy: ReturnType<typeof setup>['invalidate']) =>
  spy.mock.calls.map(([filter]) => JSON.stringify(filter?.queryKey));

beforeEach(() => {
  vi.resetAllMocks();
  subscribe.mockImplementation(() => () => {});
});

describe('inbox folders', () => {
  it('lists each folder under its own cache key and sends the folder parameter', async () => {
    service.listConversations.mockResolvedValue(page([row('r1')]) as never);
    const { queryClient, wrapper } = setup();

    const { result } = renderHook(() => useConversations('requests'), { wrapper });

    await waitFor(() => expect(result.current.conversations).toHaveLength(1));
    expect(service.listConversations).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'requests' })
    );
    expect(queryClient.getQueryData(REQUESTS_KEY)).toBeDefined();
  });

  it('defaults to the primary folder', async () => {
    service.listConversations.mockResolvedValue(page([]) as never);
    const { queryClient, wrapper } = setup();

    renderHook(() => useConversations(), { wrapper });

    await waitFor(() => expect(queryClient.getQueryData(PRIMARY_KEY)).toBeDefined());
    expect(service.listConversations).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'primary' })
    );
  });

  it('reads the unread count and the request count from the server without arithmetic', async () => {
    service.getUnreadCount.mockResolvedValue(
      envelope({ unreadCount: 4, requestCount: 3 }) as never
    );
    const { wrapper } = setup();

    const { result } = renderHook(() => useInboxCounts(), { wrapper });

    await waitFor(() => expect(result.current).toEqual({ count: 4, requestCount: 3 }));
  });
});

describe('request actions', () => {
  it.each([
    [
      'accept',
      useAcceptRequest,
      (p: Promise<unknown>) => service.acceptRequest.mockReturnValue(p as never),
    ],
    [
      'delete',
      useDeleteRequest,
      (p: Promise<unknown>) => service.deleteRequest.mockReturnValue(p as never),
    ],
    [
      'block',
      useBlockRequester,
      (p: Promise<unknown>) => service.blockRequester.mockReturnValue(p as never),
    ],
  ] as const)(
    '%s removes the row at once and restores the snapshot on failure',
    async (_name, hook, arm) => {
      let reject: (error: unknown) => void = () => {};
      arm(
        new Promise((_resolve, rej) => {
          reject = rej;
        })
      );
      const { queryClient, wrapper } = setup();
      seedRequests(queryClient, [row('r1'), row('r2')]);
      const { result } = renderHook(() => hook(), { wrapper });

      act(() => {
        result.current.mutate('r1');
      });
      await waitFor(() => expect(cachedIds(queryClient)).toEqual(['r2']));

      await act(async () => {
        reject(apiError('INTERNAL_ERROR', 500));
      });
      await waitFor(() => expect(cachedIds(queryClient)).toEqual(['r1', 'r2']));
    }
  );

  it('accept refetches the primary folder and the unread counts', async () => {
    service.acceptRequest.mockResolvedValue(envelope({ id: 'r1' }) as never);
    const refetch = vi.fn();
    const { queryClient, invalidate, wrapper } = setup();
    vi.spyOn(queryClient, 'refetchQueries').mockImplementation(((filter: unknown) => {
      refetch(filter);
      return Promise.resolve();
    }) as never);
    seedRequests(queryClient, [row('r1')]);
    const { result } = renderHook(() => useAcceptRequest(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('r1');
    });

    expect(refetch).toHaveBeenCalledWith(expect.objectContaining({ queryKey: PRIMARY_KEY }));
    expect(filterKeys(invalidate)).toContain(JSON.stringify(UNREAD_KEY));
  });

  it('block also invalidates the social caches', async () => {
    service.blockRequester.mockResolvedValue(undefined as never);
    const { queryClient, invalidate, wrapper } = setup();
    seedRequests(queryClient, [row('r1')]);
    const { result } = renderHook(() => useBlockRequester(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('r1');
    });

    expect(filterKeys(invalidate)).toContain(JSON.stringify(['social', 'blocked']));
    expect(filterKeys(invalidate)).toContain(JSON.stringify(UNREAD_KEY));
  });
});

describe('unavailable state', () => {
  it('treats every not-found answer alike and says nothing about the reason', () => {
    expect(isNotFoundError(apiError('CONVERSATION_NOT_FOUND', 404))).toBe(true);
    expect(isNotFoundError(apiError('MESSAGE_NOT_FOUND', 404))).toBe(true);
    expect(isNotFoundError(apiError('NOT_FOUND', 404))).toBe(true);
    expect(isNotFoundError(apiError('INTERNAL_ERROR', 500))).toBe(false);
    expect(isNotFoundError(new Error('offline'))).toBe(false);
    expect(UNAVAILABLE_NOTICE).toBe('This conversation is unavailable.');
    expect(UNAVAILABLE_NOTICE.toLowerCase()).not.toMatch(/block|declin|delet|restrict/);
  });
});

describe('InboxTabs', () => {
  const props = {
    folder: 'primary' as const,
    requestCount: 3,
    onSelectFolder: vi.fn(),
  };

  it('shows the request count on the requests tab and nothing on the primary tab', () => {
    render(<InboxTabs {...props} />);
    expect(screen.getByRole('tab', { name: /^primary$/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /requests/ })).toHaveTextContent('3');
    expect(screen.getByRole('tab', { name: /^primary$/ })).not.toHaveTextContent(/\d/);
  });

  it('omits the count when there are no requests', () => {
    render(<InboxTabs {...props} requestCount={0} />);
    expect(screen.getByRole('tab', { name: /requests/ })).not.toHaveTextContent(/\d/);
  });

  it('offers the hidden folder as a row under requests with no count', () => {
    const onSelectFolder = vi.fn();
    render(<InboxTabs {...props} folder="requests" onSelectFolder={onSelectFolder} />);
    const hidden = screen.getByRole('button', { name: /hidden requests/ });
    expect(hidden).not.toHaveTextContent(/\d/);
    fireEvent.click(hidden);
    expect(onSelectFolder).toHaveBeenCalledWith('hidden_requests');
  });

  it('does not offer the hidden row on the primary tab', () => {
    render(<InboxTabs {...props} />);
    expect(screen.queryByRole('button', { name: /hidden requests/ })).not.toBeInTheDocument();
  });

  it('switches folder from a tab', () => {
    const onSelectFolder = vi.fn();
    render(<InboxTabs {...props} onSelectFolder={onSelectFolder} />);
    fireEvent.click(screen.getByRole('tab', { name: /requests/ }));
    expect(onSelectFolder).toHaveBeenCalledWith('requests');
  });
});

describe('RequestActionBar', () => {
  it('names the sender and offers block, delete and accept', () => {
    const handlers = { onAccept: vi.fn(), onDelete: vi.fn(), onBlock: vi.fn() };
    render(<RequestActionBar name="Linh" {...handlers} />);

    expect(screen.getByText(/Accept to reply to Linh\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'block' }));
    expect(handlers.onAccept).toHaveBeenCalledOnce();
    expect(handlers.onDelete).toHaveBeenCalledOnce();
    expect(handlers.onBlock).toHaveBeenCalledOnce();
  });

  it('disables the buttons while an action is in flight', () => {
    render(
      <RequestActionBar name="Linh" busy onAccept={vi.fn()} onDelete={vi.fn()} onBlock={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'accept' })).toBeDisabled();
  });

  it('states that the sender is not told when deleting', () => {
    const config = deleteRequestConfirm('Linh', vi.fn());
    expect(config.title).toBe('delete this request?');
    expect(config.message).toBe("It will be removed from your requests. Linh won't be told.");
  });
});

describe('PendingRequestNotice', () => {
  it('tells the sender more messages wait for acceptance and never names a decline', () => {
    render(<PendingRequestNotice name="Hoa" />);
    expect(
      screen.getByText('Request sent. You can send more messages after Hoa accepts.')
    ).toBeInTheDocument();
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/declin|delet|reject/);
  });
});

describe('useInboxLive', () => {
  it('subscribes once to the signed-in user inbox topic on the message transport', () => {
    const { wrapper } = setup();
    renderHook(() => useInboxLive('me'), { wrapper });
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith('/topic/inbox.me', expect.any(Function), {
      endpoint: '/ws/messages',
    });
  });

  it('does not subscribe without a user', () => {
    const { wrapper } = setup();
    renderHook(() => useInboxLive(undefined), { wrapper });
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('invalidates the folder named in the frame and the unread counts', () => {
    const { invalidate, wrapper } = setup();
    renderHook(() => useInboxLive('me'), { wrapper });
    const handler = subscribe.mock.calls[0][1] as (frame: unknown) => void;

    handler({ eventType: 'message.sent.v1', conversationId: 'c1', folder: 'requests' });

    expect(filterKeys(invalidate)).toEqual([
      JSON.stringify(REQUESTS_KEY),
      JSON.stringify(UNREAD_KEY),
    ]);
  });

  it('refreshes every folder when the frame names none', () => {
    const { invalidate, wrapper } = setup();
    renderHook(() => useInboxLive('me'), { wrapper });
    const handler = subscribe.mock.calls[0][1] as (frame: unknown) => void;

    handler({ eventType: 'message.reaction.changed.v1', conversationId: 'c1' });

    expect(filterKeys(invalidate)).toEqual(
      expect.arrayContaining([
        JSON.stringify(PRIMARY_KEY),
        JSON.stringify(REQUESTS_KEY),
        JSON.stringify(['conversations', 'hidden_requests']),
        JSON.stringify(UNREAD_KEY),
      ])
    );
  });

  it('treats a folder it does not know as absent', () => {
    const { invalidate, wrapper } = setup();
    renderHook(() => useInboxLive('me'), { wrapper });
    const handler = subscribe.mock.calls[0][1] as (frame: unknown) => void;

    handler({ eventType: 'message.sent.v1', conversationId: 'c1', folder: 'somewhere' });

    expect(filterKeys(invalidate)).toContain(JSON.stringify(PRIMARY_KEY));
    expect(filterKeys(invalidate)).toContain(JSON.stringify(REQUESTS_KEY));
  });
});

describe('thread composer', () => {
  const panel = (conversation: Conversation, extra: Record<string, unknown> = {}) => {
    const activeThread = toThread(conversation, [], 'me');
    const queryClient = new QueryClient();
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <ChatCenterPanel
            viewport="desktop"
            activeThread={activeThread}
            setActiveThreadId={vi.fn()}
            closeThread={vi.fn()}
            openInfo={vi.fn()}
            isDesktop
            isTablet={false}
            scrollerRef={{ current: null }}
            openPreview={vi.fn()}
            openStory={vi.fn()}
            handleDeleteToggle={vi.fn()}
            replyingTo={null}
            setReplyingTo={vi.fn()}
            draft=""
            setDraft={vi.fn()}
            handleSend={vi.fn()}
            pendingAttachments={[]}
            isSending={false}
            {...extra}
          />
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  const others = [
    participantFixture({ userId: 'me', username: 'me' }),
    participantFixture({ userId: 'hoa', username: 'hoa.nguyen', displayName: 'Hoa' }),
  ];

  it('locks the composer and shows the notice for a sender awaiting acceptance', () => {
    panel(
      conversationFixture({
        participants: others,
        requestStatus: 'pending',
        sendRestriction: 'awaiting_acceptance',
      }) as Conversation
    );
    expect(
      screen.getByText(/Request sent\. You can send more messages after Hoa accepts\./)
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'choose message icon' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /attach a photo/ })).toBeDisabled();
  });

  it('keeps the composer open when the server sends no restriction', () => {
    panel(conversationFixture({ participants: others }) as Conversation);
    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.queryByText(/Request sent/)).not.toBeInTheDocument();
  });

  it('replaces the composer with the decision bar for the recipient of a request', () => {
    const onAccept = vi.fn();
    panel(
      conversationFixture({
        participants: others,
        requestStatus: 'pending',
        isRequestRecipient: true,
      }) as Conversation,
      { requestActions: { onAccept, onDelete: vi.fn(), onBlock: vi.fn() } }
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'accept' }));
    expect(onAccept).toHaveBeenCalledOnce();
  });
});
