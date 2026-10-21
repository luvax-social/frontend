// The P1-* identifiers in the test titles are the requirement identifiers of the interaction
// control and direct messages work. docs/interaction-control-and-messages/README.md maps each
// one to its behavior and spec file.
// Behavior covered: Interaction limits for non-followers and recent followers: the settings
// form, expiry, which comments and mentions are hidden, and owner review.

import { expect, test } from '@playwright/test';
import { apiSession, capture, commentsSeenBy, itemsOf, postsOf, signIn } from './helpers/session';
import type { Api } from './helpers/session';

type Caller = Api & { dispose: () => Promise<void> };

interface LimitState {
  limitNonFollowers: boolean;
  limitRecentFollowers: boolean;
  expiresAt: string | null;
  active: boolean;
}

interface HiddenComment {
  id: string;
  hiddenReason: string;
}

const HOUR = 3_600_000;

test.describe('limit interactions', () => {
  const sessions: Record<string, Caller> = {};
  const created: { api: Api; id: string }[] = [];

  // One login per account for the group: the login endpoint allows only a few attempts a minute.
  test.beforeAll(async ({ browser }) => {
    for (const name of [
      'user_public',
      'user_new_empty',
      'closet.by.hana',
      'streetwear.atx1',
      'kyle.uni21',
      'arjun.silent2',
      'hunter.finance',
    ]) {
      sessions[name] = await apiSession(browser, name);
    }
  });

  test.afterEach(async () => {
    for (const row of created.splice(0)) await row.api.call('DELETE', `/comments/${row.id}`);
    await sessions.user_public.call('DELETE', '/users/me/interaction-limits');
  });

  test.afterAll(async () => {
    await Promise.all(Object.values(sessions).map((session) => session.dispose()));
  });

  async function firstPostOf(owner: Api) {
    const [post] = await postsOf(owner, owner.user.id, 1);
    return post.id;
  }

  async function commentAs(who: string, postId: string, content: string) {
    const api = sessions[who];
    const result = await api.call<{ id: string }>('POST', `/posts/${postId}/comments`, {
      postId,
      parentId: null,
      content,
    });
    expect(result.status, `${who} comments`).toBe(201);
    created.push({ api, id: result.data.id });
    return result.data.id;
  }

  async function sees(who: string, postId: string, commentId: string) {
    return (await commentsSeenBy(sessions[who], postId)).some((row) => row.id === commentId);
  }

  test('P1-D5-R2 settings turns a limit on for a chosen duration and turns it off early', async ({
    browser,
  }) => {
    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;
    await page.goto('/app/settings/limits');

    const nonFollowers = page.getByRole('switch', { name: "accounts that don't follow you" });
    const recent = page.getByRole('switch', {
      name: 'accounts that followed you in the last 7 days',
    });
    await expect(nonFollowers).toHaveAttribute('aria-checked', 'false');
    await expect(recent).toHaveAttribute('aria-checked', 'false');
    for (const days of ['1 day', '3 days', '7 days', '14 days', '28 days']) {
      await expect(page.getByRole('radio', { name: days })).toBeVisible();
    }
    const turnOn = page.getByRole('button', { name: 'turn on' });
    await expect(turnOn).toBeDisabled();
    await expect(page.getByText('Their new comments on your posts are hidden.')).toBeVisible();
    await expect(page.getByText('Their new message requests go to hidden requests.')).toBeVisible();
    await expect(page.getByText("You won't be notified when they mention you.")).toBeVisible();

    await nonFollowers.click();
    await page.getByRole('radio', { name: '1 day' }).click();
    await capture(page, 'P1-D5-R2', 1440);

    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/users/me/interaction-limits') &&
        response.request().method() === 'PUT'
    );
    await turnOn.click();
    expect((await saved).status()).toBeLessThan(300);
    await expect(page.getByText(/^limits are on until /)).toBeVisible();
    await capture(page, 'P1-D5-R3', 1440);

    const state = await sessions.user_public.call<LimitState>(
      'GET',
      '/users/me/interaction-limits'
    );
    expect(state.data).toMatchObject({
      limitNonFollowers: true,
      limitRecentFollowers: false,
      active: true,
    });
    // One day, stored as an expiry timestamp rather than a counter a job would have to tick.
    const remaining = new Date(state.data.expiresAt!).getTime() - Date.now();
    expect(remaining).toBeGreaterThan(23 * HOUR);
    expect(remaining).toBeLessThan(25 * HOUR);

    await page.getByRole('button', { name: 'turn off now' }).click();
    await expect(page.getByRole('button', { name: 'turn on' })).toBeVisible();
    await expect
      .poll(
        async () =>
          (await sessions.user_public.call<LimitState>('GET', '/users/me/interaction-limits')).data
            .active
      )
      .toBe(false);
    await viewer.close();
  });

  test('P1-D5-R3 a limit past its expiry reads as off and filters nothing', async () => {
    // hunter.finance has a seeded limit whose end date has passed.
    const state = await sessions['hunter.finance'].call<LimitState>(
      'GET',
      '/users/me/interaction-limits'
    );
    expect(state.data.active).toBe(false);
    const postId = await firstPostOf(sessions['hunter.finance']);
    const id = await commentAs('user_new_empty', postId, 'a stranger commenting after expiry');
    expect(await sees('hunter.finance', postId, id)).toBe(true);
    expect(await sees('kyle.uni21', postId, id)).toBe(true);
  });

  test('P1-D5-R4 an active non-follower limit hides a stranger comment from everyone but its author', async () => {
    const postId = await firstPostOf(sessions['closet.by.hana']);
    const stranger = await commentAs('user_new_empty', postId, 'a stranger says hello');
    const follower = await commentAs('user_public', postId, 'a follower says hello');

    expect(await sees('user_new_empty', postId, stranger)).toBe(true);
    expect(await sees('closet.by.hana', postId, stranger)).toBe(false);
    expect(await sees('kyle.uni21', postId, stranger)).toBe(false);
    expect(await sees('closet.by.hana', postId, follower)).toBe(true);

    const hidden = await sessions['closet.by.hana'].call<{ content: HiddenComment[] }>(
      'GET',
      `/posts/${postId}/comments/hidden`
    );
    expect(itemsOf<HiddenComment>(hidden.data).find((row) => row.id === stranger)).toMatchObject({
      hiddenReason: 'limited_interaction',
    });
  });

  test('P1-D5-R1 a recent-followers limit hides an account approved this week and not an older follower', async () => {
    const postId = await firstPostOf(sessions['streetwear.atx1']);
    const recent = await commentAs('kyle.uni21', postId, 'a recent follower says hello');
    const older = await commentAs('arjun.silent2', postId, 'an older follower says hello');
    const stranger = await commentAs('user_new_empty', postId, 'a stranger says hello');

    expect(await sees('streetwear.atx1', postId, recent)).toBe(false);
    expect(await sees('streetwear.atx1', postId, older)).toBe(true);
    // The limit is on recent followers only, so a stranger is not caught by it.
    expect(await sees('streetwear.atx1', postId, stranger)).toBe(true);
  });

  test('P1-D5-R6 the post owner limit decides, not the commenter own limit', async () => {
    // closet.by.hana has a limit, but it covers comments on her own posts.
    const postId = await firstPostOf(sessions.user_public);
    const id = await commentAs('closet.by.hana', postId, 'a limited account commenting elsewhere');
    expect(await sees('user_public', postId, id)).toBe(true);
    expect(await sees('kyle.uni21', postId, id)).toBe(true);
  });

  test('P1-D5-R5 a limit applies to new comments only and a lifted one does not unhide the old ones', async () => {
    const owner = sessions.user_public;
    const postId = await firstPostOf(owner);
    const before = await commentAs('user_new_empty', postId, 'written before the limit');

    const on = await owner.call('PUT', '/users/me/interaction-limits', {
      limitNonFollowers: true,
      limitRecentFollowers: false,
      durationDays: 1,
    });
    expect(on.status).toBeLessThan(300);
    const during = await commentAs('user_new_empty', postId, 'written during the limit');
    expect(await sees('user_public', postId, before)).toBe(true);
    expect(await sees('user_public', postId, during)).toBe(false);

    await owner.call('DELETE', '/users/me/interaction-limits');
    const after = await commentAs('user_new_empty', postId, 'written after the limit');
    expect(await sees('user_public', postId, after)).toBe(true);
    expect(await sees('user_public', postId, during)).toBe(false);
  });

  test('P1-D5-R4 a mention from a limited account produces no notification', async () => {
    // The mention syntax stops at a dot, so the mentioned account needs an underscore handle.
    // Mention notifications are grouped per post, so each phase gets a post of its own that no
    // earlier run has touched.
    const owner = sessions.user_public;
    const author = sessions['hunter.finance'];
    const stamp = Date.now();
    const freshPost = async (label: string) => {
      const result = await author.call<{ id: string }>('POST', '/posts', {
        postType: 'text',
        caption: `${label} ${stamp}`,
      });
      expect(result.status).toBeLessThan(300);
      return result.data.id;
    };
    const aboutPost = async (postId: string) => {
      const result = await owner.call('GET', '/notifications?limit=40');
      return itemsOf<{ type: string; target: { postId: string | null } }>(result.data).filter(
        (item) => item.target.postId === postId && item.type.startsWith('mention')
      );
    };

    // The control must be a follower, whatever the seeded follow graph happens to hold.
    const followed = await author.call('POST', `/social/follow/${owner.user.id}`);
    expect(followed.status).toBeLessThan(300);
    const before = await freshPost('mention before the limit');
    const during = await freshPost('mention during the limit');
    const control = await freshPost('mention control');
    try {
      // Without a limit the same stranger is heard, so the silence below is the limit's doing.
      await commentAs('user_new_empty', before, 'hello @user_public before the limit');
      await expect.poll(async () => (await aboutPost(before)).length, { timeout: 20_000 }).toBe(1);

      const on = await owner.call('PUT', '/users/me/interaction-limits', {
        limitNonFollowers: true,
        limitRecentFollowers: false,
        durationDays: 1,
      });
      expect(on.status).toBeLessThan(300);

      await commentAs('user_new_empty', during, 'hello @user_public from a stranger');
      await commentAs('hunter.finance', control, 'hello @user_public from a follower');

      // The follower mention is the control: once it has arrived the stranger one, posted first,
      // would have arrived too.
      await expect.poll(async () => (await aboutPost(control)).length, { timeout: 20_000 }).toBe(1);
      expect(await aboutPost(during)).toEqual([]);
    } finally {
      for (const id of [before, during, control]) await author.call('DELETE', `/posts/${id}`);
      await author.call('DELETE', `/social/follow/${owner.user.id}`);
    }
  });

  test('P1-D5-R4 the owner reviews a limited comment and unhides it from the post', async ({
    browser,
  }) => {
    const postId = await firstPostOf(sessions['closet.by.hana']);
    const id = await commentAs('user_new_empty', postId, 'a stranger waiting for review');

    const viewer = await signIn(browser, 'closet.by.hana');
    const { page } = viewer;
    await page.goto(`/app/p/${postId}`);
    await page.getByRole('button', { name: 'post options' }).last().click();
    await page.getByRole('button', { name: 'Hidden comments', exact: true }).click();
    await expect(page.getByText('from a limited account').first()).toBeVisible();
    await capture(page, 'P1-D5-R4', 1440);

    const unhidden = page.waitForResponse(
      (response) => response.url().endsWith(`/comments/${id}/unhide`) && response.ok()
    );
    await page.locator(`[data-unhide-for="${id}"]`).click();
    await unhidden;
    expect(await sees('closet.by.hana', postId, id)).toBe(true);
    expect(await sees('kyle.uni21', postId, id)).toBe(true);
    await viewer.close();
  });
});
