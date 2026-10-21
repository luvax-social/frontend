import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { apiSession, capture, DESKTOP, signIn } from './helpers/session';
import type { Account, Pair } from './helpers/messages';
import {
  bubbleText,
  captureMessagesAtAllWidths,
  chip,
  claimPairs,
  conversationRow,
  historyOf,
  liveSubscribed,
  nameOf,
  openMessages,
  revealActions,
  rowIn,
  sendText,
  startAcceptedConversation,
} from './helpers/messages';

/**
 * Message reactions and reply quotes on the live stack (requirement ids from the interaction
 * control brief): P1-B1-R1 one emoji reaction per person that can be changed and removed,
 * P1-B1-R2 tombstoned messages, P1-B1-R3 live reaction frames, P1-B1-R4 the conversation list
 * preview, and P1-B1-R5 server-resolved reply quotes including an unavailable parent.
 *
 * `a` is the account that starts the conversation and `b` is the account the browser views.
 */
test.describe.configure({ mode: 'serial' });

let pairs: Pair[] = [];
let a: Account;
let b: Account;
let conversationId: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  pairs = await claimPairs(browser, 2);
  a = pairs[0].sender;
  b = pairs[0].recipient;
  conversationId = (await startAcceptedConversation(a, b, `hello ${Date.now()}`)).conversationId;
});

test.afterAll(async () => {
  await pairs[0]?.dispose();
});

async function openThread(page: Page, other: Account) {
  await openMessages(page);
  await conversationRow(page, nameOf(other)).click();
  await expect(page.getByRole('textbox', { name: 'Message...' })).toBeVisible();
}

async function react(page: Page, messageText: string, emoji: string) {
  await revealActions(page, messageText);
  await page.getByRole('button', { name: 'react to message' }).click();
  await page.getByRole('button', { name: `react with ${emoji}` }).click();
}

async function reactionsOn(viewer: Account, messageId: string) {
  const message = (await historyOf(viewer, conversationId)).find((row) => row.id === messageId);
  expect(message, 'message in history').toBeTruthy();
  return message!.reactions.map((reaction) => ({ userId: reaction.userId, emoji: reaction.emoji }));
}

async function reactAs(account: Account, messageId: string, emoji: string) {
  const result = await account.call<{ id: string }>(
    'PUT',
    `/conversations/${conversationId}/messages/${messageId}/reaction`,
    { emoji }
  );
  expect(result.status, `react with ${emoji}`).toBe(200);
  return result.data.id;
}

