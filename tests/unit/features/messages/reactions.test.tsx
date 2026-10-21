import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';

import { MessageBubble } from '@/features/messages/components/MessageBubble';
import { ReactionChip } from '@/features/messages/components/ReactionChip';
import { ReactionPicker } from '@/features/messages/components/ReactionPicker';
import { QUICK_REACTIONS } from '@/features/messages/utils/reactionOptions';
import { useLiveMessages } from '@/features/messages/hooks/useLiveMessages';
import { messagesKey } from '@/features/messages/hooks/useMessages';
import { useReactions } from '@/features/messages/hooks/useReactions';
import { applyReactionChange } from '@/features/messages/utils/reactionCache';
import { isSingleEmoji } from '@/features/messages/utils/emoji';
import { toMessageView, toThread } from '@/features/messages/utils/messageViewModel';
import type { Message, MessageData } from '@/features/messages/types';
import { toast } from '@/features/luvax/components/Toast';
import { messageService } from '@/services/message.service';
import { subscribeTopic } from '@/services/realtime/stompConnection';
import type { ApiResponse, CursorPage } from '@/types/api';
import { conversationFixture, messageFixture, participantFixture } from '../../../fixtures/domain';
import { apiError, envelope } from '../../luvax/settings/settingsFixtures';

vi.mock('@/services/message.service');
vi.mock('@/features/luvax/components/Toast', () => ({ toast: vi.fn() }));
vi.mock('@/services/realtime/stompConnection', () => ({
  MESSAGE_ENDPOINT: '/ws/messages',
  subscribeTopic: vi.fn(() => () => {}),
}));

const service = vi.mocked(messageService);
const subscribe = vi.mocked(subscribeTopic);
const notify = vi.mocked(toast);

const ME = 'me';
const THEM = 'them';
const CONVERSATION = 'c1';
const KEY = messagesKey(CONVERSATION);
const HEART = '❤️';
const THUMBS_UP = '👍';
const LAUGH = '😂';

const page = (content: Message[]): ApiResponse<CursorPage<Message>> =>
  envelope({
    degraded: false,
    content,
    pageInfo: { endCursor: null, startCursor: null, hasPreviousPage: false, hasNextPage: false },
  });

const data = (content: Message[]): MessageData => ({ pages: [page(content)], pageParams: [null] });

const reactionsOn = (queryClient: QueryClient, messageId: string) =>
  queryClient
    .getQueryData<MessageData>(KEY)
    ?.pages.flatMap((p) => p.data.content)
    .find((m) => m.id === messageId)?.reactions;

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

const keysOf = (spy: ReturnType<typeof setup>['invalidate']) =>
  spy.mock.calls.map(([filter]) => JSON.stringify(filter?.queryKey));

const other = (id = 'm1', overrides: Partial<Message> = {}) =>
  messageFixture({ id, conversationId: CONVERSATION, senderId: THEM, ...overrides });

beforeEach(() => {
  vi.resetAllMocks();
  subscribe.mockImplementation(() => () => {});
});

describe('applyReactionChange', () => {
  const change = {
    messageId: 'm1',
    userId: ME,
    reactionId: 'rx-me',
    emoji: HEART,
    reactedAt: '2026-10-01T10:00:00Z',
  };

  it('adds the reaction to the named message only', () => {
    const next = applyReactionChange(data([other('m1'), other('m2')]), change)!;
    const [m1, m2] = next.pages[0].data.content;
    expect(m1.reactions).toEqual([
      { id: 'rx-me', userId: ME, emoji: HEART, reactedAt: change.reactedAt },
    ]);
    expect(m2.reactions).toEqual([]);
  });

  it('replaces the same user reaction instead of stacking a second one', () => {
    const start = data([
      other('m1', {
        reactions: [
          { id: 'rx-them', userId: THEM, emoji: LAUGH, reactedAt: '2026-10-01T09:00:00Z' },
          { id: 'rx-me', userId: ME, emoji: HEART, reactedAt: '2026-10-01T09:30:00Z' },
        ],
      }),
    ]);
    const next = applyReactionChange(start, { ...change, emoji: THUMBS_UP })!;
    expect(next.pages[0].data.content[0].reactions.map((r) => [r.id, r.userId, r.emoji])).toEqual([
      ['rx-them', THEM, LAUGH],
      ['rx-me', ME, THUMBS_UP],
    ]);
  });

  it('removes the reaction when the frame carries no emoji', () => {
    const start = data([
      other('m1', {
        reactions: [{ id: 'rx-me', userId: ME, emoji: HEART, reactedAt: change.reactedAt }],
      }),
    ]);
    const { reactionId: _removed, ...removal } = change;
    const next = applyReactionChange(start, { ...removal, emoji: null })!;
    expect(next.pages[0].data.content[0].reactions).toEqual([]);
  });

  it('is idempotent, so a live frame after the optimistic patch changes nothing', () => {
    const once = applyReactionChange(data([other('m1')]), change)!;
    const twice = applyReactionChange(once, change)!;
    expect(twice).toEqual(once);
  });

  it('leaves a tombstoned message and an unloaded message alone', () => {
    const start = data([other('m1', { isDeleted: true, content: null })]);
    expect(applyReactionChange(start, change)).toEqual(start);
    expect(applyReactionChange(start, { ...change, messageId: 'missing' })).toEqual(start);
    expect(applyReactionChange(undefined, change)).toBeUndefined();
  });
});

