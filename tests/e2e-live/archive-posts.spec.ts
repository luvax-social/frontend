// The P2-* identifiers in the test titles are the requirement identifiers of the post creation
// work. docs/post-creation/README.md maps each one to its behavior, spec file and screenshots.
// Behavior covered: The archive screen lists the owner's archived posts, unarchiving puts a post
// back with its original publication time and offers an undo, and the profile links to the archive.

import { expect, test } from '@playwright/test';
import { signIn } from './helpers/session';
import { ownPosts, readPost, shoot, shootAtAllWidths } from './helpers/postCreation';

const OWNER = 'user_power';

test.describe('archive', () => {
  test('P2-C1-R7 the profile links to the archive and the archive lists archived posts', async ({
    browser,
  }) => {
    const session = await signIn(browser, OWNER);
    const { page } = session;
    const archived = await ownPosts(session, 'archived');
    expect(archived.length, 'the seed archives posts for this account').toBeGreaterThanOrEqual(2);

    await page.goto('/app/profile');
    await shootAtAllWidths(page, 'P2-C1-R7-profile', async () => {
      await page.evaluate(() => window.scrollTo(0, 0));
    });
    await page.getByRole('button', { name: 'archive', exact: true }).click();
    await page.waitForURL(/\/app\/archive/);

    await expect(page.getByRole('heading', { name: 'archive' })).toBeVisible();
    await expect(page.getByTestId('archive-grid')).toBeVisible();
    await expect(page.getByRole('button', { name: 'open archived post' })).toHaveCount(
      archived.length
    );
    await shoot(page, 'P2-C1-R7', 1440);
    await session.close();
  });

  test('P2-C1-R7 unarchiving keeps the publication time and undo archives the post again', async ({
    browser,
  }) => {
    const session = await signIn(browser, OWNER);
    const { page } = session;
    const [target] = await ownPosts(session, 'archived');
    const before = await readPost(session, target.id);
    expect(before?.status).toBe('archived');

    await page.goto('/app/archive');
    const tile = page.locator(`[data-post-id="${target.id}"]`);
    await tile.hover();
    await tile.getByRole('button', { name: 'unarchive' }).click();
    await expect(page.getByText('Post unarchived.')).toBeVisible();
    await shoot(page, 'P2-C1-R7-unarchived', 1440);

    await expect.poll(async () => (await readPost(session, target.id))?.status).toBe('published');
    const after = await readPost(session, target.id);
    // The post keeps the time it first went live, so it returns to its old place in the feed
    // instead of appearing as new.
    expect(after?.publishedAt).toBe(before?.publishedAt);

    await page.getByRole('button', { name: 'undo' }).click();
    await expect.poll(async () => (await readPost(session, target.id))?.status).toBe('archived');
    await session.close();
  });
});
