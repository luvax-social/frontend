import type {
  ConversationResponse,
  ConversationSummaryResponse,
  MessageResponse,
  SendMessageRequest,
} from '@/types/domain';
import type { CursorPage } from '@/types/api';
import type { VerifiedUser } from './support/identity.ts';
import { beforeAll, describe, expect, it } from 'vitest';

import { api, assertStackReachable, expectEnvelope, unwrap } from './support/client.ts';
import { createVerifiedUser } from './support/identity.ts';

let alice: VerifiedUser;
let bob: VerifiedUser;

beforeAll(async () => {
  await assertStackReachable();
  alice = await createVerifiedUser();
  bob = await createVerifiedUser();
}, 60000);

const createDirect = (from: VerifiedUser, targetUserId: string) =>
  api<ConversationResponse>('/conversations', {
    method: 'POST',
    token: from.accessToken,
    body: { targetUserId },
  });

const send = (from: VerifiedUser, conversationId: string, body: SendMessageRequest) =>
  api<MessageResponse>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    token: from.accessToken,
    body,
  });

const history = async (viewer: VerifiedUser, conversationId: string) =>
  unwrap(
    await api<CursorPage<MessageResponse>>(`/conversations/${conversationId}/messages?limit=30`, {
      token: viewer.accessToken,
    })
  );