describe('useReactions', () => {
  it('shows the caller reaction at once and keeps it when the server accepts', async () => {
    service.reactToMessage.mockResolvedValue(
      envelope({
        id: 'rx-stored',
        userId: ME,
        emoji: HEART,
        reactedAt: '2026-10-01T10:00:00Z',
      }) as never
    );
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(KEY, data([other('m1')]));
    const { result } = renderHook(() => useReactions(CONVERSATION, ME), { wrapper });

    await act(async () => {
      await result.current.react('m1', HEART);
    });

    expect(service.reactToMessage).toHaveBeenCalledWith(CONVERSATION, 'm1', HEART);
    expect(reactionsOn(queryClient, 'm1')?.map((r) => [r.id, r.userId, r.emoji])).toEqual([
      ['rx-stored', ME, HEART],
    ]);
  });

  it('restores the snapshot when adding a reaction fails', async () => {
    let reject: (error: unknown) => void = () => {};
    service.reactToMessage.mockReturnValue(
      new Promise((_resolve, rej) => {
        reject = rej;
      }) as never
    );
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(KEY, data([other('m1')]));
    const { result } = renderHook(() => useReactions(CONVERSATION, ME), { wrapper });

    act(() => {
      void result.current.react('m1', HEART);
    });
    await waitFor(() => expect(reactionsOn(queryClient, 'm1')).toHaveLength(1));

    await act(async () => {
      reject(apiError('INTERNAL_ERROR', 500));
    });
    await waitFor(() => expect(reactionsOn(queryClient, 'm1')).toEqual([]));
    expect(notify).toHaveBeenCalledWith("Couldn't update that reaction. Try again.");
  });

  it('removes the reaction optimistically and restores it when the removal fails', async () => {
    let reject: (error: unknown) => void = () => {};
    service.removeMessageReaction.mockReturnValue(
      new Promise((_resolve, rej) => {
        reject = rej;
      }) as never
    );
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(
      KEY,
      data([
        other('m1', { reactions: [{ id: 'rx-me', userId: ME, emoji: HEART, reactedAt: 'x' }] }),
      ])
    );
    const { result } = renderHook(() => useReactions(CONVERSATION, ME), { wrapper });

    act(() => {
      void result.current.react('m1', null);
    });
    await waitFor(() => expect(reactionsOn(queryClient, 'm1')).toEqual([]));

    await act(async () => {
      reject(apiError('INTERNAL_ERROR', 500));
    });
    await waitFor(() => expect(reactionsOn(queryClient, 'm1')).toHaveLength(1));
  });

  it('answers a not-found with the generic unavailable notice and re-reads the thread', async () => {
    service.reactToMessage.mockRejectedValue(apiError('CONVERSATION_NOT_FOUND', 404));
    const { queryClient, invalidate, wrapper } = setup();
    queryClient.setQueryData(KEY, data([other('m1')]));
    const { result } = renderHook(() => useReactions(CONVERSATION, ME), { wrapper });

    await act(async () => {
      await result.current.react('m1', HEART);
    });

    expect(notify).toHaveBeenCalledWith('This conversation is unavailable.');
    expect(reactionsOn(queryClient, 'm1')).toEqual([]);
    expect(keysOf(invalidate)).toContain(JSON.stringify(KEY));
  });
});

