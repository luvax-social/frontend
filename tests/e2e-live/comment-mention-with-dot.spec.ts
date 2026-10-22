// The P2-* identifiers in the test titles are the requirement identifiers of the post creation
// work. docs/post-creation/README.md maps each one to its behavior, spec file and screenshots.
// Behavior covered: A comment that mentions a username containing a dot, in any letter case and at
// the end of a sentence, stores the mention and notifies the account it names.

import { expect, test } from '@playwright/test';
import { apiSession, signIn } from './helpers/session';
import { createPost, deletePost, notificationsOf, shoot } from './helpers/postCreation';

const OWNER = 'user_power';
const COMMENTER = 'user_new_empty';
const DOTTED = 'vivian.frontend';

const spellings = [
  { name: 'exact case', content: `@${DOTTED} this is for you` },
  { name: 'another letter case', content: '@Vivian.Frontend this is for you' },
  { name: 'a dot after the name at the end of a sentence', content: `thank you @${DOTTED}.` },
];

test.describe('a username with a dot in a comment', () => {
  // The notifications follow events that wait their turn behind the other events of the stack.
  test.setTimeout(300_000);

  for (const spelling of spellings) {
    test(`Bug 1 a mention with ${spelling.name} is stored and notifies`, async ({ browser }) => {
      const owner = await apiSession(browser, OWNER);
      const commenter = await apiSession(browser, COMMENTER);
      const mentioned = await apiSession(browser, DOTTED);
      const post = await createPost(owner, {
        postType: 'text',
        caption: `dotted mention ${Date.now()}`,
        status: 'published',
      });

      try {
        const comment = await commenter.call<{
          id: string;
          mentions: { username: string; userId: string }[];
        }>('POST', `/posts/${post.id}/comments`, {
          postId: post.id,
          parentId: null,
          content: spelling.content,
        });
        expect(comment.status, `comment: ${comment.code}`).toBe(201);
        expect(comment.data.mentions).toHaveLength(1);
        expect(comment.data.mentions[0].username).toBe(DOTTED);
        expect(comment.data.mentions[0].userId).toBe(mentioned.user.id);

        await expect
          .poll(
            async () =>
              (await notificationsOf(mentioned)).some(
                (item) => item.type === 'mention_comment' && item.target.postId === post.id
              ),
            { timeout: 200_000, intervals: [5_000] }
          )
          .toBe(true);
      } finally {
        await deletePost(owner, post.id);
        await owner.dispose();
        await commenter.dispose();
        await mentioned.dispose();
      }
    });
  }

  test('Bug 1 the mentioned account sees the comment mention in its notifications', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, OWNER);
    const commenter = await apiSession(browser, COMMENTER);
    const post = await createPost(owner, {
      postType: 'text',
      caption: `dotted mention feed ${Date.now()}`,
      status: 'published',
    });

    try {
      const comment = await commenter.call('POST', `/posts/${post.id}/comments`, {
        postId: post.id,
        parentId: null,
        content: `@${DOTTED} the notification should name you`,
      });
      expect(comment.status).toBe(201);

      const mentioned = await apiSession(browser, DOTTED);
      await expect
        .poll(
          async () =>
            (await notificationsOf(mentioned)).some(
              (item) => item.type === 'mention_comment' && item.target.postId === post.id
            ),
          { timeout: 200_000, intervals: [5_000] }
        )
        .toBe(true);
      await mentioned.dispose();

      const session = await signIn(browser, DOTTED);
      await session.page.goto('/app/notifications');
      await expect(session.page.getByText(/mentioned you in a comment/).first()).toBeVisible();
      await shoot(session.page, 'Bug1-comment-mention-notification', 1440);
      await session.close();
    } finally {
      await deletePost(owner, post.id);
      await owner.dispose();
      await commenter.dispose();
    }
  });
});
