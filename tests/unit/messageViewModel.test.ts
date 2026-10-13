import type { Message } from '@/features/messages/types';
import {
  participantFixture,
  messageFixture,
  conversationFixture,
  profileFixture,
} from '../fixtures/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatSeparatorLabel,
  toMessageView,
  toPendingThread,
  toThread,
  toThreadSummary,
} from '@/features/messages/utils/messageViewModel';

const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

const participants = [
  participantFixture({ userId: ME, username: 'me', displayName: 'Me', avatarUrl: null }),
  participantFixture({
    userId: OTHER,
    username: 'priya_m',
    displayName: 'Priya',
    avatarUrl: 'https://cdn/p.jpg',
  }),
];

const message = (overrides: Partial<Message> = {}) =>
  messageFixture({
    senderId: OTHER,
    content: 'hello',
    createdAt: '2026-08-18T10:15:00Z',
    ...overrides,
  });

describe('formatSeparatorLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T18:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('labels a message from today as "Today"', () => {
    expect(formatSeparatorLabel('2026-08-18T10:15:00')).toMatch(/^Today, /);
  });

  it('labels a message from yesterday as "Yesterday"', () => {
    expect(formatSeparatorLabel('2026-08-17T10:15:00')).toMatch(/^Yesterday, /);
  });

  it('labels an older message with its date rather than "Today"/"Yesterday"', () => {
    const label = formatSeparatorLabel('2026-08-10T10:15:00');
    expect(label).not.toMatch(/^Today|^Yesterday/);
    expect(label).toContain('10');
    expect(label).toContain('10:15');
  });
});

describe('toThreadSummary', () => {
  it('names a direct conversation after the other participant, never the viewer', () => {
    const view = toThreadSummary(
      conversationFixture({ id: 'c1', participants, unreadCount: 2, lastMessage: message({}) }),
      ME
    );
    expect(view.name).toBe('Priya');
    expect(view.username).toBe('priya_m');
    expect(view.unread).toBe(2);
  });

  it('previews the last message, and stays blank when there is none', () => {
    const withLast = toThreadSummary(
      conversationFixture({ id: 'c1', participants, unreadCount: 0, lastMessage: message({}) }),
      ME
    );
    expect(withLast.preview).toBe('hello');

    const empty = toThreadSummary(
      conversationFixture({ id: 'c3', participants, unreadCount: 0, lastMessage: null }),
      ME
    );
    expect(empty.preview).toBe('');
  });

  it('describes an attachment preview rather than showing an empty row', () => {
    const view = toThreadSummary(
      conversationFixture({
        id: 'c4',
        participants,
        unreadCount: 0,
        lastMessage: message({ content: null, mediaAssetId: 'a1' }),
      }),
      ME
    );
    expect(view.preview).not.toBe('');
  });
});

