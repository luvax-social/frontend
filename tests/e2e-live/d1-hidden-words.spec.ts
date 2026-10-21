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
} from './helpers/session';
import type { Api } from './helpers/session';

type Caller = Api & { dispose: () => Promise<void> };

interface HiddenWordEntry {
  id: string;
  phrase: string;
}

interface CommentView {
  id: string;
  hiddenReason?: string;
}

async function myWords(api: Api): Promise<HiddenWordEntry[]> {
  const result = await api.call<{ entries: HiddenWordEntry[] }>('GET', '/users/me/hidden-words');
  expect(result.status).toBe(200);
  return result.data.entries;
}

async function removeWord(api: Api, phrase: string) {
  for (const entry of (await myWords(api)).filter((word) => word.phrase === phrase)) {
    await api.call('DELETE', `/users/me/hidden-words/${entry.id}`);
  }
}

async function comment(api: Api, postId: string, content: string, parentId?: string) {
  const result = await api.call<{ id: string }>('POST', `/posts/${postId}/comments`, {
    postId,
    parentId: parentId ?? null,
    content,
  });
  return result;
}

async function seesComment(api: Api, postId: string, commentId: string) {
  return (await commentsSeenBy(api, postId)).some((row) => row.id === commentId);
}

async function commentCount(api: Api, postId: string) {
  const result = await api.call<{ commentCount: number }>('GET', `/posts/${postId}`);
  expect(result.status).toBe(200);
  return result.data.commentCount;
}

