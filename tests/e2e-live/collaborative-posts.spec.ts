// The P2-* identifiers in the test titles are the requirement identifiers of the post creation
// work. docs/post-creation/README.md maps each one to its behavior, spec file and screenshots.
// Behavior covered: Inviting co-authors from the composer, the invitation and its answer in the
// notification feed, a co-author appearing on the post and the profile only after accepting, the
// limit of three, and a co-author leaving.

import { expect, test } from '@playwright/test';
import { apiSession, signIn, userIdOf } from './helpers/session';
import {
  createPost,
  deleteAllHeld,
  deletePost,
  notificationsOf,
  readPost,
  shoot,
  shootAtAllWidths,
} from './helpers/postCreation';

const OWNER = 'user_power';
const CO_AUTHOR = 'user_public';

const postCountOf = async (api: Awaited<ReturnType<typeof apiSession>>, userId: string) => {
  const result = await api.call<{ postCount: number }>('GET', `/users/${userId}`);
  expect(result.status).toBe(200);
  return result.data.postCount;
};

test.describe('collaborative posts', () => {
  test('P2-A5-R6 an owner invites a co-author from the composer and the invitation waits', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, OWNER);
    const invitee = await apiSession(browser, CO_AUTHOR);
    await deleteAllHeld(owner);
    const caption = `invited from the composer ${Date.now()}`;
    const draft = await createPost(owner, { postType: 'text', caption, status: 'draft' });

    try {
      const session = await signIn(browser, OWNER);
      const { page } = session;
      await page.goto(`/app/compose?draft=${draft.id}`);
      await expect(page.getByPlaceholder('title')).toHaveValue(caption);
      await page.getByTestId('option-collaborators').click();
      const picker = page.getByTestId('collab-picker');
      await expect(picker).toBeVisible();
      await picker.getByLabel('search people to invite').fill(CO_AUTHOR);
      await picker.locator(`[data-person="${CO_AUTHOR}"]`).click();
      await shoot(page, 'P2-A5-R6', 1440);
      await picker.getByRole('button', { name: 'done' }).click();
      await expect(page.getByTestId('option-collaborators')).toContainText(CO_AUTHOR);
      await page.getByTestId('publish-post').click();
      await page.waitForURL(/\/app$/);

      const published = await readPost(owner, draft.id);
      expect(published?.status).toBe('published');
      const row = published!.collaborators.find((entry) => entry.user.username === CO_AUTHOR);
      expect(row?.status).toBe('invited');

      // An invited person is not yet on the post or on their own profile.
      const before = await postCountOf(invitee, invitee.user.id);
      const bystander = await apiSession(browser, 'user_new_empty');
      const seen = await readPost(bystander, draft.id);
      expect(seen!.collaborators.filter((entry) => entry.status === 'accepted')).toHaveLength(0);
      await bystander.dispose();

      const accepted = await invitee.call('POST', `/posts/${draft.id}/collaboration/accept`);
      expect(accepted.status, `accept: ${accepted.code}`).toBeLessThan(300);
      await expect.poll(async () => postCountOf(invitee, invitee.user.id)).toBe(before + 1);

      const profile = await invitee.call<{ content: { id: string }[] }>(
        'GET',
        `/posts/user/${invitee.user.id}?limit=20`
      );
      expect(profile.data.content.map((post) => post.id)).toContain(draft.id);
      await session.close();
    } finally {
      await deletePost(owner, draft.id);
      await owner.dispose();
      await invitee.dispose();
    }
  });

  test('P2-A5-R7 an accepted co-author appears in the byline and can leave the post', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, OWNER);
    const coAuthor = await apiSession(browser, CO_AUTHOR);
    const post = await createPost(owner, {
      postType: 'text',
      caption: `shared byline ${Date.now()}`,
      status: 'published',
      collaboratorIds: [coAuthor.user.id],
    });
    const accepted = await coAuthor.call('POST', `/posts/${post.id}/collaboration/accept`);
    expect(accepted.status).toBeLessThan(300);

    try {
      const reader = await signIn(browser, 'user_new_empty');
      const { page } = reader;
      await page.goto(`/app/p/${post.id}`);
      const byline = page.locator('.lx-scrim').getByTestId('post-byline').first();
      await expect(byline).toContainText(owner.user.displayName ?? OWNER);
      await expect(byline).toContainText(coAuthor.user.displayName ?? CO_AUTHOR);
      await shootAtAllWidths(page, 'P2-A5-R7', async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
      });
      await reader.close();

      const before = await postCountOf(coAuthor, coAuthor.user.id);
      const session = await signIn(browser, CO_AUTHOR);
      await session.page.goto(`/app/p/${post.id}`);
      await session.page
        .locator('.lx-scrim')
        .getByRole('button', { name: 'post options' })
        .first()
        .click();
      await session.page.getByRole('button', { name: 'Leave this post', exact: true }).click();
      await expect(session.page.getByText('You left this post.')).toBeVisible();
      await expect.poll(async () => postCountOf(coAuthor, coAuthor.user.id)).toBe(before - 1);
      const after = await readPost(owner, post.id);
      expect(after?.collaborators.some((entry) => entry.status === 'accepted')).toBe(false);
      await session.close();
    } finally {
      await deletePost(owner, post.id);
      await owner.dispose();
      await coAuthor.dispose();
    }
  });

  test('P2-A5-R6 a post has at most three co-authors', async ({ browser }) => {
    const owner = await apiSession(browser, OWNER);
    const names = ['user_public', 'user_new_empty', 'mod1', 'user_private'];
    const ids = [];
    for (const name of names) ids.push(await userIdOf(owner, name));
    const post = await createPost(owner, {
      postType: 'text',
      caption: `three at most ${Date.now()}`,
      status: 'published',
    });

    try {
      const three = await owner.call('PUT', `/posts/${post.id}/collaborators`, {
        userIds: ids.slice(0, 3),
      });
      expect(three.status, `three: ${three.code}`).toBe(200);
      const four = await owner.call('PUT', `/posts/${post.id}/collaborators`, { userIds: ids });
      expect(four.status).toBeGreaterThanOrEqual(400);
    } finally {
      await deletePost(owner, post.id);
      await owner.dispose();
    }
  });

  test('P2-A5-R11 the invitation and its acceptance reach the notification feed', async ({
    browser,
  }) => {
    // Both notifications follow events that wait their turn behind the other events of the stack.
    test.setTimeout(300_000);
    const owner = await apiSession(browser, OWNER);
    const invitee = await apiSession(browser, CO_AUTHOR);
    const post = await createPost(owner, {
      postType: 'text',
      caption: `invitation notices ${Date.now()}`,
      status: 'published',
      collaboratorIds: [invitee.user.id],
    });

    try {
      await expect
        .poll(
          async () =>
            (await notificationsOf(invitee)).some(
              (item) => item.type === 'post_collaboration_invite' && item.target.postId === post.id
            ),
          { timeout: 200_000, intervals: [5_000] }
        )
        .toBe(true);

      const session = await signIn(browser, CO_AUTHOR);
      await session.page.goto('/app/notifications');
      await expect(
        session.page.getByText('invited you to be a co-author of a post').first()
      ).toBeVisible();
      await shoot(session.page, 'P2-A5-R11-invite', 1440);
      await session.page.getByRole('button', { name: 'accept', exact: true }).first().click();
      await expect
        .poll(
          async () =>
            (await readPost(owner, post.id))?.collaborators.find(
              (entry) => entry.user.username === CO_AUTHOR
            )?.status
        )
        .toBe('accepted');

      await expect
        .poll(
          async () =>
            (await notificationsOf(owner)).some(
              (item) =>
                item.type === 'post_collaboration_accepted' && item.target.postId === post.id
            ),
          { timeout: 200_000, intervals: [5_000] }
        )
        .toBe(true);
      const ownerSession = await signIn(browser, OWNER);
      await ownerSession.page.goto('/app/notifications');
      await expect(
        ownerSession.page.getByText('accepted your invitation to co-author a post').first()
      ).toBeVisible();
      await shoot(ownerSession.page, 'P2-A5-R11-accepted', 1440);
      await ownerSession.close();
      await session.close();
    } finally {
      await deletePost(owner, post.id);
      await owner.dispose();
      await invitee.dispose();
    }
  });
});