describe('useReactions overlapping writes', () => {
  it('sends reactions to one conversation one at a time', async () => {
    let releaseFirst: (value: unknown) => void = () => {};
    service.reactToMessage
      .mockReturnValueOnce(
        new Promise((resolve) => {
          releaseFirst = resolve;
        }) as never
      )
      .mockResolvedValueOnce(
        envelope({
          id: 'rx-2',
          userId: ME,
          emoji: LAUGH,
          reactedAt: '2026-10-01T10:00:02Z',
        }) as never
      );
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(KEY, data([other('m1')]));
    const { result } = renderHook(() => useReactions(CONVERSATION, ME), { wrapper });

    act(() => {
      void result.current.react('m1', HEART);
      void result.current.react('m1', LAUGH);
    });
    await waitFor(() => expect(service.reactToMessage).toHaveBeenCalledTimes(1));

    await act(async () => {
      releaseFirst(
        envelope({ id: 'rx-1', userId: ME, emoji: HEART, reactedAt: '2026-10-01T10:00:01Z' })
      );
    });
    await waitFor(() => expect(service.reactToMessage).toHaveBeenCalledTimes(2));
  });

  it('re-reads the thread after any failure so a late rollback cannot hide a newer reaction', async () => {
    service.reactToMessage.mockRejectedValue(apiError('RATE_LIMITED', 429));
    const { queryClient, invalidate, wrapper } = setup();
    queryClient.setQueryData(KEY, data([other('m1')]));
    const { result } = renderHook(() => useReactions(CONVERSATION, ME), { wrapper });

    await act(async () => {
      await result.current.react('m1', HEART);
    });

    expect(keysOf(invalidate)).toContain(JSON.stringify(KEY));
  });
});

describe('live reaction frames', () => {
  const frame = (overrides: Record<string, unknown> = {}) => ({
    eventType: 'message.reaction.changed.v1',
    data: {
      conversationId: CONVERSATION,
      messageId: 'm1',
      reactionId: 'rx-live',
      userId: THEM,
      emoji: LAUGH,
      reactedAt: '2026-10-01T10:05:00Z',
      ...overrides,
    },
  });

  it('patches the cached message and does not refetch the thread', () => {
    const { queryClient, invalidate, wrapper } = setup();
    queryClient.setQueryData(KEY, data([other('m1')]));
    renderHook(() => useLiveMessages(CONVERSATION), { wrapper });
    const handler = subscribe.mock.calls[0][1] as (payload: unknown) => void;

    act(() => handler(frame()));

    expect(reactionsOn(queryClient, 'm1')?.map((r) => [r.id, r.userId, r.emoji])).toEqual([
      ['rx-live', THEM, LAUGH],
    ]);
    expect(keysOf(invalidate)).not.toContain(JSON.stringify(KEY));
  });

  it('re-reads the thread instead of patching a set frame that names no reaction id', () => {
    const { queryClient, invalidate, wrapper } = setup();
    queryClient.setQueryData(KEY, data([other('m1')]));
    renderHook(() => useLiveMessages(CONVERSATION), { wrapper });
    const handler = subscribe.mock.calls[0][1] as (payload: unknown) => void;

    act(() => handler(frame({ reactionId: undefined })));

    expect(reactionsOn(queryClient, 'm1')).toEqual([]);
    expect(keysOf(invalidate)).toContain(JSON.stringify(KEY));
  });

  it('removes the reaction when the frame has no emoji', () => {
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(
      KEY,
      data([
        other('m1', { reactions: [{ id: 'rx-live', userId: THEM, emoji: LAUGH, reactedAt: 'x' }] }),
      ])
    );
    renderHook(() => useLiveMessages(CONVERSATION), { wrapper });
    const handler = subscribe.mock.calls[0][1] as (payload: unknown) => void;

    act(() => handler(frame({ emoji: undefined })));

    expect(reactionsOn(queryClient, 'm1')).toEqual([]);
  });

  it('still re-reads the thread for a message frame', () => {
    const { invalidate, wrapper } = setup();
    renderHook(() => useLiveMessages(CONVERSATION), { wrapper });
    const handler = subscribe.mock.calls[0][1] as (payload: unknown) => void;

    act(() => handler({ eventType: 'message.sent.v1', data: { conversationId: CONVERSATION } }));

    expect(keysOf(invalidate)).toContain(JSON.stringify(KEY));
  });
});

