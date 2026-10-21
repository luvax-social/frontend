import type {
  APIRequestContext,
  APIResponse,
  Browser,
  BrowserContext,
  Page,
} from '@playwright/test';
import { expect } from '@playwright/test';
import path from 'node:path';

/** Every seeded account shares this password (`seed/README.md`, "QA accounts"). */
export const SEED_PASSWORD = 'Password123!';

/** Cloudflare's documented always-pass response, accepted by the local backend's test secret. */
const TURNSTILE_PASS_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

const API = '/api/v1';

/** Playwright runs from the frontend root, so this resolves beside `src/`. */
export const SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  'docs/interaction-control-and-messages/screenshots'
);

/** The viewports modified surfaces are captured at. */
export const ALL_WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

export const DESKTOP = { width: 1440, height: 900 } as const;

export interface SessionUser {
  id: string;
  username: string;
  displayName?: string | null;
  role?: string;
  [key: string]: unknown;
}

interface Envelope<T> {
  success: boolean;
  code: string;
  data: T;
}

export interface ApiResult<T> {
  status: number;
  code: string;
  data: T;
}

/** An account's backend access without a browser: the token and a caller bound to it. */
export interface Api {
  username: string;
  user: SessionUser;
  token: string;
  /** Calls the backend as this account and returns the unwrapped `data` of the envelope. */
  call: <T = unknown>(method: string, url: string, body?: unknown) => Promise<ApiResult<T>>;
}

export interface Session extends Api {
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

/** Cursor pages and plain lists both appear in the API; this reads the items of either. */
export function itemsOf<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const page = data as { content?: T[]; items?: T[] } | null;
  return page?.content ?? page?.items ?? [];
}

async function unwrap<T>(response: APIResponse): Promise<ApiResult<T>> {
  let body: Envelope<T> | null = null;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    body = null;
  }
  return { status: response.status(), code: body?.code ?? '', data: body?.data as T };
}

interface LoginBody {
  data: { accessToken: string; user: SessionUser };
}

/**
 * Logs `username` in. The login endpoint allows a handful of attempts per account a minute, so a
 * 429 waits out the window the server names and tries again instead of failing a spec for the
 * wrong reason.
 */
async function login(request: APIRequestContext, username: string): Promise<LoginBody['data']> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await request.post(`${API}/auth/login`, {
      data: { identifier: username, password: SEED_PASSWORD, turnstileToken: TURNSTILE_PASS_TOKEN },
    });
    if (response.status() === 429) {
      const wait = Number(response.headers()['retry-after'] ?? '60');
      await new Promise((resolve) => setTimeout(resolve, (wait + 1) * 1000));
      continue;
    }
    expect(response.status(), `login as ${username}`).toBe(200);
    return ((await response.json()) as LoginBody).data;
  }
  throw new Error(`login as ${username} stayed rate limited`);
}

function bindCaller(request: APIRequestContext, token: string): Api['call'] {
  return async (method, url, data) => {
    const response = await request.fetch(`${API}${url}`, {
      method,
      data: data === undefined ? undefined : (data as object),
      headers: { Authorization: `Bearer ${token}` },
    });
    return unwrap(response);
  };
}

/** Signs an account in for API calls only. Dispose the returned context when the spec is done. */
export async function apiSession(
  browser: Browser,
  username: string
): Promise<Api & { dispose: () => Promise<void> }> {
  const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
  const { accessToken, user } = await login(context.request, username);
  return {
    username,
    user,
    token: accessToken,
    call: bindCaller(context.request, accessToken),
    dispose: () => context.close(),
  };
}

/**
 * Loads the app once and waits until the shell, not the login form, is on screen.
 *
 * The first load of a context exchanges the refresh cookie for an access token. When that
 * exchange races the dev server compiling a route for the first time, the app can land on the
 * login form although the cookie is good, so a second load settles it.
 */
async function settleSession(page: Page): Promise<void> {
  const loginForm = page.getByRole('button', { name: 'Log in', exact: true });
  const shell = page.getByRole('navigation').first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto('/app');
    await expect(loginForm.or(shell)).toBeVisible();
    if (await shell.isVisible()) return;
  }
  throw new Error('the signed-in shell never appeared');
}

/**
 * Signs `username` in through the real login endpoint and returns a page that is signed in.
 *
 * The refresh cookie lands in the context's jar and the persisted identity is seeded the way
 * the stubbed project does, so the app's own bootstrap exchanges the cookie for an access token
 * exactly as it does after a reload. A fresh context per call keeps the 15 minute access token
 * from expiring inside a long spec.
 */
