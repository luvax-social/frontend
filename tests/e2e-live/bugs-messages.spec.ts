import { expect, test } from '@playwright/test';
import type { Pair } from './helpers/messages';
import {
  claimPairs,
  folderOfConversation,
  historyOf,
  sendText,
  startAcceptedConversation,
} from './helpers/messages';

/**
 * The two message fixes of the interaction control phase, driven through the HTTP API the way
 * the client calls it. P1-BUGS-1 is the send idempotency key ignoring the reply target and
 * P1-BUGS-2 is the send block guard skipping a peer who had left the conversation.
 */

let pairs: Pair[] = [];

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  pairs = await claimPairs(browser, 2);
});

test.afterAll(async () => {
  await pairs[0]?.dispose();
});

test('P1-BUGS-1 reusing a send key with another reply target is a conflict and never replays the old quote', async () => {
  const { sender: a, recipient: b } = pairs[0];
  const { conversationId } = await startAcceptedConversation(a, b, `bug one ${Date.now()}`);
  const first = await sendText(a, conversationId, 'the first line');
  const second = await sendText(a, conversationId, 'the second line');
  const key = `reply-target-${Date.now()}`;

  const sent = await sendText(
    b,
    conversationId,
    'hi',
    { replyToId: first.data.id },
    {
      'Idempotency-Key': key,
    }
  );
  expect(sent.status).toBe(201);
  expect(sent.data.replyToId).toBe(first.data.id);

  const retried = await sendText(
    b,
    conversationId,
    'hi',
    { replyToId: first.data.id },
    {
      'Idempotency-Key': key,
    }
  );
  expect(retried.status, 'the same request is replayed').toBe(201);
  expect(retried.data.id).toBe(sent.data.id);

  const changed = await sendText(
    b,
    conversationId,
    'hi',
    { replyToId: second.data.id },
    {
      'Idempotency-Key': key,
    }
  );
  expect(changed.status, 'a different reply target under the same key').toBe(409);
  expect(changed.code).toBe('MESSAGE_IDEMPOTENCY_CONFLICT');

  const replies = (await historyOf(b, conversationId)).filter(
    (message) => message.content === 'hi'
  );
  expect(replies, 'one stored message and no second quote').toHaveLength(1);
  expect(replies[0].replyToId).toBe(first.data.id);
});

test('P1-BUGS-2 a send to a peer who left and then blocked the sender is refused as not found and revives nothing', async () => {
  const { sender: a, recipient: b } = pairs[1];
  const { conversationId } = await startAcceptedConversation(a, b, `bug two ${Date.now()}`);
  expect((await sendText(b, conversationId, 'one more from me')).status).toBe(201);

  const left = await b.call('DELETE', `/conversations/${conversationId}`);
  expect(left.status).toBeLessThan(300);
  expect(await folderOfConversation(b, conversationId)).toBeNull();

  const blocked = await b.call('POST', `/social/block/${a.user.id}`);
  expect(blocked.status).toBeLessThan(300);
  try {
    const refused = await sendText(a, conversationId, 'are you still there');
    expect(refused.status, 'a block answers as not found').toBe(404);
    expect(refused.code).toBe('CONVERSATION_NOT_FOUND');

    expect(
      await folderOfConversation(b, conversationId),
      'the peer who left stays out of the conversation'
    ).toBeNull();
    const delivered = (await historyOf(a, conversationId)).some(
      (message) => message.content === 'are you still there'
    );
    expect(delivered, 'the refused message is not stored').toBe(false);
  } finally {
    await b.call('DELETE', `/social/block/${a.user.id}`);
  }
});