test('P1-B1-R1 one emoji reaction can be added, changed and removed from the picker', async ({
  browser,
}) => {
  const text = `react to me ${Date.now()}`;
  const sent = await sendText(a, conversationId, text);
  const view = await signIn(browser, b.username);
  try {
    await openThread(view.page, a);
    await expect(bubbleText(view.page, text)).toBeVisible();

    await react(view.page, text, '👍');
    await expect(chip(view.page, '👍')).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(() => reactionsOn(b, sent.data.id))
      .toEqual([{ userId: b.user.id, emoji: '👍' }]);

    await revealActions(view.page, text);
    await view.page.getByRole('button', { name: 'react to message' }).click();
    await expect(view.page.getByRole('button', { name: 'react with 👍' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await capture(view.page, 'P1-B1-R1-picker', DESKTOP.width);
    await view.page.getByRole('button', { name: 'react with ❤️' }).click();
    await expect(chip(view.page, '❤️')).toBeVisible();
    await expect(chip(view.page, '👍')).toHaveCount(0);
    await expect
      .poll(() => reactionsOn(b, sent.data.id), { message: 'a second pick replaces the first' })
      .toEqual([{ userId: b.user.id, emoji: '❤️' }]);

    // Any single emoji is allowed, and anything else is refused before a request is made.
    await revealActions(view.page, text);
    await view.page.getByRole('button', { name: 'react to message' }).click();
    await view.page.getByRole('button', { name: 'choose any emoji' }).click();
    const field = view.page.getByRole('textbox', { name: 'any emoji' });
    await field.fill('ab');
    await field.press('Enter');
    await expect(view.page.getByText('Use one emoji.')).toBeVisible();
    await expect.poll(async () => (await reactionsOn(b, sent.data.id))[0]?.emoji).toBe('❤️');
    await field.fill('🦊');
    await field.press('Enter');
    await expect(chip(view.page, '🦊')).toBeVisible();
    await expect.poll(async () => (await reactionsOn(b, sent.data.id))[0]?.emoji).toBe('🦊');

    // Tapping the highlighted option again, then the chip itself, are the two ways to remove it.
    await revealActions(view.page, text);
    await view.page.getByRole('button', { name: 'react to message' }).click();
    await view.page.getByRole('button', { name: 'react with ❤️' }).click();
    await expect(chip(view.page, '❤️')).toBeVisible();
    await revealActions(view.page, text);
    await view.page.getByRole('button', { name: 'react to message' }).click();
    await view.page.getByRole('button', { name: 'react with ❤️' }).click();
    await expect(chip(view.page, '❤️')).toHaveCount(0);
    await expect.poll(() => reactionsOn(b, sent.data.id)).toEqual([]);

    await react(view.page, text, '😂');
    await expect(chip(view.page, '😂')).toBeVisible();
    await chip(view.page, '😂').click();
    await expect(chip(view.page, '😂')).toHaveCount(0);
    await expect.poll(() => reactionsOn(b, sent.data.id)).toEqual([]);
  } finally {
    await view.close();
  }
});

test('P1-B1-R1 the chip of someone else opens a menu whose report reaction files a report', async ({
  browser,
}) => {
  const text = `report their reaction ${Date.now()}`;
  const sent = await sendText(b, conversationId, text);
  const reactionId = await reactAs(a, sent.data.id, '🔥');

  const view = await signIn(browser, b.username);
  try {
    await openThread(view.page, a);
    await expect(chip(view.page, '🔥')).toBeVisible();
    await expect(chip(view.page, '🔥')).toHaveAttribute('aria-pressed', 'false');
    await chip(view.page, '🔥').click();
    const item = view.page.getByRole('button', { name: 'report reaction' });
    await expect(item).toBeVisible();
    await capture(view.page, 'P1-B1-R1-chip-menu', DESKTOP.width);
    await item.click();

    const dialog = view.page.getByRole('dialog', { name: 'Report reaction' });
    await expect(dialog).toBeVisible();
    await capture(view.page, 'P1-B1-R1-report', DESKTOP.width);
    await dialog.getByRole('button', { name: /^Spam/ }).click();
    await dialog.getByRole('button', { name: 'Continue' }).click();
    const submit = dialog.getByRole('button', { name: 'Submit Report' });
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    const filed = view.page.waitForResponse(
      (response) => response.url().endsWith('/reports') && response.request().method() === 'POST'
    );
    await submit.click();
    const response = await filed;
    expect(response.status()).toBe(201);
    const body = response.request().postDataJSON() as { reportType?: string; entityId?: string };
    expect(body.reportType).toBe('message_reaction');
    expect(body.entityId, 'the report names the reaction, not the message').toBe(reactionId);
  } finally {
    await view.close();
  }

  const admin = await apiSession(browser, 'admin');
  try {
    const queue = await admin.call('GET', '/reports?status=pending&limit=100');
    expect(queue.status).toBe(200);
    expect(JSON.stringify(queue.data)).toContain(reactionId);
  } finally {
    await admin.dispose();
  }
});

test('P1-B1-R5 a reply quotes a parent that is not in the loaded history from the server preview', async ({
  browser,
}) => {
  const quoted = `the very first line ${Date.now()}`;
  const parent = await sendText(a, conversationId, quoted);
  for (let i = 0; i < 34; i += 1) {
    expect((await sendText(a, conversationId, `filler ${i}`)).status).toBe(201);
  }
  const reply = await sendText(b, conversationId, 'replying to the old line', {
    replyToId: parent.data.id,
  });
  expect(reply.status).toBe(201);
  expect(reply.data.replyTo).toMatchObject({
    messageId: parent.data.id,
    senderId: a.user.id,
    messageType: 'text',
    snippet: quoted,
    unavailable: false,
  });

  const view = await signIn(browser, b.username);
  try {
    await openThread(view.page, a);
    await expect(bubbleText(view.page, 'replying to the old line')).toBeVisible();
    await expect(bubbleText(view.page, quoted), 'the parent bubble is not on the page').toHaveCount(
      0
    );
    await expect(view.page.getByText(`${nameOf(a)} - ${quoted}`)).toBeVisible();
  } finally {
    await view.close();
  }
});

test('P1-B1-R5 replying from the thread sends the reply target and shows the quote', async ({
  browser,
}) => {
  const text = `please quote this ${Date.now()}`;
  const parent = await sendText(a, conversationId, text);
  const view = await signIn(browser, b.username);
  try {
    await openThread(view.page, a);
    await revealActions(view.page, text);
    await view.page.getByRole('button', { name: 'reply to message' }).click();
    const composer = view.page.getByPlaceholder('write a reply...');
    await expect(composer).toBeVisible();
    const answer = `quoted answer ${Date.now()}`;
    await composer.fill(answer);
    await composer.press('Enter');
    await expect(bubbleText(view.page, answer)).toBeVisible();
    await expect(view.page.getByText(`${nameOf(a)} - ${text}`)).toBeVisible();

    const stored = (await historyOf(b, conversationId)).find((row) => row.content === answer);
    expect(stored?.replyToId).toBe(parent.data.id);
    expect(stored?.replyTo?.snippet).toBe(text);
  } finally {
    await view.close();
  }
});

test('P1-B1-R5 a quote of a deleted or moderator removed message reads message unavailable', async ({
  browser,
}) => {
  const deletedText = `deleted parent ${Date.now()}`;
  const removedText = `removed parent ${Date.now()}`;
  const deleted = await sendText(a, conversationId, deletedText);
  const removed = await sendText(a, conversationId, removedText);
  const replyToDeleted = await sendText(b, conversationId, 'answer to the deleted one', {
    replyToId: deleted.data.id,
  });
  const replyToRemoved = await sendText(b, conversationId, 'answer to the removed one', {
    replyToId: removed.data.id,
  });
  expect(replyToDeleted.data.replyTo?.unavailable).toBe(false);

  expect(
    (await a.call('DELETE', `/conversations/${conversationId}/messages/${deleted.data.id}`)).status
  ).toBeLessThan(300);
  const admin = await apiSession(browser, 'admin');
  try {
    const taken = await admin.call('PATCH', `/admin/messages/${removed.data.id}/remove`, {
      reason: 'live check of an unavailable quote',
    });
    expect(taken.status).toBeLessThan(300);

    const history = await historyOf(b, conversationId);
    for (const id of [replyToDeleted.data.id, replyToRemoved.data.id]) {
      const row = history.find((message) => message.id === id);
      expect(row?.replyTo, 'the quote of a hidden parent').toMatchObject({
        unavailable: true,
        snippet: null,
      });
    }

    const view = await signIn(browser, b.username);
    try {
      await openThread(view.page, a);
      await expect(bubbleText(view.page, 'answer to the removed one')).toBeVisible();
      await expect(view.page.getByText('message unavailable')).toHaveCount(2);
      await expect(view.page.getByText(deletedText)).toHaveCount(0);
      await expect(view.page.getByText(removedText)).toHaveCount(0);
    } finally {
      await view.close();
    }

    // An administrative restore returns the parent and with it the quote, a sender deletion does not.
    const restored = await admin.call('PATCH', `/admin/messages/${removed.data.id}/restore`, {
      reason: 'live check of an unavailable quote',
    });
    expect(restored.status).toBeLessThan(300);
    const after = (await historyOf(b, conversationId)).find(
      (message) => message.id === replyToRemoved.data.id
    );
    expect(after?.replyTo).toMatchObject({ unavailable: false, snippet: removedText });
  } finally {
    await admin.dispose();
  }
});

test('P1-B1-R3 a reaction set by one participant appears for the other without a reload and disappears when removed', async ({
  browser,
}) => {
  const text = `watch this live ${Date.now()}`;
  const sent = await sendText(b, conversationId, text);
  const viewer = await signIn(browser, b.username);
  const reactor = await signIn(browser, a.username);
  try {
    const subscribed = liveSubscribed(viewer.page, `/topic/conversations.${conversationId}`);
    await openThread(viewer.page, a);
    await openThread(reactor.page, b);
    await subscribed;
    await expect(bubbleText(viewer.page, text)).toBeVisible();
    await expect(bubbleText(reactor.page, text)).toBeVisible();

    await react(reactor.page, text, '😮');
    await expect(chip(reactor.page, '😮')).toBeVisible();
    await expect(chip(viewer.page, '😮')).toBeVisible({ timeout: 15_000 });
    await expect(chip(viewer.page, '😮')).toHaveAttribute('aria-pressed', 'false');

    await react(reactor.page, text, '😢');
    await expect(chip(viewer.page, '😢')).toBeVisible({ timeout: 15_000 });
    await expect(chip(viewer.page, '😮')).toHaveCount(0);

    await chip(reactor.page, '😢').click();
    await expect(chip(viewer.page, '😢')).toHaveCount(0, { timeout: 15_000 });
    await expect.poll(() => reactionsOn(b, sent.data.id)).toEqual([]);
  } finally {
    await Promise.all([viewer.close(), reactor.close()]);
  }
});

test('P1-B1-R4 the conversation list previews a reaction without adding unread or moving the conversation', async ({
  browser,
}) => {
  const text = `a message to react to ${Date.now()}`;
  const sent = await sendText(b, conversationId, text);
  // A reaction is stamped by the database clock and a message by the server's, so a reaction
  // that lands within a few milliseconds of its message can sort before it. A person never does.
  await new Promise((resolve) => setTimeout(resolve, 400));
  const before = await rowIn(b, 'primary', conversationId);
  await reactAs(a, sent.data.id, '🔥');
  const after = await rowIn(b, 'primary', conversationId);

  expect(after?.lastReaction).toMatchObject({ emoji: '🔥', messageId: sent.data.id });
  expect(after?.unreadCount).toBe(before?.unreadCount);
  expect(after?.lastMessage?.id).toBe(before?.lastMessage?.id);

  const view = await signIn(browser, b.username);
  try {
    await openMessages(view.page);
    await expect(conversationRow(view.page, nameOf(a))).toContainText(
      `${nameOf(a)} reacted 🔥 to your message`
    );
    await capture(view.page, 'P1-B1-R4', DESKTOP.width);
  } finally {
    await view.close();
  }
});

test('P1-B1-R2 a message its sender deleted hides its reactions and cannot be reacted to', async ({
  browser,
}) => {
  const text = `soon deleted ${Date.now()}`;
  const sent = await sendText(a, conversationId, text);
  await reactAs(b, sent.data.id, '😮');

  const view = await signIn(browser, b.username);
  try {
    await openThread(view.page, a);
    await expect(chip(view.page, '😮')).toBeVisible();

    expect(
      (await a.call('DELETE', `/conversations/${conversationId}/messages/${sent.data.id}`)).status
    ).toBeLessThan(300);
    await view.page.reload();
    await expect(view.page.getByRole('tablist', { name: 'inbox folders' })).toBeVisible();
    await conversationRow(view.page, nameOf(a)).click();
    await expect(view.page.getByRole('textbox', { name: 'Message...' })).toBeVisible();
    await expect(bubbleText(view.page, text)).toHaveCount(0);
    await expect(chip(view.page, '😮')).toHaveCount(0);
    await expect(view.page.getByRole('button', { name: 'react to message' })).toHaveCount(0);
  } finally {
    await view.close();
  }

  const row = (await historyOf(b, conversationId)).find((message) => message.id === sent.data.id);
  expect(row?.isDeleted).toBe(true);
  expect(row?.reactions).toEqual([]);
  const refused = await b.call(
    'PUT',
    `/conversations/${conversationId}/messages/${sent.data.id}/reaction`,
    { emoji: '👍' }
  );
  expect(refused.status).toBeGreaterThanOrEqual(400);
});

test('P1-B1-R2 a moderator removal hides reactions from both participants and a restore brings them back', async ({
  browser,
}) => {
  const text = `moderated ${Date.now()}`;
  const sent = await sendText(a, conversationId, text);
  await reactAs(b, sent.data.id, '👍');
  const admin = await apiSession(browser, 'admin');
  try {
    expect(await reactionsOn(a, sent.data.id)).toHaveLength(1);
    const removed = await admin.call('PATCH', `/admin/messages/${sent.data.id}/remove`, {
      reason: 'live check of hidden reactions',
    });
    expect(removed.status).toBeLessThan(300);

    for (const viewer of [a, b]) {
      const row = (await historyOf(viewer, conversationId)).find(
        (message) => message.id === sent.data.id
      );
      expect(row?.reactions, `${viewer.username} sees no reactions on a removed message`).toEqual(
        []
      );
    }
    const refused = await a.call(
      'PUT',
      `/conversations/${conversationId}/messages/${sent.data.id}/reaction`,
      { emoji: '❤️' }
    );
    expect(refused.status).toBeGreaterThanOrEqual(400);

    const restored = await admin.call('PATCH', `/admin/messages/${sent.data.id}/restore`, {
      reason: 'live check of hidden reactions',
    });
    expect(restored.status).toBeLessThan(300);
    expect(await reactionsOn(a, sent.data.id)).toEqual([{ userId: b.user.id, emoji: '👍' }]);
  } finally {
    await admin.dispose();
  }
});

test('P1-B1-R1 P1-B1-R5 the chat thread with reactions and a quote at every width', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const { sender: c, recipient: d } = pairs[1];
  const first = await startAcceptedConversation(c, d, 'are you free for lunch');
  const lunch = `lunch at one by the river ${Date.now()}`;
  const proposal = await sendText(c, first.conversationId, lunch);
  const answer = await sendText(d, first.conversationId, 'yes, one works well for me', {
    replyToId: proposal.data.id,
  });
  expect(answer.status).toBe(201);
  const reacted = await d.call(
    'PUT',
    `/conversations/${first.conversationId}/messages/${proposal.data.id}/reaction`,
    { emoji: '❤️' }
  );
  expect(reacted.status).toBe(200);
  const theirs = await c.call(
    'PUT',
    `/conversations/${first.conversationId}/messages/${answer.data.id}/reaction`,
    { emoji: '😂' }
  );
  expect(theirs.status).toBe(200);

  const gone = await sendText(c, first.conversationId, 'that one did not age well');
  await sendText(d, first.conversationId, 'agreed, take it down', { replyToId: gone.data.id });
  await c.call('DELETE', `/conversations/${first.conversationId}/messages/${gone.data.id}`);

  const view = await signIn(browser, d.username);
  try {
    await captureMessagesAtAllWidths(view.page, 'P1-B1-R1', async () => {
      await conversationRow(view.page, nameOf(c)).click();
      await expect(bubbleText(view.page, 'yes, one works well for me')).toBeVisible();
      await expect(chip(view.page, '❤️')).toBeVisible();
      await expect(chip(view.page, '😂')).toBeVisible();
      await expect(view.page.getByText('message unavailable')).toBeVisible();
    });
    await openMessages(view.page);
    await conversationRow(view.page, nameOf(c)).click();
    await expect(view.page.getByText('message unavailable')).toBeVisible();
    await capture(view.page, 'P1-B1-R5-unavailable', DESKTOP.width);
  } finally {
    await view.close();
  }
});
