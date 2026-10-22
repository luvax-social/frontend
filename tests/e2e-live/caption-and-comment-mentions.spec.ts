// The P2-* identifiers in the test titles are the requirement identifiers of the post creation
// work. docs/post-creation/README.md maps each one to its behavior, spec file and screenshots.
// Behavior covered: Caption mentions stored by account id when a draft is saved and notified when
// it is published, an edit changing the stored mentions without a second notification, and stored
// mentions rendering as links in captions and comments while any other @name stays plain text.

import { expect, test } from '@playwright/test';
import { apiSession, signIn } from './helpers/session';
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
const MENTIONED = 'user_public';

test.describe('caption and comment mentions', () => {
  test('P2-A5-R10 a draft stores its caption mentions and publishing notifies once', async ({
    browser,
  }) => {
    // The notification follows an event that waits its turn behind the other events of the stack.
    test.setTimeout(300_000);
    const owner = await apiSession(browser, OWNER);
    const mentioned = await apiSession(browser, MENTIONED);
    await deleteAllHeld(owner);
    const stamp = Date.now();
    const draft = await createPost(owner, {
      postType: 'text',
      caption: `hello @${MENTIONED} and @nobody_here_${stamp} ${stamp}`,
      status: 'draft',
    });

    try {
      // Saved as a draft the mention is stored, and nobody is told.
      expect(draft.mentions.map((mention) => mention.username)).toEqual([MENTIONED]);
      const quiet = (await notificationsOf(mentioned)).filter(
        (item) => item.type === 'mention_post' && item.target.postId === draft.id
      );
      expect(quiet).toHaveLength(0);

      const move = await owner.call('PATCH', `/posts/${draft.id}/status`, {
        targetStatus: 'published',
      });
      expect(move.status, `publish: ${move.code}`).toBeLessThan(300);

      await expect
        .poll(
          async () =>
            (await notificationsOf(mentioned)).filter(
              (item) => item.type === 'mention_post' && item.target.postId === draft.id
            ).length,
          { timeout: 200_000, intervals: [5_000] }
        )
        .toBe(1);

      // The mention links to the account, and a name nobody holds stays plain text.
      const reader = await signIn(browser, 'user_new_empty');
      const { page } = reader;
      await page.goto(`/app/p/${draft.id}`);
      const overlay = page.locator('.lx-scrim');
      await expect(overlay.locator(`[data-mention="${MENTIONED}"]`).first()).toBeVisible();
      await expect(overlay.getByText(`@nobody_here_${stamp}`).first()).toBeVisible();
      expect(await overlay.locator(`[data-mention="nobody_here_${stamp}"]`).count()).toBe(0);
      await shootAtAllWidths(page, 'P2-A5-R10', async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
      });
      await overlay.locator(`[data-mention="${MENTIONED}"]`).first().click();
      await page.waitForURL(new RegExp(`/app/u/${mentioned.user.id}`));
      await reader.close();

      // An edit re-reads the mentions and tells nobody again.
      const edit = await owner.call('PATCH', `/posts/${draft.id}`, {
        caption: `hello again @user_new_empty ${stamp}`,
      });
      expect(edit.status, `edit: ${edit.code}`).toBe(200);
      const edited = await readPost(owner, draft.id);
      expect(edited?.mentions.map((mention) => mention.username)).toEqual(['user_new_empty']);
      expect(
        (await notificationsOf(mentioned)).filter(
          (item) => item.type === 'mention_post' && item.target.postId === draft.id
        )
      ).toHaveLength(1);
    } finally {
      await deletePost(owner, draft.id);
      await owner.dispose();
      await mentioned.dispose();
    }
  });

  test('P2-A5-R10 a stored mention in a comment is a link and any other @name is plain text', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, OWNER);
    const commenter = await apiSession(browser, 'user_new_empty');
    const stamp = Date.now();
    const post = await createPost(owner, {
      postType: 'text',
      caption: `comments carry mentions ${stamp}`,
      status: 'published',
    });

    try {
      const comment = await commenter.call<{ mentions: { username: string }[] }>(
        'POST',
        `/posts/${post.id}/comments`,
        { postId: post.id, parentId: null, content: `@${MENTIONED} take a look, @ghost_${stamp}` }
      );
      expect(comment.status, `comment: ${comment.code}`).toBe(201);
      expect(comment.data.mentions.map((mention) => mention.username)).toEqual([MENTIONED]);

      const reader = await signIn(browser, OWNER);
      const { page } = reader;
      await page.goto(`/app/p/${post.id}`);
      const overlay = page.locator('.lx-scrim');
      await expect(overlay.locator(`[data-mention="${MENTIONED}"]`).first()).toBeVisible();
      await expect(overlay.getByText(`@ghost_${stamp}`).first()).toBeVisible();
      expect(await overlay.locator(`[data-mention="ghost_${stamp}"]`).count()).toBe(0);
      await shoot(page, 'P2-A5-R10-comment', 1440);
      await reader.close();
    } finally {
      await deletePost(owner, post.id);
      await owner.dispose();
      await commenter.dispose();
    }
  });
});
