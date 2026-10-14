import { describe, expect, it } from 'vitest';

import { toMessageView, toThread } from '@/features/messages/utils/messageViewModel';
import type { LastReactionPreviewResponse, ReplyPreviewResponse } from '@/types/domain';
import { conversationFixture, messageFixture, participantFixture } from '../../../fixtures/domain';

const ME = 'me';
const THEM = 'them';
const HEART = '❤️';
const LAUGH = '😂';

const participants = [
  participantFixture({ userId: ME, username: 'me', displayName: 'Me' }),
  participantFixture({ userId: THEM, username: 'minh.tran', displayName: 'Minh' }),
];
const ctx = { participants, currentUserId: ME };

const preview = (overrides: Partial<ReplyPreviewResponse> = {}): ReplyPreviewResponse => ({
  messageId: 'm0',
  senderId: THEM,
  messageType: 'text',
  snippet: 'original',
  unavailable: false,
  ...overrides,
});

const reply = (replyTo: ReplyPreviewResponse | null) =>
  messageFixture({ id: 'm2', senderId: ME, replyToId: 'm0', replyTo });

describe('reply quote from the server preview', () => {
  it('uses the preview snippet and the sender name', () => {
    const view = toMessageView(reply(preview()), ctx);
    expect(view.kind).toBe('reply');
    expect(view.replyText).toBe('original');
    expect(view.replyTo).toBe('Minh');
    expect(view.replyUnavailable).toBe(false);
  });

  it('names the viewer as "you" for their own message', () => {
    const view = toMessageView(reply(preview({ senderId: ME })), ctx);
    expect(view.replyTo).toBe('you');
  });

  it('prefers the preview over a loaded message with different text', () => {
    const loaded = messageFixture({ id: 'm0', senderId: THEM, content: 'edited elsewhere' });
    const view = toMessageView(reply(preview()), { ...ctx, loadedMessages: [loaded] });
    expect(view.replyText).toBe('original');
  });

  it('reads "message unavailable" for an unavailable parent and hides the sender', () => {
    const view = toMessageView(
      reply(preview({ senderId: null, messageType: null, snippet: null, unavailable: true })),
      ctx
    );
    expect(view.kind).toBe('reply');
    expect(view.replyText).toBe('message unavailable');
    expect(view.replyTo).toBeNull();
    expect(view.replyUnavailable).toBe(true);
  });

  it.each([
    ['image', 'photo'],
    ['video', 'video'],
    ['post_share', 'shared post'],
    ['story_share', 'shared story'],
  ] as const)('labels a %s parent that has no snippet', (messageType, label) => {
    const view = toMessageView(reply(preview({ messageType, snippet: null })), ctx);
    expect(view.replyText).toBe(label);
  });

  it('falls back to the loaded history only when the preview is absent', () => {
    const loaded = messageFixture({ id: 'm0', senderId: THEM, content: 'from history' });
    const view = toMessageView(reply(null), { ...ctx, loadedMessages: [loaded] });
    expect(view.replyText).toBe('from history');
    expect(view.replyTo).toBe('Minh');
    expect(view.replyUnavailable).toBe(false);
  });

  it('leaves an unresolved reply blank rather than inventing an unavailable state', () => {
    const view = toMessageView(reply(null), ctx);
    expect(view.kind).toBe('reply');
    expect(view.replyText).toBeNull();
    expect(view.replyUnavailable).toBe(false);
  });
});

describe('reactions on a message view', () => {
  it('groups by emoji, counts them and marks the viewer reaction', () => {
    const view = toMessageView(
      messageFixture({
        reactions: [
          { id: 'r1', userId: THEM, emoji: LAUGH, reactedAt: '2026-10-01T10:00:00Z' },
          { userId: ME, emoji: LAUGH, reactedAt: '2026-10-01T10:01:00Z' },
          { id: 'r3', userId: THEM, emoji: HEART, reactedAt: '2026-10-01T10:02:00Z' },
        ],
      }),
      ctx
    );
    expect(view.reactions).toEqual([
      { emoji: LAUGH, count: 2, mine: true, reactionId: 'r1' },
      { emoji: HEART, count: 1, mine: false, reactionId: 'r3' },
    ]);
    expect(view.myReaction).toBe(LAUGH);
  });

  it('never exposes the viewer own reaction as reportable', () => {
    const view = toMessageView(
      messageFixture({
        reactions: [{ id: 'mine-id', userId: ME, emoji: HEART, reactedAt: 'x' }],
      }),
      ctx
    );
    expect(view.reactions[0].reactionId).toBeNull();
  });

  it('carries no reaction for a tombstoned message', () => {
    const view = toMessageView(
      messageFixture({
        isDeleted: true,
        content: null,
        reactions: [{ userId: THEM, emoji: HEART, reactedAt: 'x' }],
      }),
      ctx
    );
    expect(view.kind).toBe('deleted');
    expect(view.reactions).toEqual([]);
    expect(view.myReaction).toBeNull();
  });

  it('has none when the message has no reactions', () => {
    const view = toMessageView(messageFixture(), ctx);
    expect(view.reactions).toEqual([]);
    expect(view.myReaction).toBeNull();
  });
});

describe('conversation row reaction preview', () => {
  const summary = (lastReaction: LastReactionPreviewResponse) =>
    toThread(conversationFixture({ id: 'c1', participants, lastReaction }), [], ME).preview;

  it('names the other person reacting to the viewer message', () => {
    expect(
      summary({
        userId: THEM,
        emoji: LAUGH,
        messageId: 'm1',
        reactedAt: '2026-10-01T10:00:00Z',
        onMyMessage: true,
      })
    ).toBe(`Minh reacted ${LAUGH} to your message`);
  });

  it('says "You" for the viewer own reaction on the other message', () => {
    expect(
      summary({
        userId: ME,
        emoji: HEART,
        messageId: 'm1',
        reactedAt: '2026-10-01T10:00:00Z',
        onMyMessage: false,
      })
    ).toBe(`You reacted ${HEART} to their message`);
  });
});
