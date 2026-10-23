// The P2-* identifiers in the test titles are the requirement identifiers of the post creation
// work. docs/post-creation/README.md maps each one to its behavior, spec file and screenshots.
// Behavior covered: No like, save, view, not-interested mark, comment or report can be written
// against a post that is not published, for its owner or anyone else, and a published post still
// accepts them. This is also the regression check for an owner's like on a draft.

import { expect, test } from '@playwright/test';
import type { Api } from './helpers/session';
import { apiSession, signIn } from './helpers/session';
import { createPost, deleteAllHeld, deletePost, ownPosts, shoot } from './helpers/postCreation';

const OWNER = 'user_power';
const TURNSTILE_PASS_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

/** Every interaction write, as the application sends it, keyed by what it is. */
const writes = (postId: string): [string, string, string, unknown?][] => [
  ['like', 'POST', `/posts/${postId}/like`],
  ['save', 'POST', `/posts/${postId}/save`],
  ['view', 'POST', `/posts/${postId}/view`],
  ['not interested', 'POST', `/posts/${postId}/not-interested`],
  [
    'comment',
    'POST',
    `/posts/${postId}/comments`,
    { postId, parentId: null, content: 'a comment on a post nobody can see' },
  ],
  [
    'report',
    'POST',
    '/reports',
    {
      reportType: 'post',
      reportReason: 'spam',
      entityId: postId,
      turnstileToken: TURNSTILE_PASS_TOKEN,
    },
  ],
];

async function refusals(actor: Api, postId: string) {
  const outcome: Record<string, number> = {};
  for (const [name, method, url, body] of writes(postId)) {
    outcome[name] = (await actor.call(method, url, body)).status;
  }
  return outcome;
}

/**
 * The refusal each write is expected to meet. A comment is refused as forbidden, as it always was,
 * and an owner is also told never to mark their own post.
 */
const expectedRefusal = (actorIsOwner: boolean, name: string) => {
  if (name === 'comment') return 403;
  return actorIsOwner && name === 'not interested' ? 400 : 404;
};

test.describe('interactions on posts that are not published', () => {
  test.afterEach(async ({ browser }) => {
    const owner = await apiSession(browser, OWNER);
    await deleteAllHeld(owner);
    // A failed assertion must not leave the archived post this spec makes behind it.
    for (const post of await ownPosts(owner, 'archived')) {
      if (post.caption?.startsWith('archived 1')) await deletePost(owner, post.id);
    }
    await owner.dispose();
  });

  for (const state of ['draft', 'scheduled'] as const) {
    test(`P2-C1-R6 a ${state} post refuses every interaction from its owner and from others`, async ({
      browser,
    }) => {
      const owner = await apiSession(browser, OWNER);
      const stranger = await apiSession(browser, 'user_public');
      await deleteAllHeld(owner);
      const post = await createPost(owner, {
        postType: 'text',
        caption: `private ${state} ${Date.now()}`,
        status: state,
        ...(state === 'scheduled'
          ? { scheduledAt: new Date(Date.now() + 2 * 86_400_000).toISOString() }
          : {}),
      });

      for (const actor of [owner, stranger]) {
        const outcome = await refusals(actor, post.id);
        for (const [name, status] of Object.entries(outcome)) {
          expect(status, `${actor.username} ${name} on a ${state} post`).toBe(
            expectedRefusal(actor === owner, name)
          );
        }
      }

      // Nothing the owner attempted left a trace in the lists those writes feed.
      const saved = await owner.call<{ content: { post?: { id: string } }[] }>(
        'GET',
        '/posts/saved?limit=50'
      );
      expect(JSON.stringify(saved.data)).not.toContain(post.id);
      const liked = await owner.call('GET', '/posts/liked?limit=50');
      expect(JSON.stringify(liked.data)).not.toContain(post.id);

      const session = await signIn(browser, OWNER);
      await session.page.goto('/app/compose');
      await session.page.getByTestId('open-drafts').click();
      if (state === 'scheduled') {
        await session.page.getByRole('tab', { name: /scheduled/ }).click();
      }
      await expect(session.page.getByText(post.caption!)).toBeVisible();
      await shoot(session.page, `P2-C1-R6-${state}`, 1440);

      await deletePost(owner, post.id);
      await session.close();
      await owner.dispose();
      await stranger.dispose();
    });
  }

  test('P2-C1-R6 an archived post refuses interactions until it is published again', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, OWNER);
    const stranger = await apiSession(browser, 'user_public');
    const post = await createPost(owner, {
      postType: 'text',
      caption: `archived ${Date.now()}`,
      status: 'published',
    });
    expect(
      (await owner.call('PATCH', `/posts/${post.id}/status`, { targetStatus: 'archived' })).status
    ).toBe(200);

    for (const actor of [owner, stranger]) {
      const outcome = await refusals(actor, post.id);
      for (const [name, status] of Object.entries(outcome)) {
        expect(status, `${actor.username} ${name} on an archived post`).toBe(
          expectedRefusal(actor === owner, name)
        );
      }
    }
    expect(
      (await owner.call('PATCH', `/posts/${post.id}/status`, { targetStatus: 'published' })).status
    ).toBe(200);
    expect((await stranger.call('POST', `/posts/${post.id}/like`)).status).toBeLessThan(300);

    await deletePost(owner, post.id);
    await owner.dispose();
    await stranger.dispose();
  });

  test('P2-C1-R6 an owner can still like and save a published post', async ({ browser }) => {
    const owner = await apiSession(browser, OWNER);
    const post = await createPost(owner, {
      postType: 'text',
      caption: `published control ${Date.now()}`,
      status: 'published',
    });

    expect((await owner.call('POST', `/posts/${post.id}/like`)).status).toBeLessThan(300);
    expect((await owner.call('POST', `/posts/${post.id}/save`)).status).toBeLessThan(300);
    expect(await ownPosts(owner, 'draft')).toHaveLength(0);

    await deletePost(owner, post.id);
    await owner.dispose();
  });
});
