// The P2-* identifiers in the test titles are the requirement identifiers of the post creation
// work. docs/post-creation/README.md maps each one to its behavior, spec file and screenshots.
// Behavior covered: A scheduled post whose place was banned before it came due goes back to
// drafts with a notification that names the reason and opens the draft in the composer.

import { expect, test } from '@playwright/test';
import { apiSession, signIn } from './helpers/session';
import {
  createPost,
  deleteAllHeld,
  deletePost,
  notificationsOf,
  readPost,
  shoot,
  shootAtAllWidths,
} from './helpers/postCreation';

const OWNER = 'user_power';

test('P2-C1-R5 a scheduled post with a banned place returns to drafts and says why', async ({
  browser,
}) => {
  // The publisher runs every 30 seconds and the shortest schedule is a minute out.
  test.setTimeout(420_000);
  const owner = await apiSession(browser, OWNER);
  const admin = await apiSession(browser, 'admin');
  await deleteAllHeld(owner);

  const name = `Failure Quay ${Date.now()}`;
  const place = await owner.call<{ id: string }>('POST', '/places', { name });
  expect(place.status, `create place: ${place.code}`).toBeLessThan(300);

  const caption = `will not go out ${Date.now()}`;
  const scheduled = await createPost(owner, {
    postType: 'text',
    caption,
    status: 'scheduled',
    scheduledAt: new Date(Date.now() + 150_000).toISOString(),
    placeId: place.data.id,
  });
  expect(scheduled.status).toBe('scheduled');

  const ban = await admin.call('PATCH', `/admin/places/${place.data.id}`, {
    status: 'banned',
    note: 'closed for the failure scenario',
  });
  expect(ban.status, `ban place: ${ban.code}`).toBeLessThan(300);

  await expect
    .poll(async () => (await readPost(owner, scheduled.id))?.status, {
      timeout: 300_000,
      intervals: [5_000],
    })
    .toBe('draft');

  const notice = (await notificationsOf(owner)).find(
    (item) => item.type === 'scheduled_post_failed' && item.target.postId === scheduled.id
  );
  expect(notice, 'the owner is told').toBeDefined();

  const session = await signIn(browser, OWNER);
  const { page } = session;
  await page.goto('/app/notifications');
  const row = page.getByText('Your scheduled post went back to drafts').first();
  await expect(row).toBeVisible();
  await expect(page.getByText('its place is no longer available').first()).toBeVisible();
  await shoot(page, 'P2-C1-R5', 1440);
  await shootAtAllWidths(page, 'P2-A5-R11-failed-schedule', async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
  });

  await page.getByRole('button', { name: 'open draft', exact: true }).first().click();
  await page.waitForURL(/\/app\/compose/);
  await expect(page.getByPlaceholder('title')).toHaveValue(caption);

  // The draft opens without the place that is gone, so posting it again needs no change.
  await expect(page.getByTestId('option-location')).toContainText('none');
  await shoot(page, 'P2-C1-R5-draft', 1440);

  await deletePost(owner, scheduled.id);
  await admin.call('PATCH', `/admin/places/${place.data.id}`, { status: 'active' });
  await session.close();
  await owner.dispose();
  await admin.dispose();
});
