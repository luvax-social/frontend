import { expect, test } from '@playwright/test';

/** The envelope every backend response is wrapped in. */
const envelope = (data) => ({ success: true, code: 'OK', message: 'ok', data });

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

const item = (overrides = {}) => ({
  id: 'n1',
  type: 'like_post',
  category: 'like',
  actors: [{ id: 'u1', username: 'anna', displayName: 'anna', isVerified: false }],
  actorCount: 1,
  isRead: false,
  readAt: null,
  isNew: true,
  activityAt: '2026-09-23T10:00:00.000000Z',
  createdAt: '2026-09-23T10:00:00.000000Z',
  target: { kind: 'post', postId: 'p1', available: true },
  preview: null,
  moderation: null,
  relationship: null,
  ...overrides,
});

const STATE = {
  unseen: { count: 1, capped: false },
  seen: null,
  previous: null,
  followRequests: { count: 0, capped: false, recent: [] },
};

const TEST_USER = {
  id: 'u-me',
  username: 'tester',
  displayName: 'tester',
  role: 'user',
  isVerified: false,
};

/**
 * Signs the page in without a real backend. `/app/notifications` sits behind ProtectedRoute,
 * which requires both the persisted `isAuthenticated` flag and a live in-memory access token
 * (useAuthStore never persists the token itself). Seeding localStorage alone leaves the token
 * null until AuthSessionBootstrap's own refresh call resolves, so that call is stubbed too.
 */
async function signIn(page) {
  await page.addInitScript((user) => {
    window.localStorage.setItem(
      'luvax-auth-session',
      JSON.stringify({ state: { user, isAuthenticated: true }, version: 0 })
    );
  }, TEST_USER);
  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      json: envelope({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: TEST_USER,
      }),
    });
  });
}

/** Registers the baseline notification API stubs common to every scenario below. */
async function stubNotificationApi(page, { items = [item()], state = STATE } = {}) {
  await page.route('**/api/v1/notifications?*', async (route) => {
    await route.fulfill({
      status: 200,
      json: envelope({
        content: items,
        pageInfo: { hasNextPage: false },
        head: items[0] ? { activityAt: items[0].activityAt, id: items[0].id } : null,
      }),
    });
  });
  await page.route('**/api/v1/notifications/state', async (route) => {
    await route.fulfill({ status: 200, json: envelope(state) });
  });
  await page.route('**/api/v1/notifications/seen', async (route) => {
    await route.fulfill({ status: 200, json: envelope(state) });
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`notifications at ${viewport.width}px`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await signIn(page);
    });

    test('opening the screen issues POST /seen and no read call; the badge clears', async ({
      page,
    }) => {
      let seenCalls = 0;
      let readCalls = 0;
      await stubNotificationApi(page);
      await page.route('**/api/v1/notifications/seen', async (route) => {
        seenCalls += 1;
        await route.fulfill({
          status: 200,
          json: envelope({ ...STATE, unseen: { count: 0, capped: false } }),
        });
      });
      await page.route('**/api/v1/notifications/*/read', async (route) => {
        readCalls += 1;
        await route.fulfill({ status: 200, json: envelope({ id: 'n1', readAt: 'x' }) });
      });
      await page.goto('/app/notifications');
      await expect(page.getByText(/liked your post/)).toBeVisible();
      await expect.poll(() => seenCalls).toBe(1);
      expect(readCalls).toBe(0);
    });

    test('reload keeps the same "New" section', async ({ page }) => {
      await stubNotificationApi(page);
      await page.goto('/app/notifications');
      await expect(page.getByText('new')).toBeVisible();
      await page.reload();
      await expect(page.getByText('new')).toBeVisible();
    });

    test('each chip requests its own filter', async ({ page }) => {
      await stubNotificationApi(page);
      let lastFilter = null;
      await page.route('**/api/v1/notifications?*', async (route) => {
        const url = new URL(route.request().url());
        lastFilter = url.searchParams.get('filter');
        await route.fulfill({
          status: 200,
          json: envelope({ content: [], pageInfo: { hasNextPage: false }, head: null }),
        });
      });
      await page.goto('/app/notifications');
      await page.getByRole('button', { name: 'unread' }).click();
      await expect.poll(() => lastFilter).toBe('unread');
    });

    test('an unavailable target renders muted and does not navigate', async ({ page }) => {
      await stubNotificationApi(page, {
        items: [item({ target: { kind: 'post', postId: 'p1', available: false } })],
      });
      await page.goto('/app/notifications');
      await expect(page.getByText(/no longer available/i)).toBeVisible();
      await page.locator('.lx-focusable-row').first().click();
      await expect(page).toHaveURL(/\/app\/notifications/);
    });

    test('badge shows 99+ from a capped state', async ({ page }) => {
      await stubNotificationApi(page, { state: { ...STATE, unseen: { count: 99, capped: true } } });
      await page.goto('/app');
      await expect(page.getByLabel('99+ new notifications')).toBeVisible();
    });

    test('no horizontal overflow at this width', async ({ page }) => {
      await stubNotificationApi(page);
      await page.goto('/app/notifications');
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasOverflow).toBe(false);
    });
  });
}
