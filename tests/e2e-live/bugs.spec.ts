import { expect, test } from '@playwright/test';
import { apiSession, itemsOf, postsOf, signIn, userIdOf } from './helpers/session';

interface NotificationItem {
  target: { commentId: string | null; available: boolean };
  preview: { commentSnippet?: string | null } | null;
}

/**
 * The fixes of the interaction control phase that are not about direct messages. The message
 * fixes are covered by the message specs, and the structure map corrections are documentation.
 */
test.describe('bug fixes', () => {
  test('P1-BUGS a comment notification stops showing the comment text once its author is blocked', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, 'user_public');
    const commenter = await apiSession(browser, 'hunter.finance');
    const text = 'snippet visibility check comment';
    const [post] = await postsOf(owner, owner.user.id, 1);
    const created = await commenter.call<{ id: string }>('POST', `/posts/${post.id}/comments`, {
      postId: post.id,
      parentId: null,
      content: text,
    });
    expect(created.status).toBe(201);
    const commentId = created.data.id;
    const blocked = await userIdOf(owner, 'hunter.finance');

    const mine = async () => {
      const result = await owner.call('GET', '/notifications?limit=40');
      return itemsOf<NotificationItem>(result.data).find(
        (item) => item.target.commentId === commentId
      );
    };

    const viewer = await signIn(browser, 'user_public');
    try {
      await expect
        .poll(async () => (await mine())?.preview?.commentSnippet, {
          timeout: 20_000,
        })
        .toContain(text);

      await viewer.page.goto('/app/notifications');
      await expect(viewer.page.getByText(text).first()).toBeVisible();

      expect((await owner.call('POST', `/social/block/${blocked}`)).status).toBeLessThan(300);
      const after = await mine();
      expect(after?.preview?.commentSnippet ?? null).toBeNull();
      expect(JSON.stringify(after ?? {})).not.toContain(text);

      await viewer.page.reload();
      await expect(viewer.page.getByRole('main')).toBeVisible();
      await expect(viewer.page.getByText(text)).toHaveCount(0);
    } finally {
      await owner.call('DELETE', `/social/block/${blocked}`);
      await commenter.call('DELETE', `/comments/${commentId}`);
      await viewer.close();
      await Promise.all([owner.dispose(), commenter.dispose()]);
    }
  });
});
