import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  ALL_WIDTHS,
  DESKTOP,
  apiSession,
  capture,
  clearMute,
  expectNoHorizontalScroll,
  itemsOf,
  postsOf,
  signIn,
  userIdOf,
  walk,
} from './helpers/session';
import type { Api, MuteRow } from './helpers/session';

const TARGET = 'hailey.10k';
const MUTE_WRITE = /\/social\/mutes\/[^/]+$/;

interface StoryGroup {
  username: string;
}
interface FeedPost {
  author: { username: string };
}

async function mutesOf(api: Api): Promise<MuteRow[]> {
  const result = await api.call('GET', '/social/mutes?limit=50');
  expect(result.status).toBe(200);
  return itemsOf<MuteRow>(result.data);
}

async function storyNames(api: Api, path: string): Promise<string[]> {
  const result = await api.call<StoryGroup[]>('GET', path);
  expect(result.status).toBe(200);
  return itemsOf<StoryGroup>(result.data).map((group) => group.username);
}

async function postAuthors(api: Api, path: string): Promise<string[]> {
  return (await walk<FeedPost>(api, path, 4)).map((post) => post.author.username);
}

/** Waits for the mute write a switch triggers and returns its response status. */
async function muteWrite(page: Page, trigger: () => Promise<void>, method = 'PUT') {
  const pending = page.waitForResponse(
    (response) => MUTE_WRITE.test(response.url()) && response.request().method() === method
  );
  await trigger();
  return (await pending).status();
}

