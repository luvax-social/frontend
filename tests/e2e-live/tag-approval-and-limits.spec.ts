// The P2-* identifiers in the test titles are the requirement identifiers of the post creation
// work. docs/post-creation/README.md maps each one to its behavior, spec file and screenshots.
// Behavior covered: Who may tag an account and whether tags wait for review, a waiting tag shown
// only to the two people it concerns, approving it from the settings page and from the
// notification, and the Tags settings page itself.

import { expect, test } from '@playwright/test';
import { apiSession, signIn } from './helpers/session';
import {
  createPost,
  deletePost,
  notificationsOf,
  ownedImageAssets,
  readPost,
  readTagSettings,
  setTagSettings,
  shoot,
  shootAtAllWidths,
} from './helpers/postCreation';

const OWNER = 'user_power';
const TAGGED = 'user_public';

async function publishedPhoto(owner: Awaited<ReturnType<typeof apiSession>>, caption: string) {
  const [asset] = await ownedImageAssets(owner, 1);
  return createPost(owner, {
    postType: 'image',
    caption,
    status: 'published',
    media: [{ mediaId: asset }],
  });
}

test.describe('tag permission and approval', () => {
  test('P2-A5-R2 a tag waits for review, is hidden from others, and is approved from settings', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, OWNER);
    const tagged = await apiSession(browser, TAGGED);
    const bystander = await apiSession(browser, 'user_new_empty');
    const original = await readTagSettings(tagged);
    await setTagSettings(tagged, { tagPermission: 'everyone', manualTagApproval: true });
    const post = await publishedPhoto(owner, `waiting tag ${Date.now()}`);

    try {
      const tagResult = await owner.call('PUT', `/posts/${post.id}/tags`, {
        tags: [{ mediaPosition: 0, userId: tagged.user.id, x: 0.4, y: 0.6 }],
      });
      expect(tagResult.status, `tag: ${tagResult.code}`).toBe(200);

      const ownerView = await readPost(owner, post.id);
      expect(ownerView!.media[0].tags[0].status).toBe('pending');
      const bystanderView = await readPost(bystander, post.id);
      expect(bystanderView!.media[0].tags).toHaveLength(0);
      const beforeApproval = await tagged.call<{ content: { id: string }[] }>(
        'GET',
        `/users/${tagged.user.id}/tagged-posts?limit=20`
      );
      expect(beforeApproval.data.content.map((row) => row.id)).not.toContain(post.id);

      const session = await signIn(browser, TAGGED);
      const { page } = session;
      await page.goto('/app/settings/tags');
      await expect(page.getByTestId('tag-requests')).toBeVisible();
      await shoot(page, 'P2-A5-R2', 1440);
      await page
        .getByTestId('tag-request')
        .first()
        .getByRole('button', { name: 'approve', exact: true })
        .click();
      await expect
        .poll(async () => (await readPost(owner, post.id))?.media[0].tags[0]?.status)
        .toBe('approved');
      const afterApproval = await readPost(bystander, post.id);
      expect(afterApproval!.media[0].tags).toHaveLength(1);
      await session.close();
    } finally {
      await deletePost(owner, post.id);
      await setTagSettings(tagged, original);
      await owner.dispose();
      await tagged.dispose();
      await bystander.dispose();
    }
  });

  test('P2-A5-R3 a person who allows no tags or only tags from people they follow refuses the rest', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, OWNER);
    const tagged = await apiSession(browser, TAGGED);
    const original = await readTagSettings(tagged);
    const post = await publishedPhoto(owner, `tag permission ${Date.now()}`);
    const attempt = () =>
      owner.call('PUT', `/posts/${post.id}/tags`, {
        tags: [{ mediaPosition: 0, userId: tagged.user.id, x: 0.5, y: 0.5 }],
      });

    try {
      // The owner is not someone the tagged account follows.
      await tagged.call('DELETE', `/social/follow/${owner.user.id}`);
      await setTagSettings(tagged, { tagPermission: 'nobody', manualTagApproval: false });
      const refusedNobody = await attempt();
      expect(refusedNobody.status).toBeGreaterThanOrEqual(400);
      expect(refusedNobody.code).toBe('POST_TAG_NOT_ALLOWED');

      await setTagSettings(tagged, { tagPermission: 'following', manualTagApproval: false });
      const refusedFollowing = await attempt();
      expect(refusedFollowing.code).toBe('POST_TAG_NOT_ALLOWED');

      await setTagSettings(tagged, { tagPermission: 'everyone', manualTagApproval: false });
      expect((await attempt()).status).toBe(200);
    } finally {
      await deletePost(owner, post.id);
      await setTagSettings(tagged, original);
      await owner.dispose();
      await tagged.dispose();
    }
  });

  test('P2-A5-R2 the Tags settings page saves who can tag the account', async ({ browser }) => {
    const tagged = await apiSession(browser, TAGGED);
    const original = await readTagSettings(tagged);
    await setTagSettings(tagged, { tagPermission: 'everyone', manualTagApproval: false });

    try {
      const session = await signIn(browser, TAGGED);
      const { page } = session;
      await page.goto('/app/settings/tags');
      await expect(page.getByRole('radio', { name: /everyone/ })).toBeChecked();
      await shootAtAllWidths(page, 'P2-A5-R2-settings', async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
      });

      await page.getByRole('radio', { name: /people you follow/ }).click();
      await expect
        .poll(async () => (await readTagSettings(tagged)).tagPermission)
        .toBe('following');
      await page.getByRole('radio', { name: /no one/ }).click();
      await expect.poll(async () => (await readTagSettings(tagged)).tagPermission).toBe('nobody');
      await session.close();
    } finally {
      await setTagSettings(tagged, original);
      await tagged.dispose();
    }
  });

  test('P2-A5-R11 a tag waiting for review notifies the tagged person with approve and remove', async ({
    browser,
  }) => {
    // The notification follows an event that waits its turn behind the other events of the stack.
    test.setTimeout(240_000);
    const owner = await apiSession(browser, OWNER);
    const tagged = await apiSession(browser, TAGGED);
    const original = await readTagSettings(tagged);
    await setTagSettings(tagged, { tagPermission: 'everyone', manualTagApproval: true });
    const post = await publishedPhoto(owner, `tag request notice ${Date.now()}`);

    try {
      const result = await owner.call('PUT', `/posts/${post.id}/tags`, {
        tags: [{ mediaPosition: 0, userId: tagged.user.id, x: 0.3, y: 0.3 }],
      });
      expect(result.status).toBe(200);
      await expect
        .poll(
          async () =>
            (await notificationsOf(tagged)).some(
              (item) => item.type === 'post_tag_request' && item.target.postId === post.id
            ),
          { timeout: 180_000, intervals: [5_000] }
        )
        .toBe(true);

      const session = await signIn(browser, TAGGED);
      await session.page.goto('/app/notifications');
      await expect(session.page.getByText('wants to tag you in a post').first()).toBeVisible();
      await expect(
        session.page.getByRole('button', { name: 'approve', exact: true }).first()
      ).toBeVisible();
      await expect(
        session.page.getByRole('button', { name: 'remove', exact: true }).first()
      ).toBeVisible();
      await shoot(session.page, 'P2-A5-R11-tag-request', 1440);
      await session.page.getByRole('button', { name: 'approve', exact: true }).first().click();
      await expect
        .poll(async () => (await readPost(owner, post.id))?.media[0].tags[0]?.status)
        .toBe('approved');
      await session.close();
    } finally {
      await deletePost(owner, post.id);
      await setTagSettings(tagged, original);
      await owner.dispose();
      await tagged.dispose();
    }
  });
});
