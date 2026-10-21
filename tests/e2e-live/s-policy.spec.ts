import { expect, test } from '@playwright/test';
import {
  ALL_WIDTHS,
  DESKTOP,
  apiSession,
  capture,
  commentsSeenBy,
  expectNoHorizontalScroll,
  itemsOf,
  postsOf,
  signIn,
  userIdOf,
} from './helpers/session';
import type { Api } from './helpers/session';

type Caller = Api & { dispose: () => Promise<void> };

interface HiddenComment {
  id: string;
  hiddenReason: string;
}

/**
 * The interaction policy answers every write path the same way, so these specs drive comments,
 * replies, edits and conversation creation and read the outcome from what each account sees.
 * Messages are covered in depth by the direct message specs; here only the refusals that the
 * policy decides before any message exists.
 */
test.describe('interaction policy', () => {
  const who: Record<string, Caller> = {};
  const created: { api: Api; id: string }[] = [];

  test.beforeAll(async ({ browser }) => {
    for (const name of [
      'user_public',
      'user_new_empty',
      'closet.by.hana',
      'hunter.finance',
      'user_power',
    ]) {
      who[name] = await apiSession(browser, name);
    }
  });

  test.afterEach(async () => {
    for (const row of created.splice(0)) await row.api.call('DELETE', `/comments/${row.id}`);
  });

  test.afterAll(async () => {
    await Promise.all(Object.values(who).map((session) => session.dispose()));
  });

  async function firstPostOf(owner: string) {
    const [post] = await postsOf(who[owner], who[owner].user.id, 1);
    return post.id;
  }

  async function write(as: string, postId: string, content: string, parentId?: string) {
    const result = await who[as].call<{ id: string }>('POST', `/posts/${postId}/comments`, {
      postId,
      parentId: parentId ?? null,
      content,
    });
    if (result.status === 201) created.push({ api: who[as], id: result.data.id });
    return result;
  }

  async function sees(as: string, postId: string, commentId: string) {
    return (await commentsSeenBy(who[as], postId)).some((row) => row.id === commentId);
  }

  test('P1-S-R2 an allowed and an allow-hidden comment look the same to the person writing them', async () => {
    const postId = await firstPostOf('closet.by.hana');
    const allowed = await write('user_public', postId, 'a follower comment');
    const hidden = await write('user_new_empty', postId, 'a stranger comment');
    expect(allowed.status).toBe(201);
    expect(hidden.status).toBe(201);
    expect(Object.keys(hidden.data).sort()).toEqual(Object.keys(allowed.data).sort());
    expect(await sees('user_public', postId, allowed.data.id)).toBe(true);
    expect(await sees('closet.by.hana', postId, hidden.data.id)).toBe(false);
    expect(await sees('user_new_empty', postId, hidden.data.id)).toBe(true);
  });

  test('P1-S-R3 a block is decided before the limit, so the comment is refused rather than hidden', async () => {
    const hana = who['closet.by.hana'];
    const stranger = await userIdOf(hana, 'user_new_empty');
    const postId = await firstPostOf('closet.by.hana');
    expect((await hana.call('POST', `/social/block/${stranger}`)).status).toBeLessThan(300);
    try {
      // A block with the post owner is already visible through the post itself, so the answer
      // is the restricted one rather than not found.
      const refused = await write('user_new_empty', postId, 'a blocked stranger comment');
      expect(refused.status).toBe(403);
      expect(refused.code).toBe('POST_COMMENTING_RESTRICTED');
    } finally {
      await hana.call('DELETE', `/social/block/${stranger}`);
    }
    const allowed = await write('user_new_empty', postId, 'a stranger comment after unblocking');
    expect(allowed.status).toBe(201);
  });

  test('P1-S-R3 a block is decided before hidden words, so a matching comment is refused rather than hidden', async () => {
    const owner = who.user_public;
    const hunter = await userIdOf(owner, 'hunter.finance');
    const postId = await firstPostOf('user_public');
    expect((await owner.call('POST', `/social/block/${hunter}`)).status).toBeLessThan(300);
    try {
      const refused = await write('hunter.finance', postId, 'free followers for everyone');
      expect(refused.status).toBe(403);
      expect(refused.code).toBe('POST_COMMENTING_RESTRICTED');
    } finally {
      await owner.call('DELETE', `/social/block/${hunter}`);
    }
  });

  test('P1-S-R3 a reply to a comment whose author blocked the replier answers as not found', async () => {
    const postId = await firstPostOf('user_power');
    const parent = await write('hunter.finance', postId, 'a comment from someone who blocks');
    const hunter = who['hunter.finance'];
    const stranger = await userIdOf(hunter, 'user_new_empty');
    expect((await hunter.call('POST', `/social/block/${stranger}`)).status).toBeLessThan(300);
    try {
      const refused = await write('user_new_empty', postId, 'a reply', parent.data.id);
      expect(refused.status).toBe(404);
    } finally {
      await hunter.call('DELETE', `/social/block/${stranger}`);
    }
  });

  test('P1-S-R4 a reply is evaluated like a comment and stays hidden from the owner', async () => {
    const postId = await firstPostOf('closet.by.hana');
    const parent = await write('user_new_empty', postId, 'a stranger parent comment');
    const reply = await write('user_new_empty', postId, 'a stranger replying', parent.data.id);
    expect(reply.status).toBe(201);
    expect(await sees('closet.by.hana', postId, parent.data.id)).toBe(false);
    expect(await sees('closet.by.hana', postId, reply.data.id)).toBe(false);

    const hidden = await who['closet.by.hana'].call<{ content: HiddenComment[] }>(
      'GET',
      `/posts/${postId}/comments/hidden`
    );
    const rows = itemsOf<HiddenComment>(hidden.data);
    expect(rows.find((row) => row.id === parent.data.id)?.hiddenReason).toBe('limited_interaction');
    expect(['limited_interaction', 'hidden_parent']).toContain(
      rows.find((row) => row.id === reply.data.id)?.hiddenReason
    );
  });

  test('P1-S-R4 editing a comment into a hidden word is evaluated like writing one', async () => {
    const postId = await firstPostOf('user_public');
    const clean = await write('hunter.finance', postId, 'a perfectly clean comment');
    expect(await sees('user_public', postId, clean.data.id)).toBe(true);

    const edited = await who['hunter.finance'].call('PATCH', `/comments/${clean.data.id}`, {
      content: 'now with free followers inside',
    });
    expect(edited.status).toBe(200);
    expect(await sees('user_public', postId, clean.data.id)).toBe(false);
    expect(await sees('hunter.finance', postId, clean.data.id)).toBe(true);
  });

  test('P1-S-R4 starting a conversation honours who can message me before anything is created', async () => {
    const stranger = who.user_new_empty;
    const nobody = await userIdOf(stranger, 'kevin.backend');
    const followingOnly = await userIdOf(stranger, 'james.carter.dev');

    const before = await stranger.call('GET', '/conversations');
    for (const target of [nobody, followingOnly]) {
      const refused = await stranger.call('POST', '/conversations', { targetUserId: target });
      expect(refused.status, `conversation with ${target}`).toBe(403);
      expect(refused.code).toBe('MESSAGE_REQUEST_NOT_ALLOWED');
    }
    const after = await stranger.call('GET', '/conversations');
    expect(JSON.stringify(after.data)).toBe(JSON.stringify(before.data));
  });

  test('P1-B2-R1 privacy settings show who can message you and save the choice', async ({
    browser,
  }) => {
    const viewer = await signIn(browser, 'user_new_empty');
    const { page } = viewer;
    await page.goto('/app/settings/privacy');
    await expect(page.getByText('who can message you')).toBeVisible();
    const everyone = page.getByRole('radio', { name: /^everyone/ });
    await expect(everyone).toBeChecked();

    for (const size of ALL_WIDTHS) {
      await page.setViewportSize(size);
      await expect(page.getByText('who can message you')).toBeVisible();
      await capture(page, 'P1-B2-R1', size.width);
      if (size.width === 390) await expectNoHorizontalScroll(page);
    }
    await page.setViewportSize(DESKTOP);

    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/users/me/settings') && response.request().method() === 'PATCH'
    );
    await page.getByRole('radio', { name: /^no one/ }).click();
    expect((await saved).status()).toBeLessThan(300);
    const stored = await who.user_new_empty.call<{ messagePermission: string }>(
      'GET',
      '/users/me/settings'
    );
    expect(stored.data.messagePermission).toBe('nobody');
    await who.user_new_empty.call('PATCH', '/users/me/settings', { messagePermission: 'everyone' });
    await viewer.close();
  });
});
