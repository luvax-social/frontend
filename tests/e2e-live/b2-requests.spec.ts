import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Api } from './helpers/session';
import { capture, DESKTOP, signIn } from './helpers/session';
import type { Pair } from './helpers/messages';
import {
  bubbleText,
  captureMessagesAtAllWidths,
  claimPairs,
  claimSenderFor,
  conversationRow,
  counts,
  folderOfConversation,
  historyOf,
  inboxTab,
  nameOf,
  openMessages,
  rowIn,
  sendText,
  startConversation,
  startRequest,
} from './helpers/messages';

/**
 * Message requests on the live stack (requirement ids from the interaction control brief):
 * P1-B2-R2 and R3 request status, P1-B2-R4 the single pre-acceptance message, P1-B2-R5 recipient
 * actions and the stealth of a decline, P1-B2-R6 and R7 the Requests and Hidden requests folders
 * and their counts, P1-D1-R8 and P1-D5-R4 the message half of Hidden Words and limits.
 *
 * Every conversation a test starts survives the run, so accounts come from a pool and are
 * claimed only while the pair has never talked (see `claimPairs`).
 */
test.describe.configure({ mode: 'serial' });

let pairs: Pair[] = [];
let storyPair: Pair;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  [storyPair] = await claimPairs(browser, 1, { recipients: ['tobias.notpublic'] });
  pairs = await claimPairs(browser, 6, {
    exclude: [storyPair.sender.username, storyPair.recipient.username],
  });
});

test.afterAll(async () => {
  await Promise.all([storyPair?.dispose(), pairs[0]?.dispose()]);
});

/** A phrase no seeded Hidden Words entry or message contains, made of letters only. */
function uniquePhrase(prefix: string) {
  const letters = Date.now()
    .toString()
    .replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)]);
  return `${prefix}${letters}`;
}

/** Everything the sender can observe about one conversation, for before and after comparisons. */
async function senderView(sender: Api, recipient: Api, conversationId: string) {
  const row = await rowIn(sender, 'primary', conversationId);
  const detail = await sender.call('GET', `/conversations/${conversationId}`);
  const history = await historyOf(sender, conversationId);
  const probe = await sendText(sender, conversationId, 'probe while waiting');
  const reopened = await sender.call<{ id: string; requestStatus: string }>(
    'POST',
    '/conversations',
    {
      targetUserId: recipient.user.id,
    }
  );
  return {
    row,
    detail: { status: detail.status, data: detail.data },
    history: history.map((message) => ({ id: message.id, content: message.content })),
    send: { status: probe.status, code: probe.code },
    reopened: {
      status: reopened.status,
      id: reopened.data?.id,
      request: reopened.data?.requestStatus,
    },
  };
}

function bar(page: Page) {
  return {
    accept: page.getByRole('button', { name: 'accept', exact: true }),
    del: page.getByRole('button', { name: 'delete', exact: true }),
    block: page.getByRole('button', { name: 'block', exact: true }),
  };
}

const composer = (page: Page) => page.getByPlaceholder('Message...');

let first: { conversationId: string; text: string };