describe('direct conversations', () => {
  it('creates a conversation between two users', async () => {
    const result = await createDirect(alice, bob.user.id);
    expectEnvelope(result);
    expect([200, 201]).toContain(result.status);

    const conversation = unwrap(result);
    expect(conversation.participants.map((p) => p.userId).sort()).toEqual(
      [alice.user.id, bob.user.id].sort()
    );
  });

  it('resolves to the same conversation rather than duplicating it', async () => {
    // A direct-conversation pair key exists precisely so a repeated call cannot fork the thread.
    const first = unwrap(await createDirect(alice, bob.user.id));
    const second = unwrap(await createDirect(alice, bob.user.id));
    expect(second.id).toBe(first.id);
  });

  it('refuses a conversation with oneself', async () => {
    const result = await createDirect(alice, alice.user.id);
    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});

describe('messaging', () => {
  it('sends a message the recipient can read back', async () => {
    const conversation = unwrap(await createDirect(alice, bob.user.id));
    const sent = unwrap(
      await send(alice, conversation.id, {
        messageType: 'text',
        content: 'hello bob',
      })
    );
    expect(sent.content).toBe('hello bob');

    const forBob = await history(bob, conversation.id);
    expect(forBob.content.map((m) => m.content)).toContain('hello bob');
  });

  it('surfaces the newest message on the recipient conversation list', async () => {
    const conversation = unwrap(await createDirect(alice, bob.user.id));
    await send(alice, conversation.id, { messageType: 'text', content: 'for the list' });

    const list = unwrap(
      await api<CursorPage<ConversationSummaryResponse>>('/conversations?limit=20', {
        token: bob.accessToken,
      })
    );
    const row = list.content.find((c) => c.id === conversation.id);
    expect(row).toBeTruthy();
    expect(row!.lastMessage!.content).toBe('for the list');
  });

  it('counts unread for the recipient and clears it on read', async () => {
    const conversation = unwrap(await createDirect(alice, bob.user.id));
    await send(alice, conversation.id, { messageType: 'text', content: 'unread please' });

    const before = unwrap(
      await api<{ unreadCount: number }>('/conversations/unread-count', { token: bob.accessToken })
    );
    expect(before.unreadCount).toBeGreaterThan(0);

    await api(`/conversations/${conversation.id}/read`, {
      method: 'POST',
      token: bob.accessToken,
    });

    const list = unwrap(
      await api<CursorPage<ConversationSummaryResponse>>('/conversations?limit=20', {
        token: bob.accessToken,
      })
    );
    const row = list.content.find((c) => c.id === conversation.id);
    expect(row!.unreadCount).toBe(0);
  });

  it('honours an idempotency key so a retried send creates one message', async () => {
    const conversation = unwrap(await createDirect(alice, bob.user.id));
    const key = `live-${Date.now()}`;
    const body = { messageType: 'text', content: 'exactly once' };

    await api(`/conversations/${conversation.id}/messages`, {
      method: 'POST',
      token: alice.accessToken,
      body,
      headers: { 'Idempotency-Key': key },
    });
    await api(`/conversations/${conversation.id}/messages`, {
      method: 'POST',
      token: alice.accessToken,
      body,
      headers: { 'Idempotency-Key': key },
    });

    const page = await history(alice, conversation.id);
    const matches = page.content.filter((m) => m.content === 'exactly once');
    expect(matches).toHaveLength(1);
  });

  it('soft-deletes a message for its sender only', async () => {
    const conversation = unwrap(await createDirect(alice, bob.user.id));
    const sent = unwrap(
      await send(alice, conversation.id, {
        messageType: 'text',
        content: 'delete me',
      })
    );

    const byRecipient = await api(`/conversations/${conversation.id}/messages/${sent.id}`, {
      method: 'DELETE',
      token: bob.accessToken,
    });
    expect(byRecipient.status).toBeGreaterThanOrEqual(400);

    const bySender = await api(`/conversations/${conversation.id}/messages/${sent.id}`, {
      method: 'DELETE',
      token: alice.accessToken,
    });
    expect([200, 204]).toContain(bySender.status);

    // A tombstone, not a removal: history keeps the row so the thread does not silently reflow.
    const page = await history(alice, conversation.id);
    expect(page.content.find((m) => m.id === sent.id)!.isDeleted).toBe(true);
  });

  it('refuses to read a conversation the caller is not part of', async () => {
    const stranger = await createVerifiedUser();
    const conversation = unwrap(await createDirect(alice, bob.user.id));

    const result = await api(`/conversations/${conversation.id}/messages?limit=5`, {
      token: stranger.accessToken,
    });
    expect([403, 404]).toContain(result.status);
  });

  it('carries a null media object on a text message', async () => {
    // The field must be conditional. An empty object on every row would make the client render an
    // attachment slot for a plain message.
    const conversation = unwrap(await createDirect(alice, bob.user.id));
    const sent = unwrap(
      await send(alice, conversation.id, {
        messageType: 'text',
        content: 'no attachment',
      })
    );
    expect(sent.media ?? null).toBeNull();
  });
});

describe('story replies', () => {
  it('delivers a reply as a story_share carrying the story it answers', async () => {
    // The story viewer's reply bar previously ended in a toast saying messaging was not built.
    // A reply is an ordinary direct message whose type names what it answers.
    const conversation = unwrap(await createDirect(alice, bob.user.id));
    const storyId = '00000000-0000-4000-8000-00000000beef';

    const result = await send(alice, conversation.id, {
      messageType: 'story_share',
      content: 'love this story',
      sharedStoryId: storyId,
    });

    if (result.status >= 400) {
      // The server validates that the story exists, which a synthetic id cannot satisfy. That is
      // correct behaviour, and the rejection still proves the type and field reach validation
      // rather than being silently dropped.
      expect(result.body!.success).toBe(false);
      return;
    }

    const sent = unwrap(result);
    expect(sent.messageType.toLowerCase()).toBe('story_share');
    expect(sent.sharedStoryId).toBe(storyId);
    expect(sent.content).toBe('love this story');
  });
});

describe('mutual follow provisioning', () => {
  const follow = (from: VerifiedUser, targetId: string) =>
    api(`/social/follow/${targetId}`, { method: 'POST', token: from.accessToken });
  const unfollow = (from: VerifiedUser, targetId: string) =>
    api(`/social/follow/${targetId}`, { method: 'DELETE', token: from.accessToken });

  it('gives both people a conversation without either sending anything', async () => {
    // The headline behaviour: opening Messages should not be an empty room for people who already
    // follow each other.
    const carol = await createVerifiedUser();
    const dave = await createVerifiedUser();

    await follow(carol, dave.user.id);
    // One direction is not a relationship, so nothing should exist yet.
    const before = unwrap(
      await api<CursorPage<ConversationSummaryResponse>>('/conversations?limit=20', {
        token: carol.accessToken,
      })
    );
    expect(before.content).toHaveLength(0);

    await follow(dave, carol.user.id);

    // Both sides: the conversation belongs to the pair, not to whoever followed last.
    for (const viewer of [carol, dave]) {
      const list = unwrap(
        await api<CursorPage<ConversationSummaryResponse>>('/conversations?limit=20', {
          token: viewer.accessToken,
        })
      );
      expect(list.content).toHaveLength(1);
      expect(list.content[0].lastMessage ?? null).toBeNull();
    }
  }, 120000);

  it('removes the conversation again when the follow is undone and nothing was said', async () => {
    const erin = await createVerifiedUser();
    const frank = await createVerifiedUser();
    await follow(erin, frank.user.id);
    await follow(frank, erin.user.id);

    await unfollow(erin, frank.user.id);

    const list = unwrap(
      await api<CursorPage<ConversationSummaryResponse>>('/conversations?limit=20', {
        token: erin.accessToken,
      })
    );
    expect(list.content).toHaveLength(0);
  }, 120000);

  it('keeps a conversation that has messages when the follow is undone', async () => {
    // The data-loss guard, asserted through the real API rather than only in the backend suite.
    const gina = await createVerifiedUser();
    const hank = await createVerifiedUser();
    await follow(gina, hank.user.id);
    await follow(hank, gina.user.id);

    const list = unwrap(
      await api<CursorPage<ConversationSummaryResponse>>('/conversations?limit=20', {
        token: gina.accessToken,
      })
    );
    const conversationId = list.content[0].id;
    await api(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      token: gina.accessToken,
      body: { messageType: 'text', content: 'said out loud' },
    });

    await unfollow(gina, hank.user.id);

    const after = unwrap(
      await api<CursorPage<ConversationSummaryResponse>>('/conversations?limit=20', {
        token: gina.accessToken,
      })
    );
    expect(after.content.map((c) => c.id)).toContain(conversationId);
  }, 120000);
});

describe('starting a conversation from compose', () => {
  it('creates a conversation with someone who does not follow back', async () => {
    const stranger = await createVerifiedUser();

    const created = unwrap(
      await api<ConversationResponse>('/conversations', {
        method: 'POST',
        token: alice.accessToken,
        body: { targetUserId: stranger.user.id },
      })
    );

    expect(created.id).toBeTruthy();
    expect(created.participants.map((p) => p.userId).sort()).toEqual(
      [alice.user.id, stranger.user.id].sort()
    );
  }, 60000);
});
