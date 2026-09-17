import { expect, test } from '@playwright/test';

/**
 * The two anonymous appeal paths, driven through the real application.
 *
 * Only the support API is stubbed, so routing, the Turnstile widget, the forms
 * and every rendered state are the shipped ones.
 */

const STATUS_PATH = '/support/appeal/status';
const RESEND_PATH = '/support/appeal/resend';

/** The envelope every backend response is wrapped in. */
const envelope = (data) => ({ success: true, code: 'OK', message: 'ok', data });

/** The shape a refusal arrives in, which the interface branches on by `code`. */
const refusal = (code) => ({ success: false, code, message: 'Refused' });

const TICKET = {
  id: '3f1c2b70-8a4e-4a1d-9f32-7e5b0c9d1a44',
  subject: 'Appealing my warning',
  body: 'I believe this warning was issued in error. Please look at the context again.',
  status: 'OPEN',
  category: 'APPEAL_WARNING_STRIKE',
  source: 'SIGNED_LINK',
  createdAt: '2026-09-17T16:45:00Z',
  staffResponse: null,
  respondedAt: null,
};

test.describe('the lost-link recovery form', () => {
  test('submits and reaches its success state', async ({ page }) => {
    let posted = 0;
    await page.route('**/api/v1/support/appeal/resend', async (route) => {
      posted += 1;
      await route.fulfill({ status: 200, json: envelope(null) });
    });

    await page.goto(RESEND_PATH);
    await expect(
      page.getByRole('heading', { name: /send me my appeal link again/i })
    ).toBeVisible();

    await page.getByLabel(/your email/i).fill('banned@example.com');

    // The submit control stays disabled until the challenge hands a token up,
    // so waiting for it to enable is waiting for Turnstile to have solved.
    const submit = page.getByRole('button', { name: /send the link/i });
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await submit.click();

    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
    // One state, and the form is gone with it. A second submission would be a
    // second mail for one request.
    await expect(page.getByRole('button', { name: /send the link/i })).toHaveCount(0);
    expect(posted).toBe(1);
  });

  // A Turnstile token is spent by the request that carries it, whatever the
  // server then decides. Without the re-arm, the retry sends a token the server
  // has already consumed and is refused for a reason nothing on screen explains.
  test('re-arms the challenge after a refusal, so a retry can succeed', async ({ page }) => {
    let attempts = 0;
    await page.route('**/api/v1/support/appeal/resend', async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({ status: 400, json: refusal('SUPPORT_CAPTCHA_FAILED') });
        return;
      }
      await route.fulfill({ status: 200, json: envelope(null) });
    });

    await page.goto(RESEND_PATH);
    await page.getByLabel(/your email/i).fill('banned@example.com');

    const submit = page.getByRole('button', { name: /send the link/i });
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await submit.click();

    // The refusal names the challenge rather than the address, because the
    // address is not what was rejected.
    await expect(page.getByRole('alert')).toContainText(/challenge/i);

    // Re-armed: the control becomes available again once a fresh token arrives.
    await expect(submit).toBeEnabled({ timeout: 30_000 });
    await submit.click();
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
    expect(attempts).toBe(2);
  });
});

test.describe('the anonymous status screen', () => {
  test('renders a known ticket', async ({ page }) => {
    await page.route('**/api/v1/support/appeal/status**', async (route) => {
      await route.fulfill({ status: 200, json: envelope(TICKET) });
    });

    await page.goto(`${STATUS_PATH}?token=a-known-status-token`);

    await expect(page.getByRole('heading', { name: /your appeal/i })).toBeVisible();
    await expect(page.getByText(TICKET.subject)).toBeVisible();
    await expect(page.getByText(TICKET.body)).toBeVisible();

    // Read-only in the strongest sense: there is no control here at all.
    await expect(page.getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);
  });

  test('never writes the token to browser storage', async ({ page }) => {
    await page.route('**/api/v1/support/appeal/status**', async (route) => {
      await route.fulfill({ status: 200, json: envelope(TICKET) });
    });

    await page.goto(`${STATUS_PATH}?token=a-known-status-token`);
    await expect(page.getByText(TICKET.subject)).toBeVisible();

    const stored = await page.evaluate(() => {
      const dump = (store) => Object.entries(store).map(([k, v]) => `${k}=${v}`);
      return [...dump(window.localStorage), ...dump(window.sessionStorage)].join('\n');
    });
    expect(stored).not.toContain('a-known-status-token');
    expect(await page.evaluate(() => document.cookie)).not.toContain('a-known-status-token');
  });

  // Unknown, expired and malformed all answer SUPPORT_TOKEN_INVALID. Telling
  // them apart anywhere - copy, layout, or which controls are offered - would
  // make the page an oracle for which guesses named something real.
  test('answers an unknown, an expired and a malformed token identically', async ({ page }) => {
    const render = async (token) => {
      await page.route('**/api/v1/support/appeal/status**', async (route) => {
        await route.fulfill({ status: 400, json: refusal('SUPPORT_TOKEN_INVALID') });
      });
      await page.goto(`${STATUS_PATH}?token=${token}`);
      await expect(page.getByRole('alert')).toBeVisible();
      return page.evaluate(() => ({
        heading: document.querySelector('h1')?.textContent ?? '',
        alert: document.querySelector('[role="alert"]')?.textContent ?? '',
        links: Array.from(document.querySelectorAll('a'))
          .map((a) => a.textContent)
          .filter(Boolean)
          .sort(),
        buttons: Array.from(document.querySelectorAll('button')).map((b) => b.textContent),
      }));
    };

    const unknown = await render('a-token-that-was-never-issued');
    const expired = await render('a-token-that-has-since-expired');
    const malformed = await render('%%%not-a-token%%%');

    expect(expired).toEqual(unknown);
    expect(malformed).toEqual(unknown);
  });
});