describe('isSingleEmoji', () => {
  it.each([HEART, THUMBS_UP, '🇻🇳', '1️⃣'])('accepts %s', (value) =>
    expect(isSingleEmoji(value)).toBe(true)
  );
  it.each(['', 'a', '1', `${HEART}${THUMBS_UP}`, `${THUMBS_UP}a`])('refuses %j', (value) =>
    expect(isSingleEmoji(value)).toBe(false)
  );
});

describe('ReactionPicker', () => {
  const open = (current: string | null = null) => {
    const handlers = { onPick: vi.fn(), onRemove: vi.fn(), onClose: vi.fn() };
    render(<ReactionPicker current={current} {...handlers} />);
    return handlers;
  };

  it('offers the six quick reactions', () => {
    open();
    expect(QUICK_REACTIONS).toHaveLength(6);
    QUICK_REACTIONS.forEach((emoji) =>
      expect(screen.getByRole('button', { name: `react with ${emoji}` })).toBeInTheDocument()
    );
  });

  it('highlights the caller reaction and removes it when tapped again', () => {
    const handlers = open(THUMBS_UP);
    const current = screen.getByRole('button', { name: `react with ${THUMBS_UP}` });
    expect(current).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: `react with ${HEART}` })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    fireEvent.click(current);
    expect(handlers.onRemove).toHaveBeenCalledOnce();
    expect(handlers.onPick).not.toHaveBeenCalled();
  });

  it('picks a different quick reaction', () => {
    const handlers = open(THUMBS_UP);
    fireEvent.click(screen.getByRole('button', { name: `react with ${HEART}` }));
    expect(handlers.onPick).toHaveBeenCalledWith(HEART);
  });

  it('accepts any single emoji through the fallback field and refuses anything else', () => {
    const handlers = open();
    fireEvent.click(screen.getByRole('button', { name: 'choose any emoji' }));
    const field = screen.getByRole('textbox', { name: 'any emoji' });

    fireEvent.change(field, { target: { value: 'hello' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(handlers.onPick).not.toHaveBeenCalled();

    fireEvent.change(field, { target: { value: '🎉' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(handlers.onPick).toHaveBeenCalledWith('🎉');
  });

  it('closes on Escape', () => {
    const handlers = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handlers.onClose).toHaveBeenCalled();
  });
});

describe('ReactionChip', () => {
  it('shows the emoji, a count only above one, and the viewer state', () => {
    const { rerender } = render(
      <ReactionChip reaction={{ emoji: HEART, count: 1, mine: true, reactionId: null }} />
    );
    const chip = screen.getByRole('button', { name: new RegExp(HEART) });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(chip).not.toHaveTextContent(/\d/);

    rerender(<ReactionChip reaction={{ emoji: HEART, count: 2, mine: false, reactionId: 'r1' }} />);
    expect(screen.getByRole('button', { name: new RegExp(HEART) })).toHaveTextContent('2');
  });

  it('removes the viewer reaction when their own chip is tapped and ignores others', () => {
    const onRemoveMine = vi.fn();
    const { rerender } = render(
      <ReactionChip
        reaction={{ emoji: HEART, count: 1, mine: true, reactionId: null }}
        onRemoveMine={onRemoveMine}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(HEART) }));
    expect(onRemoveMine).toHaveBeenCalledOnce();

    rerender(
      <ReactionChip
        reaction={{ emoji: HEART, count: 1, mine: false, reactionId: 'r1' }}
        onRemoveMine={onRemoveMine}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(HEART) }));
    expect(onRemoveMine).toHaveBeenCalledOnce();
  });

  it('offers a report for someone else reaction and never for the viewer own', () => {
    const onReport = vi.fn();
    const { rerender } = render(
      <ReactionChip
        reaction={{ emoji: HEART, count: 1, mine: false, reactionId: 'r1' }}
        onReport={onReport}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(HEART) }));
    fireEvent.click(screen.getByRole('button', { name: 'report reaction' }));
    expect(onReport).toHaveBeenCalledWith('r1');

    rerender(
      <ReactionChip
        reaction={{ emoji: HEART, count: 1, mine: true, reactionId: null }}
        onReport={onReport}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(HEART) }));
    expect(screen.queryByRole('button', { name: 'report reaction' })).not.toBeInTheDocument();
  });
});

