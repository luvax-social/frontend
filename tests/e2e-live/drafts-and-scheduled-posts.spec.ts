// The P2-* identifiers in the test titles are the requirement identifiers of the post creation
// work. docs/post-creation/README.md maps each one to its behavior, spec file and screenshots.
// Behavior covered: Saving a post as a draft, resuming it without creating a second post,
// scheduling a post, the schedule limits, moving a scheduled post back to drafts, and the
// publication time that places a published draft at the top of the profile.

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { apiSession, signIn } from './helpers/session';
import {
  createPost,
  deleteAllHeld,
  deletePost,
  ownPosts,
  readPost,
  shoot,
  shootAtAllWidths,
} from './helpers/postCreation';

const OWNER = 'user_power';

const captionBox = (page: Page) => page.getByPlaceholder('title');

/** Opens the composer with a caption typed in. */
async function composeText(page: Page, caption: string) {
  await page.goto('/app/compose');
  await captionBox(page).fill(caption);
}

test.describe('drafts and scheduled posts', () => {
  test.beforeEach(async ({ browser }) => {
    const owner = await apiSession(browser, OWNER);
    await deleteAllHeld(owner);
    await owner.dispose();
  });

  test.afterEach(async ({ browser }) => {
    const owner = await apiSession(browser, OWNER);
    await deleteAllHeld(owner);
    await owner.dispose();
  });

  test('P2-C1-R2 a draft waits in the drawer and publishing it creates no second post', async ({
    browser,
  }) => {
    const session = await signIn(browser, OWNER);
    const { page } = session;
    const caption = `draft that becomes a post ${Date.now()}`;

    await composeText(page, caption);
    await shoot(page, 'P2-C1-R2-composer', 1440);
    await page.getByTestId('save-draft').click();
    await expect(page.getByText('draft saved')).toBeVisible();

    const drafts = await ownPosts(session, 'draft');
    expect(drafts.map((draft) => draft.caption)).toContain(caption);
    const draft = drafts.find((item) => item.caption === caption)!;
    expect(draft.status).toBe('draft');

    await page.getByTestId('open-drafts').click();
    const drawer = page.getByTestId('drafts-panel');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(caption)).toBeVisible();
    await expect(page.getByTestId('drafts-limit')).toContainText(
      'used. Drafts and scheduled posts share the limit.'
    );
    await shoot(page, 'P2-C1-R2-drawer', 1440);

    // Resuming loads the stored content into the composer, and posting it moves the same post
    // to published rather than writing another one.
    await drawer.getByRole('button', { name: 'resume' }).first().click();
    await expect(drawer).toBeHidden();
    await expect(captionBox(page)).toHaveValue(caption);
    await page.getByTestId('publish-post').click();
    await page.waitForURL(/\/app$/);

    const published = await readPost(session, draft.id);
    expect(published?.status).toBe('published');
    expect(published?.publishedAt).toBeTruthy();
    expect(await ownPosts(session, 'draft')).toHaveLength(0);

    await deletePost(session, draft.id);
    await session.close();
  });

  test('P2-C1-R3 a scheduled post waits for its time and can return to drafts', async ({
    browser,
  }) => {
    const session = await signIn(browser, OWNER);
    const { page } = session;
    const caption = `scheduled for tomorrow ${Date.now()}`;

    await composeText(page, caption);
    await page.getByTestId('option-schedule').click();
    const picker = page.getByTestId('schedule-picker');
    await expect(picker).toBeVisible();
    await expect(page.getByTestId('schedule-helper')).toContainText(
      'Between 1 minute and 30 days from now.'
    );
    await picker.getByText('tomorrow 09:00').click();
    await shoot(page, 'P2-C1-R3-picker', 1440);
    await picker.getByRole('button', { name: 'set time' }).click();
    await expect(page.getByTestId('option-schedule')).toContainText('tomorrow');

    const submit = page.getByTestId('publish-post');
    await expect(submit).toHaveText('schedule');
    await submit.click();
    await page.waitForURL(/\/app$/);

    const scheduled = (await ownPosts(session, 'scheduled')).find(
      (post) => post.caption === caption
    );
    expect(scheduled, 'the post is listed as scheduled').toBeDefined();
    expect(new Date(scheduled!.scheduledAt!).getTime()).toBeGreaterThan(Date.now());
    expect(scheduled!.publishedAt).toBeNull();

    // A scheduled post is private to its owner until it is due.
    const stranger = await apiSession(browser, 'user_public');
    expect(await readPost(stranger, scheduled!.id)).toBeNull();
    await stranger.dispose();

    await page.goto('/app/compose');
    await page.getByTestId('open-drafts').click();
    const drawer = page.getByTestId('drafts-panel');
    await drawer.getByRole('tab', { name: /scheduled/ }).click();
    await expect(drawer.getByText(caption)).toBeVisible();
    await shoot(page, 'P2-C1-R3-drawer', 1440);

    await drawer.getByRole('button', { name: 'move to drafts' }).first().click();
    await expect.poll(async () => (await readPost(session, scheduled!.id))?.status).toBe('draft');

    await session.close();
  });

  test('P2-C1-R3 a time outside one minute to thirty days is refused before saving', async ({
    browser,
  }) => {
    const session = await signIn(browser, OWNER);
    const { page } = session;

    await composeText(page, 'schedule limit check');
    await page.getByTestId('option-schedule').click();
    const picker = page.getByTestId('schedule-picker');
    const tooFar = new Date(Date.now() + 45 * 86_400_000);
    const pad = (value: number) => String(value).padStart(2, '0');
    await picker
      .getByLabel('date')
      .fill(`${tooFar.getFullYear()}-${pad(tooFar.getMonth() + 1)}-${pad(tooFar.getDate())}`);

    await expect(page.getByTestId('schedule-helper')).toHaveAttribute('role', 'alert');
    await expect(picker.getByRole('button', { name: 'set time' })).toBeDisabled();
    await shoot(page, 'P2-C1-R3-limit', 1440);

    await session.close();
  });

  test('P2-C1-R1 a draft written long before it is published appears first in the profile', async ({
    browser,
  }) => {
    const session = await signIn(browser, OWNER);
    const { page } = session;
    const draft = await createPost(session, {
      postType: 'text',
      caption: `older draft ${Date.now()}`,
      status: 'draft',
    });
    const newer = await createPost(session, {
      postType: 'text',
      caption: `newer post ${Date.now()}`,
      status: 'published',
    });

    const move = await session.call('PATCH', `/posts/${draft.id}/status`, {
      targetStatus: 'published',
    });
    expect(move.status).toBeLessThan(300);
    const published = await readPost(session, draft.id);
    expect(new Date(published!.publishedAt!).getTime()).toBeGreaterThan(
      new Date(newer.publishedAt!).getTime()
    );

    await page.goto('/app/profile');
    await page.getByRole('button', { name: 'posts', exact: true }).click();
    const first = page.getByText(published!.caption!).first();
    const second = page.getByText(newer.caption!).first();
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();
    // The grid reads in publication order, so the draft published last comes before the post
    // that was written after it.
    const [firstBox, secondBox] = [await first.boundingBox(), await second.boundingBox()];
    expect(firstBox!.y * 10_000 + firstBox!.x).toBeLessThan(secondBox!.y * 10_000 + secondBox!.x);
    await shootAtAllWidths(page, 'P2-C1-R1', async () => {
      await page.evaluate(() => window.scrollTo(0, 0));
    });

    await deletePost(session, draft.id);
    await deletePost(session, newer.id);
    await session.close();
  });
});