describe('toMessageView', () => {
  const ctx = { participants, currentUserId: ME, loadedMessages: [] };

  it('marks the viewer as me and everyone else as them', () => {
    expect(toMessageView(message({ senderId: ME }), ctx).from).toBe('me');
    expect(toMessageView(message({ senderId: OTHER }), ctx).from).toBe('them');
  });

  it('renders a deleted message as a placeholder, not its old content', () => {
    const view = toMessageView(message({ isDeleted: true, content: 'secret' }), ctx);
    expect(view.kind).toBe('deleted');
    expect(view.text).not.toContain('secret');
  });

  it('quotes a reply when the referenced message is loaded', () => {
    const target = message({ id: 'm0', content: 'original', senderId: OTHER });
    const view = toMessageView(message({ id: 'm2', replyToId: 'm0' }), {
      ...ctx,
      loadedMessages: [target],
    });
    expect(view.kind).toBe('reply');
    expect(view.replyText).toBe('original');
    expect(view.replyTo).toBe('Priya');
  });

  it('still renders a reply when the referenced message is outside the loaded page', () => {
    // Fetching the referenced message per bubble would be an N+1 while scrolling, so the quote is
    // dropped rather than fetched. The bubble must still read as a reply.
    const view = toMessageView(message({ id: 'm2', replyToId: 'gone' }), ctx);
    expect(view.kind).toBe('reply');
    expect(view.replyText).toBeNull();
  });

  it('exposes resolved media so a recipient can render an image', () => {
    const view = toMessageView(
      message({
        messageType: 'image',
        content: null,
        mediaAssetId: 'a1',
        media: { mediaAssetId: 'a1', mediaType: 'IMAGE', cdnUrl: 'https://cdn/i.jpg' },
      }),
      ctx
    );
    expect(view.kind).toBe('file');
    expect(view.media!.cdnUrl).toBe('https://cdn/i.jpg');
  });

  it('marks a shared story so the bubble can label it', () => {
    const view = toMessageView(
      message({ messageType: 'story_share', content: 'love this', sharedStoryId: 's1' }),
      ctx
    );
    expect(view.kind).toBe('story');
    expect(view.sharedStoryId).toBe('s1');
    expect(view.meta).toContain('story');
  });

  it('resolves the sender from the participant list rather than the message', () => {
    // MessageResponse carries only senderId; the profile lives on the conversation.
    const view = toMessageView(message({ senderId: OTHER }), ctx);
    expect(view.senderName).toBe('Priya');
    expect(view.senderAvatarUrl).toBe('https://cdn/p.jpg');
  });

  it('formats the timestamp as a short local time', () => {
    const view = toMessageView(message({ createdAt: '2026-08-18T10:15:00Z' }), ctx);
    expect(view.time).toMatch(/\d{1,2}:\d{2}/);
  });

  it('survives a sender who is no longer a participant', () => {
    const view = toMessageView(message({ senderId: 'ghost' }), ctx);
    expect(view.from).toBe('them');
    expect(view.senderName).toBeTruthy();
  });
});