describe('MessageBubble reactions', () => {
  const participants = [
    participantFixture({ userId: ME, username: 'me' }),
    participantFixture({ userId: THEM, username: 'minh.tran', displayName: 'Minh' }),
  ];
  const conversation = conversationFixture({ id: CONVERSATION, participants });

  const bubble = (message: Message, extra: Record<string, unknown> = {}) => {
    const thread = toThread(conversation, [message], ME);
    const row = thread.rows.find((r) => r.rowType === 'message');
    if (!row || row.rowType !== 'message') throw new Error('no message row');
    const queryClient = new QueryClient();
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MessageBubble
            message={row}
            activeThread={thread}
            onPreviewMedia={vi.fn()}
            onDeleteToggle={vi.fn()}
            onReplyMessage={vi.fn()}
            viewport="desktop"
            forceShowActions
            canReact
            onReact={vi.fn()}
            {...extra}
          />
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  it('renders a chip for each reaction on the bubble', () => {
    bubble(
      other('m1', {
        reactions: [
          { id: 'rx-me', userId: ME, emoji: THUMBS_UP, reactedAt: '2026-10-01T10:00:00Z' },
        ],
      })
    );
    expect(screen.getByRole('button', { name: new RegExp(THUMBS_UP) })).toBeInTheDocument();
  });

  it('opens the picker from the react button with the caller reaction highlighted', () => {
    const onReact = vi.fn();
    bubble(
      other('m1', {
        reactions: [
          { id: 'rx-me', userId: ME, emoji: THUMBS_UP, reactedAt: '2026-10-01T10:00:00Z' },
        ],
      }),
      { onReact }
    );
    fireEvent.click(screen.getByRole('button', { name: 'react to message' }));
    expect(screen.getByRole('button', { name: `react with ${THUMBS_UP}` })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: `react with ${HEART}` }));
    expect(onReact).toHaveBeenCalledWith('m1', HEART);
  });

  it('removes the reaction when the highlighted option is tapped', () => {
    const onReact = vi.fn();
    bubble(
      other('m1', {
        reactions: [
          { id: 'rx-me', userId: ME, emoji: THUMBS_UP, reactedAt: '2026-10-01T10:00:00Z' },
        ],
      }),
      { onReact }
    );
    fireEvent.click(screen.getByRole('button', { name: 'react to message' }));
    fireEvent.click(screen.getByRole('button', { name: `react with ${THUMBS_UP}` }));
    expect(onReact).toHaveBeenCalledWith('m1', null);
  });

  it('renders no chip and no picker for a tombstoned message', () => {
    bubble(
      other('m1', {
        isDeleted: true,
        content: null,
        reactions: [
          { id: 'rx-me', userId: ME, emoji: THUMBS_UP, reactedAt: '2026-10-01T10:00:00Z' },
        ],
      })
    );
    expect(screen.queryByRole('button', { name: 'react to message' })).not.toBeInTheDocument();
    expect(screen.queryByText(THUMBS_UP)).not.toBeInTheDocument();
  });

  it('offers no react button when reacting is unavailable', () => {
    bubble(other('m1'), { canReact: false });
    expect(screen.queryByRole('button', { name: 'react to message' })).not.toBeInTheDocument();
  });

  it('renders the server reply preview as a quote', () => {
    const view = toMessageView(
      other('m2', {
        replyToId: 'm1',
        replyTo: {
          messageId: 'm1',
          senderId: ME,
          messageType: 'text',
          snippet: 'trip to Sa Pa',
          unavailable: false,
        },
      }),
      { participants, currentUserId: ME }
    );
    expect(view.replyText).toBe('trip to Sa Pa');
  });

  it("offers to report the other person's reaction from its chip menu", () => {
    const onReportReaction = vi.fn();
    bubble(
      other('m1', {
        senderId: ME,
        reactions: [{ id: 'r1', userId: THEM, emoji: LAUGH, reactedAt: '2026-10-01T10:00:00Z' }],
      }),
      { onReportReaction }
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(LAUGH) }));
    fireEvent.click(screen.getByRole('button', { name: 'report reaction' }));
    expect(onReportReaction).toHaveBeenCalledWith('r1', 'm1');
  });
});
