// The P2-* identifiers in the test titles are the requirement identifiers of the post creation
// work. docs/post-creation/README.md maps each one to its behavior, spec file and screenshots.
// Behavior covered: Tagging a person at a spot on a photo from the composer, how a viewer sees the
// marker, the tagged tab on the tagged person's profile, and the tagged person removing themself.

import { expect, test } from '@playwright/test';
import { apiSession, signIn } from './helpers/session';
import {
  createPost,
  deleteAllHeld,
  deletePost,
  ownedImageAssets,
  readPost,
  readTagSettings,
  setTagSettings,
  shoot,
  shootAtAllWidths,
} from './helpers/postCreation';

const OWNER = 'user_power';
const TAGGED = 'user_public';

test('P2-A5-R1 a person is tagged on a photo from the composer and appears on the post', async ({
  browser,
}) => {
  const owner = await apiSession(browser, OWNER);
  const tagged = await apiSession(browser, TAGGED);
  const original = await readTagSettings(tagged);
  await setTagSettings(tagged, { tagPermission: 'everyone', manualTagApproval: false });
  await deleteAllHeld(owner);
  const [asset] = await ownedImageAssets(owner, 1);
  const caption = `tagged from the composer ${Date.now()}`;
  const draft = await createPost(owner, {
    postType: 'image',
    caption,
    status: 'draft',
    media: [{ mediaId: asset, altText: 'A portrait outdoors' }],
  });

  try {
    const session = await signIn(browser, OWNER);
    const { page } = session;
    await page.goto(`/app/compose?draft=${draft.id}`);
    await expect(page.getByPlaceholder('title or caption')).toHaveValue(caption);

    await page.getByTestId('option-tag-people').click();
    const editor = page.getByTestId('tag-people-editor');
    await expect(editor).toBeVisible();
    await editor.getByTestId('tag-photo').click({ position: { x: 200, y: 160 } });
    await editor.getByLabel('search people to tag').fill(TAGGED);
    await editor.locator(`[data-person="${TAGGED}"]`).click();
    await expect(editor.locator(`[data-tag="${TAGGED}"]`)).toBeVisible();
    await shoot(page, 'P2-A5-R1', 1440);
    await editor.getByRole('button', { name: 'done' }).click();
    await expect(page.getByTestId('option-tag-people')).toContainText('1 person on 1 photo');

    await page.getByTestId('publish-post').click();
    await page.waitForURL(/\/app$/);

    const published = await readPost(owner, draft.id);
    expect(published?.status).toBe('published');
    const tags = published!.media[0].tags;
    expect(tags).toHaveLength(1);
    expect(tags[0].user.username).toBe(TAGGED);
    expect(tags[0].status).toBe('approved');
    expect(tags[0].x).toBeGreaterThan(0);
    expect(tags[0].x).toBeLessThan(1);
    expect(tags[0].y).toBeGreaterThan(0);
    expect(tags[0].y).toBeLessThan(1);

    // A viewer turns the markers on and sees the person at the spot.
    const viewer = await signIn(browser, 'user_new_empty');
    await viewer.page.goto(`/app/p/${draft.id}`);
    const overlay = viewer.page.locator('.lx-scrim');
    await overlay.getByRole('button', { name: 'show tags' }).first().click();
    await expect(overlay.locator(`[data-tag="${TAGGED}"]`).first()).toBeVisible();
    await shootAtAllWidths(viewer.page, 'P2-A5-R4', async () => {
      await viewer.page.evaluate(() => window.scrollTo(0, 0));
    });
    await viewer.close();

    // The tagged person finds the post under the tagged tab of their own profile.
    const listed = await tagged.call<{ content: { id: string }[] }>(
      'GET',
      `/users/${tagged.user.id}/tagged-posts?limit=20`
    );
    expect(listed.data.content.map((post) => post.id)).toContain(draft.id);
    const taggedSession = await signIn(browser, TAGGED);
    await taggedSession.page.goto('/app/profile');
    await taggedSession.page.getByRole('button', { name: 'tagged', exact: true }).click();
    await expect(taggedSession.page.getByRole('img').first()).toBeVisible();
    await shootAtAllWidths(taggedSession.page, 'P2-A5-R5', async () => {
      await taggedSession.page.evaluate(() => window.scrollTo(0, 0));
    });

    // The tagged person removes themself from the post menu, and the tag is gone for everyone.
    await taggedSession.page.goto(`/app/p/${draft.id}`);
    await taggedSession.page
      .locator('.lx-scrim')
      .getByRole('button', { name: 'post options' })
      .first()
      .click();
    await taggedSession.page
      .getByRole('button', { name: 'Remove me from this post', exact: true })
      .click();
    await expect(taggedSession.page.getByText('You were removed from this post.')).toBeVisible();
    await expect.poll(async () => (await readPost(owner, draft.id))?.media[0].tags.length).toBe(0);

    await taggedSession.close();
    await session.close();
  } finally {
    await deletePost(owner, draft.id);
    await setTagSettings(tagged, original);
    await owner.dispose();
    await tagged.dispose();
  }
});
