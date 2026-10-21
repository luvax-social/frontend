import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  apiSession,
  capture,
  captureFeedMenuAtAllWidths,
  menuItem,
  signIn,
  walk,
} from './helpers/session';

const NOT_INTERESTED = /\/posts\/([^/]+)\/not-interested$/;

/** Waits for the not interested write or its undo and returns the post id it named. */
async function notInterestedCall(
  page: Page,
  method: 'POST' | 'DELETE',
  trigger: () => Promise<void>
) {
  const pending = page.waitForResponse(
    (response) => NOT_INTERESTED.test(response.url()) && response.request().method() === method
  );
  await trigger();
  const response = await pending;
  expect(response.status(), `${method} not-interested`).toBeLessThan(300);
  return NOT_INTERESTED.exec(response.url())![1];
}

test.describe('not interested', () => {
  test('P1-A2-R1 not interested on for you collapses the card into an undo row and undo restores it', async ({
    browser,
  }) => {
    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;
    await page.goto('/app');
    const cards = page.locator('article');
    await expect(cards.first()).toBeVisible();

    await captureFeedMenuAtAllWidths(page, 'P1-A2-R1');

    const before = await cards.count();
    const card = cards.first();
    await card.getByRole('button', { name: 'post options' }).click();
    const postId = await notInterestedCall(page, 'POST', () =>
      menuItem(page, 'Not interested').click()
    );

    const row = page.getByRole('group', { name: 'Post hidden' });
    await expect(row).toBeVisible();
    await expect(cards).toHaveCount(before - 1);
    await expect(row.getByRole('button', { name: 'undo' })).toBeFocused();
    await capture(page, 'P1-A2-R1-undo', 1440);

    // The server row exists: the recommendation list no longer carries the post.
    const hidden = await walk<{ id: string }>(viewer, '/recommendations/feed?limit=20', 3);
    expect(hidden.map((post) => post.id)).not.toContain(postId);

    const undoneId = await notInterestedCall(page, 'DELETE', () =>
      row.getByRole('button', { name: 'undo' }).click()
    );
    expect(undoneId).toBe(postId);
    await expect(row).toBeHidden();
    await expect(cards).toHaveCount(before);
    await viewer.close();
  });

  test('P1-A2-R1 not interested on following removes the post from the view and undo restores it', async ({
    browser,
  }) => {
    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;
    await page.goto('/app?tab=following');
    const cards = page.locator('article:visible');
    await expect(cards.first()).toBeVisible();
    const before = await cards.count();

    await cards.first().getByRole('button', { name: 'post options' }).click();
    const postId = await notInterestedCall(page, 'POST', () =>
      menuItem(page, 'Not interested').click()
    );
    const row = page.getByRole('group', { name: 'Post hidden' });
    await expect(row).toBeVisible();
    await expect(cards).toHaveCount(before - 1);

    const following = await walk<{ id: string }>(viewer, '/posts/feed?limit=20', 2);
    expect(following.map((post) => post.id)).not.toContain(postId);

    await notInterestedCall(page, 'DELETE', () =>
      row.getByRole('button', { name: 'undo' }).click()
    );
    await expect(cards).toHaveCount(before);
    await viewer.close();
  });

  test('P1-A2-R1 not interested from an explore post removes its tile and the toast undo restores it', async ({
    browser,
  }) => {
    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;
    await page.goto('/app/explore');
    const tiles = page.locator('main button:has(img)');
    await expect(tiles.first()).toBeVisible();
    await tiles.first().click();
    await expect(page).toHaveURL(/\/app\/p\//);
    const postId = /\/app\/p\/([^/?]+)/.exec(page.url())![1];

    await page.getByRole('button', { name: 'post options' }).click();
    await notInterestedCall(page, 'POST', () => menuItem(page, 'Not interested').click());

    await expect(page).toHaveURL(/\/app\/explore/);
    await expect(page.getByText('Post hidden')).toBeVisible();
    const explore = await walk<{ id: string }>(
      viewer,
      '/recommendations/feed?limit=20&excludeFollowed=true',
      3
    );
    expect(explore.map((post) => post.id)).not.toContain(postId);
    await capture(page, 'P1-A2-R1-toast', 1440);

    await notInterestedCall(page, 'DELETE', () =>
      page.getByRole('button', { name: 'Undo' }).click()
    );
    await viewer.close();
  });

  test('P1-A2-R4 a post marked not interested stays out of every recommendation list', async ({
    browser,
  }) => {
    const api = await apiSession(browser, 'user_public');
    const feed = await walk<{ id: string; author: { id: string } }>(
      api,
      '/recommendations/feed?limit=20',
      1
    );
    const target = feed[0];
    try {
      const marked = await api.call('POST', `/posts/${target.id}/not-interested`);
      expect(marked.status).toBeLessThan(300);

      for (const path of [
        '/recommendations/feed?limit=20',
        '/recommendations/feed?limit=20&excludeFollowed=true',
        '/posts/feed?limit=20',
      ]) {
        const ids = (await walk<{ id: string }>(api, path, 4)).map((post) => post.id);
        expect(ids, path).not.toContain(target.id);
      }
    } finally {
      await api.call('DELETE', `/posts/${target.id}/not-interested`);
      await api.dispose();
    }
  });
});