export async function signIn(
  browser: Browser,
  username: string,
  viewport: { width: number; height: number } = DESKTOP
): Promise<Session> {
  const context = await browser.newContext({ viewport, baseURL: 'http://localhost:5173' });
  const { accessToken, user } = await login(context.request, username);

  await context.addInitScript((identity) => {
    window.localStorage.setItem(
      'luvax-auth-session',
      JSON.stringify({ state: { user: identity, isAuthenticated: true }, version: 0 })
    );
  }, user);

  const page = await context.newPage();
  await settleSession(page);

  return {
    username,
    context,
    page,
    user,
    token: accessToken,
    call: bindCaller(context.request, accessToken),
    close: () => context.close(),
  };
}

/** Resolves a seeded account's id, which API calls need and the seed does not fix. */
export async function userIdOf(session: Api, username: string): Promise<string> {
  const result = await session.call<{ id: string }>('GET', `/users/by-username/${username}`);
  if (result.status === 200 && result.data?.id) return result.data.id;
  const search = await session.call<unknown>(
    'GET',
    `/search/users?q=${encodeURIComponent(username)}&limit=10`
  );
  const match = itemsOf<{ id: string; username: string }>(search.data).find(
    (hit) => hit.username === username
  );
  if (!match) throw new Error(`cannot resolve ${username}`);
  return match.id;
}

/**
 * Waits for animations and web fonts to settle, then writes a full-viewport screenshot to the
 * documented location. The file name carries the requirement and the viewport width.
 */
export async function capture(page: Page, requirementId: string, width: number): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;' +
      'transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}',
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${requirementId}-${width}.png`) });
}

/** Captures the current page at every width, resizing the viewport between shots. */
export async function captureAtAllWidths(
  page: Page,
  requirementId: string,
  prepare?: () => Promise<void>
): Promise<void> {
  for (const size of ALL_WIDTHS) {
    await page.setViewportSize(size);
    if (prepare) await prepare();
    await capture(page, requirementId, size.width);
  }
  await page.setViewportSize(DESKTOP);
}

/** Fails when the page scrolls sideways, which at 390 means something overflowed. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(1);
}

export interface PostSummary {
  id: string;
  caption: string | null;
  author: { id: string; username: string; displayName: string | null };
}

interface CursorEnvelope<T> {
  content: T[];
  pageInfo: { hasNextPage: boolean; endCursor?: string | null };
}

/** The newest published posts of one account, newest first. */
export async function postsOf(api: Api, userId: string, limit = 5): Promise<PostSummary[]> {
  const result = await api.call<CursorEnvelope<PostSummary>>(
    'GET',
    `/posts/user/${userId}?limit=${limit}`
  );
  expect(result.status).toBe(200);
  return itemsOf<PostSummary>(result.data);
}

/** Walks a cursor-paged list endpoint and returns every item from the first `pages` pages. */
export async function walk<T>(api: Api, url: string, pages = 4): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null | undefined;
  for (let page = 0; page < pages; page += 1) {
    const joiner = url.includes('?') ? '&' : '?';
    const target = cursor ? `${url}${joiner}cursor=${encodeURIComponent(cursor)}` : url;
    const result = await api.call<CursorEnvelope<T>>('GET', target);
    expect(result.status, `GET ${target}`).toBe(200);
    items.push(...itemsOf<T>(result.data));
    if (!result.data.pageInfo?.hasNextPage) break;
    cursor = result.data.pageInfo.endCursor;
  }
  return items;
}

/** The comments of a post as `api` sees them, which is the visibility the specs assert on. */
export async function commentsSeenBy(api: Api, postId: string): Promise<{ id: string }[]> {
  return walk<{ id: string }>(api, `/posts/${postId}/comments?limit=50`, 3);
}

/** The menu row with this exact label, wherever the menu is mounted. */
export function menuItem(page: Page, label: string) {
  return page.getByRole('button', { name: label, exact: true });
}

/**
 * Opens the options menu of the first post card on the page, captures it at every width, and
 * leaves the page at the desktop viewport with the menu closed.
 */
export async function captureFeedMenuAtAllWidths(page: Page, requirementId: string) {
  for (const size of ALL_WIDTHS) {
    await page.setViewportSize(size);
    await page.evaluate(() => window.scrollTo(0, 0));
    const card = page.locator('article').first();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'post options' }).click();
    await expect(menuItem(page, 'Not interested')).toBeVisible();
    await capture(page, requirementId, size.width);
    if (size.width === 390) await expectNoHorizontalScroll(page);
    await page.keyboard.press('Escape');
    await expect(menuItem(page, 'Not interested')).toBeHidden();
  }
  await page.setViewportSize(DESKTOP);
}

export interface MuteRow {
  userId: string;
  mutePosts: boolean;
  muteStories: boolean;
  user: { username: string };
}

/** Removes a mute through the API so a spec starts and ends with the account unmuted. */
export async function clearMute(api: Api, targetId: string) {
  await api.call('DELETE', `/social/mutes/${targetId}`);
}