test.describe('mute', () => {
  let api: Api & { dispose: () => Promise<void> };
  let targetId: string;

  // One login for the group: the login endpoint allows only a few attempts a minute per account.
  test.beforeAll(async ({ browser }) => {
    api = await apiSession(browser, 'user_public');
    targetId = await userIdOf(api, TARGET);
  });

  test.beforeEach(async () => {
    await clearMute(api, targetId);
  });

  test.afterEach(async () => {
    await clearMute(api, targetId);
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('P1-A2-R5 muting from the profile menu uses two independent switches', async ({
    browser,
  }) => {
    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;
    await page.goto(`/app/u/${targetId}`);
    const options = page.getByRole('button', { name: `more options for @${TARGET}` });

    for (const size of ALL_WIDTHS) {
      await page.setViewportSize(size);
      await expect(options).toBeVisible();
      await options.click();
      await expect(page.getByRole('button', { name: `mute @${TARGET}` })).toBeVisible();
      await capture(page, 'P1-A2-R5', size.width);
      if (size.width === 390) await expectNoHorizontalScroll(page);
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize(DESKTOP);

    await options.click();
    await page.getByRole('button', { name: `mute @${TARGET}` }).click();
    const dialog = page.getByRole('dialog', { name: `mute @${TARGET}` });
    await expect(dialog).toContainText("They won't know you muted them.");
    const posts = dialog.getByRole('switch', { name: 'posts' });
    const stories = dialog.getByRole('switch', { name: 'stories' });
    await expect(posts).toHaveAttribute('aria-checked', 'false');
    await expect(stories).toHaveAttribute('aria-checked', 'false');
    await capture(page, 'P1-A2-R5-dialog', 1440);

    expect(await muteWrite(page, () => posts.click())).toBeLessThan(300);
    await expect(posts).toHaveAttribute('aria-checked', 'true');
    let row = (await mutesOf(api)).find((mute) => mute.userId === targetId);
    expect(row).toMatchObject({ mutePosts: true, muteStories: false });

    expect(await muteWrite(page, () => stories.click())).toBeLessThan(300);
    row = (await mutesOf(api)).find((mute) => mute.userId === targetId);
    expect(row).toMatchObject({ mutePosts: true, muteStories: true });

    expect(await muteWrite(page, () => posts.click())).toBeLessThan(300);
    row = (await mutesOf(api)).find((mute) => mute.userId === targetId);
    expect(row).toMatchObject({ mutePosts: false, muteStories: true });

    // Both switches off is the unmute: the server drops the row instead of storing two falses.
    expect(await muteWrite(page, () => stories.click())).toBeLessThan(300);
    expect((await mutesOf(api)).some((mute) => mute.userId === targetId)).toBe(false);
    await viewer.close();
  });

  test('P1-A2-R5 muting from a post menu opens the same dialog', async ({ browser }) => {
    const [post] = await postsOf(api, targetId, 1);
    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;
    await page.goto(`/app/p/${post.id}`);
    await page.getByRole('button', { name: 'post options' }).last().click();
    await page.getByRole('button', { name: `Mute @${TARGET}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `mute @${TARGET}` });
    await expect(dialog).toBeVisible();
    expect(
      await muteWrite(page, () => dialog.getByRole('switch', { name: 'posts' }).click())
    ).toBeLessThan(300);
    await dialog.getByRole('button', { name: 'done' }).click();
    await expect(dialog).toBeHidden();
    expect((await mutesOf(api)).find((mute) => mute.userId === targetId)).toMatchObject({
      mutePosts: true,
      muteStories: false,
    });
    await viewer.close();
  });

  test('P1-A2-R5 the muted account is never notified', async ({ browser }) => {
    const target = await apiSession(browser, TARGET);
    const before = await target.call<unknown>('GET', '/notifications?limit=20');
    const stateBefore = await target.call<unknown>('GET', '/notifications/state');
    expect(before.status).toBe(200);

    const put = await api.call('PUT', `/social/mutes/${targetId}`, {
      mutePosts: true,
      muteStories: true,
    });
    expect(put.status).toBeLessThan(300);
    await clearMute(api, targetId);
    // Notifications are written by a consumer, so give a mute notification time to arrive before
    // concluding that none did.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const after = await target.call<unknown>('GET', '/notifications?limit=20');
    const stateAfter = await target.call<unknown>('GET', '/notifications/state');
    expect(JSON.stringify(after.data)).toBe(JSON.stringify(before.data));
    expect(JSON.stringify(stateAfter.data)).toBe(JSON.stringify(stateBefore.data));
    await target.dispose();
  });

  test('P1-A2-R6 muted posts leave every post list and muted stories leave the tray and discovery', async ({
    browser,
  }) => {
    const lists = ['/posts/feed?limit=20', '/recommendations/feed?limit=20'];
    const trays = ['/stories/feed', '/stories/discovery'];
    expect(await postAuthors(api, lists[0])).toContain(TARGET);
    expect(await storyNames(api, trays[0])).toContain(TARGET);

    // Posts only: posts leave, stories stay.
    await api.call('PUT', `/social/mutes/${targetId}`, { mutePosts: true, muteStories: false });
    for (const path of [...lists, '/recommendations/feed?limit=20&excludeFollowed=true']) {
      expect(await postAuthors(api, path), path).not.toContain(TARGET);
    }
    for (const path of trays) expect(await storyNames(api, path), path).toContain(TARGET);

    // Stories only: stories leave, posts return.
    await api.call('PUT', `/social/mutes/${targetId}`, { mutePosts: false, muteStories: true });
    expect(await postAuthors(api, lists[0])).toContain(TARGET);
    for (const path of trays) expect(await storyNames(api, path), path).not.toContain(TARGET);

    // The tray in the UI follows the API.
    const viewer = await signIn(browser, 'user_public');
    await viewer.page.goto('/app');
    await expect(viewer.page.locator('article').first()).toBeVisible();
    await expect(viewer.page.getByText('your story')).toBeVisible();
    await expect(viewer.page.getByText(/^Hailey Sim/)).toHaveCount(0);

    // Everything else about the account is unaffected.
    expect((await api.call('GET', `/users/by-username/${TARGET}`)).status).toBe(200);
    expect((await postsOf(api, targetId, 3)).length).toBeGreaterThan(0);
    const search = await api.call<unknown>('GET', `/users/search?q=${TARGET}&limit=10`);
    expect(JSON.stringify(search.data)).toContain(TARGET);
    await viewer.page.goto(`/app/u/${targetId}`);
    await expect(viewer.page.getByText(`@${TARGET}`).first()).toBeVisible();
    await viewer.close();

    await api.call('PUT', `/social/mutes/${targetId}`, { mutePosts: true, muteStories: true });
    for (const path of lists) expect(await postAuthors(api, path), path).not.toContain(TARGET);
    for (const path of trays) expect(await storyNames(api, path), path).not.toContain(TARGET);
  });

  test('P1-A2-R7 settings lists muted accounts with both switches and unmutes them', async ({
    browser,
  }) => {
    await api.call('PUT', `/social/mutes/${targetId}`, { mutePosts: true, muteStories: true });
    const viewer = await signIn(browser, 'user_public');
    const { page } = viewer;
    await page.goto('/app/settings/muted');

    // Seeded mutes: posts only, stories only and both.
    const posts = (handle: string) =>
      page.getByRole('switch', { name: `mute posts from @${handle}` });
    const stories = (handle: string) =>
      page.getByRole('switch', { name: `mute stories from @${handle}` });
    await expect(posts('shop.mimidress')).toHaveAttribute('aria-checked', 'true');
    await expect(stories('shop.mimidress')).toHaveAttribute('aria-checked', 'false');
    await expect(posts('victor.marathon')).toHaveAttribute('aria-checked', 'false');
    await expect(stories('victor.marathon')).toHaveAttribute('aria-checked', 'true');
    await expect(posts('grandma.roses')).toHaveAttribute('aria-checked', 'true');
    await expect(stories('grandma.roses')).toHaveAttribute('aria-checked', 'true');
    await expect(posts(TARGET)).toBeVisible();
    await capture(page, 'P1-A2-R7', 1440);

    expect(await muteWrite(page, () => stories(TARGET).click())).toBeLessThan(300);
    expect((await mutesOf(api)).find((mute) => mute.userId === targetId)).toMatchObject({
      mutePosts: true,
      muteStories: false,
    });

    expect(
      await muteWrite(
        page,
        () => page.getByRole('button', { name: `unmute @${TARGET}` }).click(),
        'DELETE'
      )
    ).toBeLessThan(300);
    await expect(posts(TARGET)).toHaveCount(0);
    expect((await mutesOf(api)).some((mute) => mute.userId === targetId)).toBe(false);

    // Not interested and show fewer have no management page.
    await page.goto('/app/settings');
    await expect(page.getByText(/not interested|show fewer/i)).toHaveCount(0);
    await viewer.close();
  });
});