test.describe('hidden words', () => {
  let owner: Caller;
  let commenter: Caller;
  let bystander: Caller;
  let postId: string;
  const created: { api: Api; id: string }[] = [];

  // One login per account for the whole group: the login endpoint allows only a few attempts a
  // minute per account, and a token outlives the group by a wide margin.
  test.beforeAll(async ({ browser }) => {
    owner = await apiSession(browser, 'user_public');
    commenter = await apiSession(browser, 'hunter.finance');
    bystander = await apiSession(browser, 'user_power');
    const [post] = await postsOf(owner, owner.user.id, 1);
    postId = post.id;
  });

  test.afterEach(async () => {
    for (const row of created.splice(0)) await row.api.call('DELETE', `/comments/${row.id}`);
  });

  test.afterAll(async () => {
    await Promise.all([owner.dispose(), commenter.dispose(), bystander.dispose()]);
  });

  /** Posts a comment as `api` and remembers it so the spec leaves the post as it found it. */
  async function post(api: Api, content: string, parentId?: string) {
    const result = await comment(api, postId, content, parentId);
    expect(result.status, `comment "${content}"`).toBe(201);
    created.push({ api, id: result.data.id });
    return result.data.id;
  }

  test('P1-D1-R3 settings shows the platform switch and a personal list that previews what it matches', async ({
    browser,
  }) => {
    const phrase = 'Quà Tặng Miễn Phí';
    await removeWord(owner, phrase);
    const settings = await owner.call<{ hiddenWordsSystemEnabled: boolean }>(
      'GET',
      '/users/me/settings'
    );
    expect(settings.data.hiddenWordsSystemEnabled).toBe(true);

    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;
    await page.goto('/app/settings/hidden-words');
    const toggle = page.getByRole('switch', { name: 'use the luvax list' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    const list = page.getByRole('list', { name: 'your hidden words' });
    await expect(list).toContainText('free followers');
    await expect(list).toContainText('promo code');

    const field = page.getByRole('textbox', { name: 'add a word or phrase' });
    await field.fill(phrase);
    await expect(page.getByText('Matches "qua tang mien phi"')).toBeVisible();
    await capture(page, 'P1-D1-R3', 1440);
    await page.getByRole('button', { name: 'add', exact: true }).click();
    await expect(list).toContainText(phrase);
    await expect
      .poll(async () => (await myWords(owner)).map((word) => word.phrase))
      .toContain(phrase);

    await page.getByRole('button', { name: `remove ${phrase}` }).click();
    await expect(list).not.toContainText(phrase);
    await expect
      .poll(async () => (await myWords(owner)).map((word) => word.phrase))
      .not.toContain(phrase);

    // The platform switch saves on change and is put back afterwards.
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/users/me/settings') && response.request().method() === 'PATCH'
    );
    await toggle.click();
    expect((await saved).status()).toBeLessThan(300);
    expect(
      (await owner.call<{ hiddenWordsSystemEnabled: boolean }>('GET', '/users/me/settings')).data
        .hiddenWordsSystemEnabled
    ).toBe(false);
    await owner.call('PATCH', '/users/me/settings', { hiddenWordsSystemEnabled: true });
    await viewer.close();
  });

  test('P1-D1-R4 matching folds case, diacritics and leetspeak and matches whole tokens only', async () => {
    const hidden = [
      'Get FREE FOLLOWERS today',
      'fr33 f0llowers here',
      'Frée Fóllowers for you',
      'free   followers, really',
    ];
    const visible = ['free followership is a thing', 'freefollowers', 'followers for free'];

    const vietnamese = 'lừa đảo';
    await removeWord(owner, vietnamese);
    const added = await owner.call('POST', '/users/me/hidden-words', { phrase: vietnamese });
    expect(added.status).toBeLessThan(300);
    hidden.push('Đây là LUA DAO đấy');

    try {
      const hiddenIds = [];
      for (const text of hidden) hiddenIds.push([text, await post(commenter, text)] as const);
      const visibleIds = [];
      for (const text of visible) visibleIds.push([text, await post(commenter, text)] as const);

      for (const [text, id] of hiddenIds) {
        expect(await seesComment(owner, postId, id), `owner sees "${text}"`).toBe(false);
        expect(await seesComment(commenter, postId, id), `author sees "${text}"`).toBe(true);
      }
      for (const [text, id] of visibleIds) {
        expect(await seesComment(owner, postId, id), `owner sees "${text}"`).toBe(true);
      }
    } finally {
      await removeWord(owner, vietnamese);
    }
  });

  test('P1-D1-R2 the spam heuristics still reject rather than hide', async () => {
    const shouting = await comment(
      commenter,
      postId,
      'THIS IS A VERY LOUD COMMENT WITH NO LOWERCASE AT ALL, REALLY'
    );
    const repeated = await comment(commenter, postId, 'buy buy buy buy buy buy buy buy buy buy');
    for (const result of [shouting, repeated]) {
      if (result.status === 201) created.push({ api: commenter, id: result.data.id });
    }
    expect(shouting.status).toBeGreaterThanOrEqual(400);
    expect(shouting.status).toBeLessThan(500);
    expect(repeated.status).toBeGreaterThanOrEqual(400);
    expect(repeated.status).toBeLessThan(500);
  });

  test('P1-D1-R5 only the post owner list applies, so a word from someone else is not hidden', async () => {
    const theirs = (await myWords(bystander)).map((word) => word.phrase);
    const ours = (await myWords(owner)).map((word) => word.phrase);
    const foreign = theirs.find((phrase) => !ours.includes(phrase));
    expect(foreign, 'user_power has a phrase user_public does not').toBeTruthy();
    const id = await post(commenter, `thoughts on ${foreign} please`);
    expect(await seesComment(owner, postId, id)).toBe(true);
  });

  test('P1-D1-R6 a matching comment is hidden from everyone but its author, counts and notifications included', async () => {
    const before = await commentCount(owner, postId);
    const id = await post(commenter, 'free followers right here');

    expect(await seesComment(commenter, postId, id)).toBe(true);
    expect(await seesComment(owner, postId, id)).toBe(false);
    expect(await seesComment(bystander, postId, id)).toBe(false);
    expect(await commentCount(owner, postId)).toBe(before);
    expect(await commentCount(bystander, postId)).toBe(before);
    expect((await bystander.call('GET', `/comments/${id}/context`)).status).toBe(404);

    const reviewed = await owner.call<{ content: CommentView[] }>(
      'GET',
      `/posts/${postId}/comments/hidden`
    );
    expect(itemsOf<CommentView>(reviewed.data).find((row) => row.id === id)?.hiddenReason).toBe(
      'hidden_words'
    );

    // A visible comment from someone else reaches the owner; once it has, the hidden one would
    // have too, so its absence is not a matter of timing.
    const control = await post(bystander, 'a perfectly ordinary comment');
    await expect
      .poll(
        async () => {
          const result = await owner.call<{ content: { target: { commentId: string | null } }[] }>(
            'GET',
            '/notifications?limit=30'
          );
          return itemsOf<{ target: { commentId: string | null } }>(result.data).map(
            (item) => item.target.commentId
          );
        },
        { timeout: 20_000 }
      )
      .toContain(control);
    const notifications = await owner.call('GET', '/notifications?limit=30');
    expect(JSON.stringify(notifications.data)).not.toContain(id);
    expect(JSON.stringify(notifications.data)).not.toContain('free followers right here');
  });

  test('P1-D1-R7 the post owner reviews hidden comments and unhides one, which then counts', async ({
    browser,
  }) => {
    const id = await post(commenter, 'free followers for the owner to review');
    const before = await commentCount(owner, postId);

    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;
    await page.goto(`/app/p/${postId}`);

    const review = async () => {
      await page.getByRole('button', { name: 'post options' }).last().click();
      await page.getByRole('button', { name: 'Hidden comments', exact: true }).click();
      await expect(page.getByText('hidden comments', { exact: true })).toBeVisible();
    };
    await review();
    await expect(page.getByText('matched your hidden words').first()).toBeVisible();
    await expect(page.getByText('only you can see these')).toBeVisible();
    await capture(page, 'P1-D1-R7', 1440);

    for (const size of ALL_WIDTHS) {
      if (size.width === 1440) continue;
      await page.setViewportSize(size);
      await expect(page.getByText('hidden comments', { exact: true })).toBeVisible();
      await capture(page, 'P1-D1-R7', size.width);
      if (size.width === 390) await expectNoHorizontalScroll(page);
    }
    await page.setViewportSize(DESKTOP);

    const unhidden = page.waitForResponse(
      (response) => response.url().endsWith(`/comments/${id}/unhide`) && response.ok()
    );
    await page.locator(`[data-unhide-for="${id}"]`).click();
    await unhidden;
    await expect(page.locator(`[data-unhide-for="${id}"]`)).toHaveCount(0);

    expect(await seesComment(owner, postId, id)).toBe(true);
    expect(await seesComment(bystander, postId, id)).toBe(true);
    expect(await commentCount(owner, postId)).toBe(before + 1);
    await viewer.close();
  });

  test('P1-D1-R9 adding a phrase does not hide comments that were already posted', async () => {
    const phrase = 'sunrise';
    await removeWord(owner, phrase);
    const id = await post(commenter, 'what a lovely sunrise');
    expect(await seesComment(owner, postId, id)).toBe(true);
    try {
      await owner.call('POST', '/users/me/hidden-words', { phrase });
      expect(await seesComment(owner, postId, id)).toBe(true);
      expect(await seesComment(bystander, postId, id)).toBe(true);
      const later = await post(commenter, 'another sunrise photo');
      expect(await seesComment(owner, postId, later)).toBe(false);
    } finally {
      await removeWord(owner, phrase);
    }
  });
});

test.describe('platform hidden words', () => {
  test('P1-D1-R1 an administrator adds, edits and removes a platform phrase, each with a reason that is audited', async ({
    browser,
  }) => {
    const admin = await signIn(browser, 'admin');
    const owner = await apiSession(browser, 'user_public');
    const commenter = await apiSession(browser, 'hunter.finance');
    const [target] = await postsOf(owner, owner.user.id, 1);
    const { page } = admin;
    const created: string[] = [];

    const phrase = 'zebra crossing promo';
    const reworded = 'zebra crossing giveaway';
    const reasons = {
      add: 'Seen in a spam wave this week',
      edit: 'Reworded to match the new wave',
      remove: 'Wave is over',
    };
    const listed = async () => {
      const result = await admin.call<{ content: { id: string; phrase: string }[] }>(
        'GET',
        '/admin/hidden-words?limit=100'
      );
      return itemsOf<{ id: string; phrase: string }>(result.data);
    };
    for (const stale of (await listed()).filter((row) => [phrase, reworded].includes(row.phrase))) {
      await admin.call('DELETE', `/admin/hidden-words/${stale.id}`, { reason: 'test cleanup' });
    }

    try {
      await page.goto('/admin/hidden-words');
      const seeded = await listed();
      expect(seeded.length).toBeGreaterThanOrEqual(8);
      await expect(page.getByText(seeded[0].phrase).first()).toBeVisible();
      await capture(page, 'P1-D1-R1', 1440);

      await page.getByRole('button', { name: 'add word' }).click();
      await page.locator('#hidden-word-phrase').fill(phrase);
      await page.locator('#hidden-word-reason').fill(reasons.add);
      await page.getByRole('button', { name: 'save' }).click();
      await expect
        .poll(async () => (await listed()).some((row) => row.phrase === phrase))
        .toBe(true);
      const row = (await listed()).find((entry) => entry.phrase === phrase)!;
      created.push(row.id);

      // A new platform phrase hides a matching comment from the owner who keeps the list on.
      const hit = await comment(commenter, target.id, `big ${phrase} today`);
      expect(hit.status).toBe(201);
      expect(await seesComment(owner, target.id, hit.data.id)).toBe(false);
      await commenter.call('DELETE', `/comments/${hit.data.id}`);

      await page.getByRole('button', { name: `edit ${phrase}` }).click();
      await page.locator('#hidden-word-phrase').fill(reworded);
      await page.locator('#hidden-word-reason').fill(reasons.edit);
      await page.getByRole('button', { name: 'save' }).click();
      await expect
        .poll(async () => (await listed()).some((entry) => entry.phrase === reworded))
        .toBe(true);

      await page.getByRole('button', { name: `edit ${reworded}` }).click();
      await page.locator('#hidden-word-reason').fill(reasons.remove);
      await page.getByRole('button', { name: 'delete' }).click();
      await expect
        .poll(async () => (await listed()).some((entry) => entry.phrase === reworded))
        .toBe(false);
      created.length = 0;

      const actions = await admin.call<{ content: { actionType: string; reason: string }[] }>(
        'GET',
        '/admin/actions?limit=20'
      );
      const recent = itemsOf<{ actionType: string; reason: string }>(actions.data);
      for (const [type, reason] of [
        ['create_hidden_word', reasons.add],
        ['edit_hidden_word', reasons.edit],
        ['delete_hidden_word', reasons.remove],
      ]) {
        expect(
          recent.some((action) => action.actionType === type && action.reason === reason),
          type
        ).toBe(true);
      }
    } finally {
      for (const id of created) {
        await admin.call('DELETE', `/admin/hidden-words/${id}`, { reason: 'test cleanup' });
      }
      await Promise.all([admin.close(), owner.dispose(), commenter.dispose()]);
    }
  });
});
