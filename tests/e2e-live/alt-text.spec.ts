// The P2-* identifiers in the test titles are the requirement identifiers of the post creation
// work. docs/post-creation/README.md maps each one to its behavior, spec file and screenshots.
// Behavior covered: Alt text written when a post is created, the 500 character limit, editing
// alt text on a published post, and the neutral label every image carries when no alt text exists.

import { expect, test } from '@playwright/test';
import { apiSession, signIn } from './helpers/session';
import {
  createPost,
  deletePost,
  ownedImageAssets,
  readPost,
  shoot,
  shootAtAllWidths,
} from './helpers/postCreation';

const OWNER = 'user_power';
const WRITTEN = 'A photographer holds a camera up at golden hour';

test.describe('alt text', () => {
  test('P2-C2-R1 alt text is stored per image, limited to 500 characters, and optional', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, OWNER);
    const [first, second] = await ownedImageAssets(owner, 2);

    const created = await createPost(owner, {
      postType: 'carousel',
      caption: `alt text on creation ${Date.now()}`,
      media: [{ mediaId: first, altText: WRITTEN }, { mediaId: second }],
    });
    expect(created.media[0].altText).toBe(WRITTEN);
    expect(created.media[1].altText).toBeNull();

    const tooLong = await owner.call('POST', '/posts', {
      postType: 'image',
      caption: 'alt text limit',
      media: [{ mediaId: first, altText: 'x'.repeat(501) }],
    });
    expect(tooLong.status).toBe(400);
    const atLimit = await owner.call<{ id: string }>('POST', '/posts', {
      postType: 'image',
      caption: 'alt text at the limit',
      media: [{ mediaId: first, altText: 'x'.repeat(500) }],
    });
    expect(atLimit.status).toBe(201);

    await deletePost(owner, created.id);
    await deletePost(owner, atLimit.data.id);
    await owner.dispose();
  });

  test('P2-C2-R2 the owner edits alt text from the post menu and a reader sees it', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, OWNER);
    const [first, second] = await ownedImageAssets(owner, 2);
    const post = await createPost(owner, {
      postType: 'carousel',
      caption: `alt text edit ${Date.now()}`,
      media: [{ mediaId: first }, { mediaId: second }],
    });

    const session = await signIn(browser, OWNER);
    const { page } = session;
    await page.goto(`/app/p/${post.id}`);
    // The post opens as an overlay above the feed, so the menu is the one inside it.
    await page.locator('.lx-scrim').getByRole('button', { name: 'post options' }).first().click();
    await page.getByRole('button', { name: 'Edit alt text', exact: true }).click();

    const dialog = page.getByTestId('alt-text-dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('alt text for image 1').fill(WRITTEN);
    await shoot(page, 'P2-C2-R2', 1440);
    await dialog.getByRole('button', { name: 'save' }).click();
    await expect(dialog).toBeHidden();

    await expect.poll(async () => (await readPost(owner, post.id))?.media[0].altText).toBe(WRITTEN);
    expect((await readPost(owner, post.id))?.media[1].altText).toBeNull();

    // A reader sees the written text on the image it was written for.
    const reader = await signIn(browser, 'user_public');
    await reader.page.goto(`/app/p/${post.id}`);
    await expect(reader.page.getByRole('img', { name: WRITTEN }).first()).toBeVisible();

    await deletePost(owner, post.id);
    await reader.close();
    await session.close();
    await owner.dispose();
  });

  test('P2-C2-R3 and R4 every image carries alt text or a neutral label on every surface', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, OWNER);
    const [first, second] = await ownedImageAssets(owner, 2);
    const post = await createPost(owner, {
      postType: 'carousel',
      caption: `labels ${Date.now()}`,
      media: [{ mediaId: first, altText: WRITTEN }, { mediaId: second }],
    });

    const reader = await signIn(browser, 'user_public');
    const { page } = reader;
    await page.goto(`/app/p/${post.id}`);
    await expect(page.getByRole('img', { name: WRITTEN }).first()).toBeVisible();
    await shootAtAllWidths(page, 'P2-C2-R3', async () => {
      await page.evaluate(() => window.scrollTo(0, 0));
    });

    // The profile grid shows the post as a thumbnail, which has the same obligation.
    await page.goto('/app/u/' + owner.user.id);
    await expect(
      page.getByRole('img', { name: new RegExp(`${WRITTEN}|Photo 1 of 2 by @user_power`) }).first()
    ).toBeAttached();

    // No image on the page is left without a text alternative.
    const unlabelled = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .filter((img) => !img.hasAttribute('alt') && !img.getAttribute('aria-label'))
        .map((img) => img.src)
    );
    expect(unlabelled).toEqual([]);

    await deletePost(owner, post.id);
    await reader.close();
    await owner.dispose();
  });
});