describe('toThread', () => {
  it('combines the summary with mapped messages', () => {
    const conversation = conversationFixture({
      id: 'c1',
      participants,
      unreadCount: 0,
      lastMessage: null,
    });
    const thread = toThread(conversation, [message({ id: 'a' }), message({ id: 'b' })], ME);
    expect(thread.name).toBe('Priya');
    expect(thread.messages).toHaveLength(2);
    expect(thread.participants).toHaveLength(2);
  });

  it('returns messages oldest first so the newest sits at the bottom', () => {
    // The API answers newest first because that is what paginating backwards through history
    // needs. Rendering that order directly puts new messages above old ones, which reads as a log
    // rather than a conversation.
    const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
    const older = message({ id: 'm1', content: 'first', createdAt: '2026-08-18T10:00:00Z' });
    const newer = message({ id: 'm2', content: 'second', createdAt: '2026-08-18T10:05:00Z' });

    const thread = toThread(conversation, [newer, older], ME);

    expect(thread.messages.map((m) => m.text)).toEqual(['first', 'second']);
  });

  it('resolves replies across the whole loaded set, not just earlier pages', () => {
    // Reversing for display must not break quote resolution, which scans the whole loaded set.
    // After the flip the reply is last, not first.
    const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
    const first = message({ id: 'm0', content: 'first' });
    const reply = message({ id: 'm1', replyToId: 'm0' });
    const thread = toThread(conversation, [reply, first], ME);
    expect(thread.messages[1].replyText).toBe('first');
  });

  it('leaves preview and time empty for a conversation nobody has written in', () => {
    // An auto-provisioned conversation has no last message and no activity timestamp. The row must
    // not render a bare separator between two empty strings.
    const summary = toThreadSummary(
      conversationFixture({
        id: 'c1',
        participants,
        unreadCount: 0,
        lastMessage: null,
        lastMessageAt: null,
      }),
      ME
    );
    expect(summary.preview).toBe('');
    expect(summary.time).toBe('');
  });

  it('carries the counterpart id so compose can exclude existing conversations', () => {
    const summary = toThreadSummary(
      conversationFixture({ id: 'c1', participants, unreadCount: 0 }),
      ME
    );
    expect(summary.counterpartId).toBe(OTHER);
  });

  it('carries manuallyUnread, defaulting to false', () => {
    const legacy = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
    // Legacy responses omit these flags; the complete fixture must not mask the fallback.
    Reflect.deleteProperty(legacy, 'manuallyUnread');
    expect(legacy).not.toHaveProperty('manuallyUnread');
    const summary = toThreadSummary(legacy, ME);
    expect(summary.manuallyUnread).toBe(false);

    const flagged = toThreadSummary(
      conversationFixture({ id: 'c1', participants, unreadCount: 0, manuallyUnread: true }),
      ME
    );
    expect(flagged.manuallyUnread).toBe(true);
  });

  it('carries pinned and muted, defaulting both to false', () => {
    const legacy = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
    Reflect.deleteProperty(legacy, 'pinned');
    Reflect.deleteProperty(legacy, 'muted');
    expect(legacy).not.toHaveProperty('pinned');
    expect(legacy).not.toHaveProperty('muted');
    const summary = toThreadSummary(legacy, ME);
    expect(summary.pinned).toBe(false);
    expect(summary.muted).toBe(false);

    const flagged = toThreadSummary(
      conversationFixture({ id: 'c1', participants, unreadCount: 0, pinned: true, muted: true }),
      ME
    );
    expect(flagged.pinned).toBe(true);
    expect(flagged.muted).toBe(true);
  });

  it("uses the viewer's own nickname for the counterpart in place of their name", () => {
    const nicknamed = [
      participantFixture({
        userId: ME,
        username: 'me',
        displayName: 'Me',
        avatarUrl: null,
        nickname: 'Bestie',
      }),
      participantFixture({
        userId: OTHER,
        username: 'priya_m',
        displayName: 'Priya',
        avatarUrl: null,
      }),
    ];
    const summary = toThreadSummary(
      conversationFixture({ id: 'c1', participants: nicknamed, unreadCount: 0 }),
      ME
    );
    expect(summary.name).toBe('Bestie');
    expect(summary.nickname).toBe('Bestie');

    const view = toMessageView(message({ senderId: OTHER }), {
      participants: nicknamed,
      currentUserId: ME,
      loadedMessages: [],
    });
    expect(view.senderName).toBe('Bestie');
  });

  it('derives shared media from the loaded messages', () => {
    // The info panel read `activeThread.media`, which toThread never produced, so opening the panel
    // threw. The grid now shows real attachments from the pages already fetched.
    const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
    const withMedia = message({
      id: 'm1',
      mediaAssetId: 'asset-1',
      media: { mediaAssetId: 'asset-1', mediaType: 'image', cdnUrl: 'https://cdn/x.jpg' },
    });
    const thread = toThread(conversation, [withMedia, message({ id: 'm2' })], ME);

    expect(Array.isArray(thread.media)).toBe(true);
    expect(thread.media).toHaveLength(1);
    expect(thread.media[0].id).toBe('m1');
    expect(thread.media[0].cdnUrl).toBe('https://cdn/x.jpg');
  });

  it('always produces a media array, even with no history', () => {
    const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
    expect(toThread(conversation, [], ME).media).toEqual([]);
    expect(toThread(conversation, null, ME).media).toEqual([]);
  });

  it('omits attachments on deleted messages', () => {
    const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
    const removed = message({
      id: 'm1',
      isDeleted: true,
      media: { mediaAssetId: 'a', mediaType: 'image', cdnUrl: 'https://cdn/gone.jpg' },
    });
    expect(toThread(conversation, [removed], ME).media).toEqual([]);
  });

  describe('rows', () => {
    it('collapses the avatar across a same-sender run under ten minutes apart, with one separator', () => {
      const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
      const messages = [
        message({ id: 'm3', senderId: OTHER, createdAt: '2026-08-18T10:08:00Z' }),
        message({ id: 'm2', senderId: OTHER, createdAt: '2026-08-18T10:04:00Z' }),
        message({ id: 'm1', senderId: OTHER, createdAt: '2026-08-18T10:00:00Z' }),
      ];
      const thread = toThread(conversation, messages, ME);

      expect(
        thread.rows.map((row) => [row.rowType, row.id, Reflect.get(row, 'showAvatar')])
      ).toEqual([
        ['separator', 'sep-m1', undefined],
        ['message', 'm1', false],
        ['message', 'm2', false],
        ['message', 'm3', true],
      ]);
      expect(
        thread.rows
          .filter((row) => row.rowType === 'message')
          .map((row) => [row.isFirstInRun, row.isLastInRun])
      ).toEqual([
        [true, false],
        [false, false],
        [false, true],
      ]);
    });

    it('breaks the run without a new separator before the one-hour timestamp gap', () => {
      const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
      const messages = [
        message({ id: 'm2', senderId: OTHER, createdAt: '2026-08-18T10:15:00Z' }),
        message({ id: 'm1', senderId: OTHER, createdAt: '2026-08-18T10:00:00Z' }),
      ];
      const thread = toThread(conversation, messages, ME);

      expect(thread.rows.map((row) => row.rowType)).toEqual(['separator', 'message', 'message']);
    });

    it('breaks the run on a sender change without adding a new timestamp separator', () => {
      const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
      const messages = [
        message({ id: 'm2', senderId: ME, createdAt: '2026-08-18T10:01:00Z' }),
        message({ id: 'm1', senderId: OTHER, createdAt: '2026-08-18T10:00:00Z' }),
      ];
      const thread = toThread(conversation, messages, ME);

      expect(thread.rows.map((row) => row.rowType)).toEqual(['separator', 'message', 'message']);
    });

    it('inserts a new separator once the gap reaches one hour', () => {
      const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
      const messages = [
        message({ id: 'm2', senderId: OTHER, createdAt: '2026-08-18T11:00:00Z' }),
        message({ id: 'm1', senderId: OTHER, createdAt: '2026-08-18T10:00:00Z' }),
      ];
      const thread = toThread(conversation, messages, ME);

      expect(thread.rows.map((row) => row.rowType)).toEqual([
        'separator',
        'message',
        'separator',
        'message',
      ]);
    });

    it('never shows an avatar on the viewer own messages, even at the end of a run', () => {
      const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
      const messages = [message({ id: 'm1', senderId: ME })];
      const thread = toThread(conversation, messages, ME);

      expect(thread.rows.find((row) => row.rowType === 'message')!.showAvatar).toBe(false);
    });

    const mediaMessage = (overrides: Partial<Message> & { id: string }) =>
      message({
        content: null,
        mediaAssetId: overrides.id,
        media: {
          mediaAssetId: overrides.id,
          mediaType: 'IMAGE',
          cdnUrl: `https://cdn/${overrides.id}.jpg`,
        },
        ...overrides,
      });

    it('collapses a run of consecutive photo messages from the same sender into one album row', () => {
      const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
      const messages = [
        mediaMessage({ id: 'm3', senderId: OTHER, createdAt: '2026-08-18T10:00:02Z' }),
        mediaMessage({ id: 'm2', senderId: OTHER, createdAt: '2026-08-18T10:00:01Z' }),
        mediaMessage({ id: 'm1', senderId: OTHER, createdAt: '2026-08-18T10:00:00Z' }),
      ];
      const thread = toThread(conversation, messages, ME);

      expect(thread.rows.map((row) => row.rowType)).toEqual(['separator', 'album']);
      const album = thread.rows.find((row) => row.rowType === 'album')!;
      expect(album.items.map((item) => item.id)).toEqual(['m1', 'm2', 'm3']);
      expect(album.from).toBe('them');
      // Solo row in its cluster - both ends of the run - same as a standalone bubble.
      expect(album.isFirstInRun).toBe(true);
      expect(album.isLastInRun).toBe(true);
    });

    it('marks an album that follows a text bubble in the same run as not first', () => {
      const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
      const messages = [
        mediaMessage({ id: 'm3', senderId: OTHER, createdAt: '2026-08-18T10:00:02Z' }),
        mediaMessage({ id: 'm2', senderId: OTHER, createdAt: '2026-08-18T10:00:01Z' }),
        message({
          id: 'm1',
          senderId: OTHER,
          content: 'check these out',
          createdAt: '2026-08-18T10:00:00Z',
        }),
      ];
      const thread = toThread(conversation, messages, ME);

      expect(thread.rows.map((row) => row.rowType)).toEqual(['separator', 'message', 'album']);
      const textRow = thread.rows.find((row) => row.rowType === 'message')!;
      const album = thread.rows.find((row) => row.rowType === 'album')!;
      expect(textRow.isFirstInRun).toBe(true);
      expect(textRow.isLastInRun).toBe(false);
      expect(album.isFirstInRun).toBe(false);
      expect(album.isLastInRun).toBe(true);
    });

    it('leaves a lone photo message as a plain file row, not a one-item album', () => {
      const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
      const messages = [mediaMessage({ id: 'm1', senderId: OTHER })];
      const thread = toThread(conversation, messages, ME);

      expect(thread.rows.map((row) => row.rowType)).toEqual(['separator', 'message']);
      expect(thread.rows[1].rowType === 'message' ? thread.rows[1].kind : undefined).toBe('file');
    });

    it('does not pull a text message sandwiched between photos into the album run', () => {
      const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
      const messages = [
        mediaMessage({ id: 'm3', senderId: OTHER, createdAt: '2026-08-18T10:00:02Z' }),
        message({
          id: 'm2',
          senderId: OTHER,
          content: 'in between',
          createdAt: '2026-08-18T10:00:01Z',
        }),
        mediaMessage({ id: 'm1', senderId: OTHER, createdAt: '2026-08-18T10:00:00Z' }),
      ];
      const thread = toThread(conversation, messages, ME);

      expect(thread.rows.map((row) => row.rowType)).toEqual([
        'separator',
        'message',
        'message',
        'message',
      ]);
    });

    it('only the last row of an album run shows the avatar, matching a plain run', () => {
      const conversation = conversationFixture({ id: 'c1', participants, unreadCount: 0 });
      const messages = [
        mediaMessage({ id: 'm2', senderId: OTHER, createdAt: '2026-08-18T10:00:01Z' }),
        mediaMessage({ id: 'm1', senderId: OTHER, createdAt: '2026-08-18T10:00:00Z' }),
      ];
      const thread = toThread(conversation, messages, ME);

      const album = thread.rows.find((row) => row.rowType === 'album')!;
      expect(album.showAvatar).toBe(true);
    });
  });
});

describe('toPendingThread', () => {
  it('builds an empty thread with id null from a target user profile', () => {
    const thread = toPendingThread(
      profileFixture({
        id: OTHER,
        username: 'priya_m',
        displayName: 'Priya',
        avatarUrl: 'https://cdn/p.jpg',
      })
    );

    expect(thread.id).toBeNull();
    expect(thread.name).toBe('Priya');
    expect(thread.username).toBe('priya_m');
    expect(thread.avatarUrl).toBe('https://cdn/p.jpg');
    expect(thread.counterpartId).toBe(OTHER);
    expect(thread.messages).toEqual([]);
    expect(thread.rows).toEqual([]);
  });

  it('falls back to username when the target has no display name', () => {
    const thread = toPendingThread(
      profileFixture({ id: OTHER, username: 'priya_m', avatarUrl: null })
    );
    expect(thread.name).toBe('priya_m');
  });
});