test.describe('requests inbox', () => {
  test('P1-B2-R6 P1-B2-R7 a stranger message lands in Requests with its own count and not in Primary', async ({
    browser,
  }) => {
    const { sender, recipient } = pairs[0];
    const before = await counts(recipient);
    const text = `request ${Date.now()} hello from a stranger`;
    const started = await startRequest(sender, recipient, text);
    first = { conversationId: started.conversationId, text };

    expect(await folderOfConversation(recipient, started.conversationId)).toBe('requests');
    const row = await rowIn(recipient, 'requests', started.conversationId);
    expect(row).toMatchObject({
      requestStatus: 'pending',
      isRequestRecipient: true,
      requestHidden: false,
    });
    expect(await rowIn(recipient, 'primary', started.conversationId)).toBeUndefined();
    expect(await rowIn(recipient, 'hidden_requests', started.conversationId)).toBeUndefined();

    const after = await counts(recipient);
    expect(after.requestCount).toBe(before.requestCount + 1);
    expect(after.unreadCount, 'a request never adds to the main unread count').toBe(
      before.unreadCount
    );

    const senderRow = await rowIn(sender, 'primary', started.conversationId);
    expect(senderRow).toMatchObject({
      requestStatus: 'pending',
      isRequestRecipient: false,
      requestHidden: false,
      sendRestriction: 'awaiting_acceptance',
    });

    const view = await signIn(browser, recipient.username);
    try {
      await openMessages(view.page);
      await expect(inboxTab(view.page, 'requests')).toHaveAccessibleName(
        new RegExp(`requests ${after.requestCount}$`)
      );
      await expect(inboxTab(view.page, 'primary')).toHaveAccessibleName('primary');
      await expect(conversationRow(view.page, nameOf(sender))).toHaveCount(0);

      await inboxTab(view.page, 'requests').click();
      await expect(conversationRow(view.page, nameOf(sender))).toBeVisible();
      await expect(view.page.getByRole('button', { name: /^hidden requests/ })).toBeVisible();
      await expect(view.page.getByText(/Requests don't add to your unread count/)).toBeVisible();

      await captureMessagesAtAllWidths(view.page, 'P1-B2-R6', async () => {
        // The list shows its empty state when its request is throttled, which a burst of API
        // calls from the same address can cause, so a missing row gets one fresh load.
        for (let attempt = 0; attempt < 2; attempt += 1) {
          await inboxTab(view.page, 'requests').click();
          const row = conversationRow(view.page, nameOf(sender));
          const shown = await row
            .waitFor({ state: 'visible', timeout: 6_000 })
            .then(() => true)
            .catch(() => false);
          if (shown) break;
          await view.page.reload();
        }
        await expect(conversationRow(view.page, nameOf(sender))).toBeVisible();
      });
    } finally {
      await view.close();
    }
  });

  test('P1-B2-R4 P1-B2-R5 the recipient is offered accept, delete and block and the sender cannot send again', async ({
    browser,
  }) => {
    const { sender, recipient } = pairs[0];
    const recipientView = await signIn(browser, recipient.username);
    const senderView_ = await signIn(browser, sender.username);
    try {
      await openMessages(recipientView.page);
      await inboxTab(recipientView.page, 'requests').click();
      await conversationRow(recipientView.page, nameOf(sender)).click();
      const actions = bar(recipientView.page);
      await expect(actions.accept).toBeVisible();
      await expect(actions.del).toBeVisible();
      await expect(actions.block).toBeVisible();
      await expect(recipientView.page.getByText(first.text, { exact: true })).toBeVisible();
      await expect(composer(recipientView.page)).toHaveCount(0);
      await expect(
        recipientView.page.getByText("you're now connected on luvax"),
        'an unanswered request is not a connection'
      ).toHaveCount(0);
      await capture(recipientView.page, 'P1-B2-R5', DESKTOP.width);

      await openMessages(senderView_.page);
      await conversationRow(senderView_.page, nameOf(recipient)).click();
      await expect(senderView_.page.getByText(first.text, { exact: true })).toBeVisible();
      await expect(
        senderView_.page.getByText(
          `Request sent. You can send more messages after ${nameOf(recipient)} accepts.`
        )
      ).toBeVisible();
      await expect(composer(senderView_.page)).toBeDisabled();
      await expect(senderView_.page.getByText("you're now connected on luvax")).toHaveCount(0);
      await capture(senderView_.page, 'P1-B2-R4', DESKTOP.width);
    } finally {
      await Promise.all([recipientView.close(), senderView_.close()]);
    }

    const second = await sendText(sender, first.conversationId, 'a second message');
    expect(second.status).toBe(409);
    expect(second.code).toBe('MESSAGE_REQUEST_AWAITING_ACCEPTANCE');
    const media = await sender.call('POST', `/conversations/${first.conversationId}/messages`, {
      messageType: 'image',
      mediaAssetId: '00000000-0000-0000-0000-000000000001',
    });
    expect(media.status, 'a pending sender may not send media').toBeGreaterThanOrEqual(400);
  });

  test('P1-B2-R5 P1-B2-R2 accepting moves the request to Primary, opens the composer and keeps it accepted', async ({
    browser,
  }) => {
    const { sender, recipient } = pairs[0];
    const before = await counts(recipient);
    const view = await signIn(browser, recipient.username);
    try {
      await openMessages(view.page);
      await inboxTab(view.page, 'requests').click();
      await conversationRow(view.page, nameOf(sender)).click();
      await bar(view.page).accept.click();

      await expect(inboxTab(view.page, 'primary')).toHaveAttribute('aria-selected', 'true');
      await expect(composer(view.page)).toBeVisible();
      await expect(bar(view.page).accept).toHaveCount(0);

      const reply = `welcome ${Date.now()}`;
      await composer(view.page).fill(reply);
      await composer(view.page).press('Enter');
      await expect(bubbleText(view.page, reply)).toBeVisible();
    } finally {
      await view.close();
    }

    expect(await folderOfConversation(recipient, first.conversationId)).toBe('primary');
    const accepted = await rowIn(recipient, 'primary', first.conversationId);
    expect(accepted?.requestStatus).toBe('accepted');
    expect((await counts(recipient)).requestCount).toBe(before.requestCount - 1);

    const senderRow = await rowIn(sender, 'primary', first.conversationId);
    expect(senderRow).toMatchObject({ requestStatus: 'accepted', sendRestriction: 'none' });
    const free = await sendText(sender, first.conversationId, 'now we can talk');
    expect(free.status).toBe(201);

    // A later change of relationship never demotes an accepted conversation (P1-B2-R3).
    await recipient.call('POST', `/social/follow/${sender.user.id}`);
    await recipient.call('DELETE', `/social/follow/${sender.user.id}`);
    expect((await rowIn(recipient, 'primary', first.conversationId))?.requestStatus).toBe(
      'accepted'
    );
  });

  test('P1-B2-R5 deleting a request hides it from the recipient and the sender sees exactly what a pending request shows', async ({
    browser,
  }) => {
    const { sender, recipient } = pairs[1];
    const text = `delete me ${Date.now()}`;
    const { conversationId } = await startRequest(sender, recipient, text);

    const pending = await senderView(sender, recipient, conversationId);
    expect(pending.send).toEqual({ status: 409, code: 'MESSAGE_REQUEST_AWAITING_ACCEPTANCE' });
    const requestsBefore = (await counts(recipient)).requestCount;

    const view = await signIn(browser, recipient.username);
    try {
      await openMessages(view.page);
      await inboxTab(view.page, 'requests').click();
      await conversationRow(view.page, nameOf(sender)).click();
      await bar(view.page).del.click();
      await expect(view.page.getByText('delete this request?')).toBeVisible();
      await expect(
        view.page.getByText(
          `It will be removed from your requests. ${nameOf(sender)} won't be told.`
        )
      ).toBeVisible();
      // The confirm button stays inert for half a second so a stray second click cannot land.
      await view.page.waitForTimeout(700);
      await view.page.getByRole('button', { name: 'delete', exact: true }).last().click();
      await expect(conversationRow(view.page, nameOf(sender))).toHaveCount(0);
    } finally {
      await view.close();
    }

    expect(await folderOfConversation(recipient, conversationId)).toBeNull();
    expect((await counts(recipient)).requestCount).toBe(requestsBefore - 1);

    const afterDelete = await senderView(sender, recipient, conversationId);
    expect(
      afterDelete,
      'a declined request reads exactly like a pending one to its sender'
    ).toEqual(pending);
    expect(afterDelete.row?.requestStatus).toBe('pending');
    expect(afterDelete.row?.sendRestriction).toBe('awaiting_acceptance');

    const senderUi = await signIn(browser, sender.username);
    try {
      await openMessages(senderUi.page);
      await conversationRow(senderUi.page, nameOf(recipient)).click();
      await expect(senderUi.page.getByText(text, { exact: true })).toBeVisible();
      await expect(
        senderUi.page.getByText(
          `Request sent. You can send more messages after ${nameOf(recipient)} accepts.`
        )
      ).toBeVisible();
      await expect(composer(senderUi.page)).toBeDisabled();
    } finally {
      await senderUi.close();
    }
  });

  test('P1-B2-R5 delete and block removes the request, blocks the sender and tells the sender nothing about the decline', async ({
    browser,
  }) => {
    const { sender, recipient } = pairs[2];
    const { conversationId } = await startRequest(sender, recipient, `block me ${Date.now()}`);
    const pending = await senderView(sender, recipient, conversationId);

    const view = await signIn(browser, recipient.username);
    try {
      await openMessages(view.page);
      await inboxTab(view.page, 'requests').click();
      await conversationRow(view.page, nameOf(sender)).click();
      await bar(view.page).block.click();
      const dialog = view.page.getByRole('dialog', { name: `block @${sender.username}` });
      await expect(dialog).toBeVisible();
      await view.page.waitForTimeout(700);
      await dialog.getByRole('button', { name: 'block', exact: true }).click();
      await expect(conversationRow(view.page, nameOf(sender))).toHaveCount(0);
    } finally {
      await view.close();
    }

    expect(await folderOfConversation(recipient, conversationId)).toBeNull();
    const blocked = await recipient.call<{ content?: { id: string }[] }>(
      'GET',
      '/social/blocked?limit=50'
    );
    expect(JSON.stringify(blocked.data)).toContain(sender.user.id);

    // The sender's list entry and history are unchanged; a block only ever answers as not found.
    const senderRow = await rowIn(sender, 'primary', conversationId);
    expect(senderRow?.requestStatus).toBe(pending.row?.requestStatus);
    expect(senderRow?.sendRestriction).toBe('awaiting_acceptance');
    const after = await sendText(sender, conversationId, 'are you there');
    expect(after.status, 'a block answers a send as not found').toBe(404);
    expect(after.code).toBe('CONVERSATION_NOT_FOUND');
  });

  test('P1-B2-R5 a reply from the recipient accepts the request', async () => {
    const { sender, recipient } = pairs[3];
    const { conversationId } = await startRequest(sender, recipient, `reply accepts ${Date.now()}`);
    expect((await rowIn(recipient, 'requests', conversationId))?.requestStatus).toBe('pending');

    const reply = await sendText(recipient, conversationId, 'replying directly');
    expect(reply.status).toBe(201);

    expect(await folderOfConversation(recipient, conversationId)).toBe('primary');
    expect((await rowIn(recipient, 'primary', conversationId))?.requestStatus).toBe('accepted');
    expect((await rowIn(sender, 'primary', conversationId))?.sendRestriction).toBe('none');
  });

  test('P1-B2-R4 a story reply may be the single request message and a second one is refused', async ({
    browser,
  }) => {
    const { sender, recipient } = storyPair;
    const stories = await recipient.call<{ id: string }[]>(
      'GET',
      `/stories/user/${recipient.user.id}`
    );
    const story = (Array.isArray(stories.data) ? stories.data : []).at(0);
    expect(story, `${recipient.username} has an active story to reply to`).toBeTruthy();

    const conversationId = await startConversation(sender, recipient);
    const reply = await sender.call<{ messageType: string; sharedStoryId: string }>(
      'POST',
      `/conversations/${conversationId}/messages`,
      { messageType: 'story_share', content: 'that view is lovely', sharedStoryId: story!.id }
    );
    expect(reply.status, 'the story reply is the one allowed request message').toBe(201);
    expect(reply.data.messageType).toBe('story_share');

    expect(await folderOfConversation(recipient, conversationId)).toBe('requests');
    const second = await sendText(sender, conversationId, 'and one more');
    expect(second.status).toBe(409);
    expect(second.code).toBe('MESSAGE_REQUEST_AWAITING_ACCEPTANCE');

    const view = await signIn(browser, recipient.username);
    try {
      await openMessages(view.page);
      await inboxTab(view.page, 'requests').click();
      await conversationRow(view.page, nameOf(sender)).click();
      await expect(view.page.getByText('that view is lovely', { exact: true })).toBeVisible();
      await expect(bar(view.page).accept).toBeVisible();
    } finally {
      await view.close();
    }
  });
});

test.describe('hidden requests', () => {
  test('P1-D1-R8 a first message that matches the recipient hidden words goes to Hidden requests and is not counted', async ({
    browser,
  }) => {
    const { sender, recipient } = pairs[4];
    const phrase = uniquePhrase('quillbadger');
    const added = await recipient.call<{ id: string }>('POST', '/users/me/hidden-words', {
      phrase,
    });
    expect(added.status).toBeLessThan(300);
    try {
      const before = await counts(recipient);
      const { conversationId } = await startRequest(sender, recipient, `hello ${phrase} friend`);

      expect(await folderOfConversation(recipient, conversationId)).toBe('hidden_requests');
      const row = await rowIn(recipient, 'hidden_requests', conversationId);
      expect(row).toMatchObject({ requestStatus: 'pending', requestHidden: true });
      expect(await rowIn(recipient, 'requests', conversationId)).toBeUndefined();
      expect((await counts(recipient)).requestCount, 'the hidden folder is never counted').toBe(
        before.requestCount
      );

      const senderRow = await rowIn(sender, 'primary', conversationId);
      expect(senderRow?.requestHidden, 'the sender never learns the request was hidden').toBe(
        false
      );
      expect(senderRow?.sendRestriction).toBe('awaiting_acceptance');

      const view = await signIn(browser, recipient.username);
      try {
        await openMessages(view.page);
        await inboxTab(view.page, 'requests').click();
        await expect(conversationRow(view.page, nameOf(sender))).toHaveCount(0);
        await view.page.getByRole('button', { name: /^hidden requests/ }).click();
        await expect(conversationRow(view.page, nameOf(sender))).toBeVisible();
        await conversationRow(view.page, nameOf(sender)).click();
        await expect(bar(view.page).accept).toBeVisible();
        await capture(view.page, 'P1-D1-R8', DESKTOP.width);

        await bar(view.page).accept.click();
        await expect(inboxTab(view.page, 'primary')).toHaveAttribute('aria-selected', 'true');
      } finally {
        await view.close();
      }
      const accepted = await rowIn(recipient, 'primary', conversationId);
      expect(accepted).toMatchObject({ requestStatus: 'accepted', requestHidden: false });
    } finally {
      await recipient.call('DELETE', `/users/me/hidden-words/${added.data.id}`);
    }
  });

  test('P1-D5-R4 an active limit sends a new request from a non-follower to Hidden requests and ending it stops that', async ({
    browser,
  }) => {
    const { sender, recipient } = pairs[5];
    // A limit on non-followers only catches an account that does not follow the limited one.
    await sender.call('DELETE', `/social/follow/${recipient.user.id}`);
    const limited = await recipient.call('PUT', '/users/me/interaction-limits', {
      limitNonFollowers: true,
      limitRecentFollowers: false,
      durationDays: 1,
    });
    expect(limited.status).toBeLessThan(300);
    try {
      const before = await counts(recipient);
      const { conversationId } = await startRequest(
        sender,
        recipient,
        `limited hello ${Date.now()}`
      );
      expect(await folderOfConversation(recipient, conversationId)).toBe('hidden_requests');
      expect((await rowIn(sender, 'primary', conversationId))?.requestHidden).toBe(false);
      expect((await counts(recipient)).requestCount).toBe(before.requestCount);

      await recipient.call('DELETE', '/users/me/interaction-limits');

      // Limits apply to new writes only: the request already filed stays where it is.
      expect(await folderOfConversation(recipient, conversationId)).toBe('hidden_requests');

      // A limit that was removed no longer filters a request that arrives afterwards.
      const later = await claimSenderFor(
        browser,
        recipient,
        pairs.flatMap((pair) => [pair.sender.username, pair.recipient.username])
      );
      try {
        const fresh = await startRequest(later, recipient, `after the limit ${Date.now()}`);
        expect(await folderOfConversation(recipient, fresh.conversationId)).toBe('requests');
      } finally {
        await later.dispose();
      }
    } finally {
      await recipient.call('DELETE', '/users/me/interaction-limits');
    }
  });
});
