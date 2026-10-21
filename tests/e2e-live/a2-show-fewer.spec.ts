import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { apiSession, capture, menuItem, signIn, userIdOf, walk } from './helpers/session';

interface FeedPost {
  id: string;
  author: { id: string; username: string };
}

const SHOW_FEWER = /\/social\/show-fewer\/([^/]+)$/;

async function showFewerCall(page: Page, method: 'POST' | 'DELETE', trigger: () => Promise<void>) {
  const pending = page.waitForResponse(
    (response) => SHOW_FEWER.test(response.url()) && response.request().method() === method
  );
  await trigger();
  const response = await pending;
  expect(response.status(), `${method} show-fewer`).toBeLessThan(300);
  return SHOW_FEWER.exec(response.url())![1];
}

test.describe('show fewer', () => {
  test('P1-A2-R3 show fewer is offered on for you and explore and is absent on following', async ({
    browser,
  }) => {
    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;

    await page.goto('/app?tab=following');
    const following = page.locator('article:visible').first();
    await expect(following).toBeVisible();
    await following.getByRole('button', { name: 'post options' }).click();
    await expect(menuItem(page, 'Not interested')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Show fewer from @/ })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.goto('/app');
    const forYou = page.locator('article').first();
    await expect(forYou).toBeVisible();
    await forYou.getByRole('button', { name: 'post options' }).click();
    await expect(page.getByRole('button', { name: /^Show fewer from @/ })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.goto('/app/explore');
    const tiles = page.locator('main button:has(img)');
    await expect(tiles.first()).toBeVisible();
    await tiles.first().click();
    await page.getByRole('button', { name: 'post options' }).click();
    await expect(page.getByRole('button', { name: /^Show fewer from @/ })).toBeVisible();
    await viewer.close();
  });

  test('P1-A2-R3 show fewer collapses the card, suppresses the author in recommendations and undo restores it', async ({
    browser,
  }) => {
    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;
    await page.goto('/app');
    const cards = page.locator('article');
    await expect(cards.first()).toBeVisible();
    const before = await cards.count();

    await cards.first().getByRole('button', { name: 'post options' }).click();
    const authorId = await showFewerCall(page, 'POST', () =>
      page.getByRole('button', { name: /^Show fewer from @/ }).click()
    );

    const row = page.getByRole('group', { name: 'fewer posts from this account' });
    await expect(row).toBeVisible();
    await expect(row).toContainText("you'll see fewer posts from @");
    await expect(row).toContainText("You'll still see them in following.");
    await expect(row.getByRole('button', { name: 'undo' })).toBeFocused();
    await capture(page, 'P1-A2-R3', 1440);

    const forYou = await walk<FeedPost>(viewer, '/recommendations/feed?limit=20', 3);
    expect(forYou.filter((post) => post.author.id === authorId)).toEqual([]);
    const explore = await walk<FeedPost>(
      viewer,
      '/recommendations/feed?limit=20&excludeFollowed=true',
      3
    );
    expect(explore.filter((post) => post.author.id === authorId)).toEqual([]);

    // The card stays in the list as a row, so the cards below did not move.
    await expect(cards).toHaveCount(before - 1);
    const undone = await showFewerCall(page, 'DELETE', () =>
      row.getByRole('button', { name: 'undo' }).click()
    );
    expect(undone).toBe(authorId);
    await expect(row).toBeHidden();
    await expect(cards).toHaveCount(before);
    await viewer.close();
  });

  test('P1-A2-R3 an author the viewer asked for fewer posts from still appears in following', async ({
    browser,
  }) => {
    // The seed has user_public asking for fewer posts from kane.runs, whom they also follow.
    const api = await apiSession(browser, 'user_public');
    const kane = await userIdOf(api, 'kane.runs');
    const following = await walk<FeedPost>(api, '/posts/feed?limit=20', 3);
    expect(following.some((post) => post.author.id === kane)).toBe(true);
    const forYou = await walk<FeedPost>(api, '/recommendations/feed?limit=20', 3);
    expect(forYou.some((post) => post.author.id === kane)).toBe(false);
    await api.dispose();
  });

  test('P1-A2-R3 show fewer from an explore post confirms with a toast that undoes it', async ({
    browser,
  }) => {
    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;
    await page.goto('/app/explore');
    const tiles = page.locator('main button:has(img)');
    await expect(tiles.first()).toBeVisible();
    await tiles.first().click();
    await expect(page).toHaveURL(/\/app\/p\//);

    await page.getByRole('button', { name: 'post options' }).click();
    await showFewerCall(page, 'POST', () =>
      page.getByRole('button', { name: /^Show fewer from @/ }).click()
    );
    await expect(
      page.getByRole('status').filter({ hasText: "You'll see fewer posts from @" })
    ).toBeVisible();
    await showFewerCall(page, 'DELETE', () => page.getByRole('button', { name: 'Undo' }).click());
    await viewer.close();
  });

  test('P1-A2-R3 a long handle wraps inside the post menu of the detail view and keeps every icon', async ({
    browser,
  }) => {
    const api = await apiSession(browser, 'user_public');
    const feed = await walk<FeedPost>(api, '/recommendations/feed?limit=20', 2);
    const longest = feed.reduce((best, post) =>
      post.author.username.length > best.author.username.length ? post : best
    );
    expect(longest.author.username.length).toBeGreaterThan(18);
    await api.dispose();

    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;
    await page.goto(`/app/p/${longest.id}`);
    await page.getByRole('button', { name: 'post options' }).last().click();
    const menu = page.locator('.lx-popover-menu');
    await expect(menu).toBeVisible();

    const rows = await menu.locator('.lx-popover-item').evaluateAll((items) =>
      items.map((item) => {
        const box = item.parentElement!.getBoundingClientRect();
        const text = item.querySelector('span')!.getBoundingClientRect();
        const icon = item.querySelector('svg')?.getBoundingClientRect();
        return {
          label: item.textContent,
          overflow: Math.round(text.right - box.right),
          iconWidth: icon ? Math.round(icon.width) : null,
        };
      })
    );
    for (const row of rows) {
      expect(row.overflow, `${row.label} runs past the menu`).toBeLessThanOrEqual(0);
      if (row.iconWidth !== null) expect(row.iconWidth, `${row.label} icon`).toBeGreaterThan(8);
    }
    await viewer.close();
  });
});
