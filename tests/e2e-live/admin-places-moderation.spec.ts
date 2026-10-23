// The P2-* identifiers in the test titles are the requirement identifiers of the post creation
// work. docs/post-creation/README.md maps each one to its behavior, spec file and screenshots.
// Behavior covered: The administrator places registry, banning, unbanning and deleting a place
// with a reason, a place report that the action resolves, and the posts at a place staying up.

import { expect, test } from '@playwright/test';
import { apiSession, signIn } from './helpers/session';
import { createPost, deletePost, readPost, shoot } from './helpers/postCreation';

const OWNER = 'user_power';
const TURNSTILE_PASS_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

interface PlaceRow {
  id: string;
  name: string;
  status: string;
}

async function placeStatus(admin: Awaited<ReturnType<typeof apiSession>>, id: string) {
  const registry = await admin.call<{ content: PlaceRow[] }>('GET', '/admin/places?limit=100');
  return registry.data.content.find((row) => row.id === id)?.status;
}

test.describe('places registry', () => {
  test.setTimeout(300_000);

  test('P2-C4-R5 an administrator bans, unbans and deletes a place with a reason', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, OWNER);
    const admin = await apiSession(browser, 'admin');
    const name = `Spec Registry Dock ${Date.now()}`;
    const place = await owner.call<PlaceRow>('POST', '/places', { name });
    const post = await createPost(owner, {
      postType: 'text',
      caption: `at the registry dock ${Date.now()}`,
      status: 'published',
      placeId: place.data.id,
    });

    const session = await signIn(browser, 'admin');
    const { page } = session;
    try {
      await page.goto('/admin/places');
      await expect(page.getByRole('heading', { name: 'places' })).toBeVisible();
      await expect(page.getByText(name)).toBeVisible();
      await shoot(page, 'P2-C4-R5-registry', 1440);

      // Banning asks for a reason first, and an empty one is refused in the dialog.
      await page.getByRole('button', { name: `ban ${name}` }).click();
      const dialog = page.getByRole('dialog', { name: `ban ${name}` });
      await dialog.getByRole('button', { name: 'ban place' }).click();
      await expect(dialog.getByText('a reason is required')).toBeVisible();
      await dialog.getByPlaceholder('why this action is being taken').fill('not a real location');
      await shoot(page, 'P2-C4-R5-ban', 1440);
      await dialog.getByRole('button', { name: 'ban place' }).click();
      await expect(page.getByText('place banned')).toBeVisible();
      expect(await placeStatus(admin, place.data.id)).toBe('banned');

      // The post stays up and simply stops naming the place.
      const stillThere = await readPost(owner, post.id);
      expect(stillThere?.status).toBe('published');
      expect(stillThere?.place).toBeNull();

      await page.getByRole('button', { name: `unban ${name}` }).click();
      const unbanDialog = page.getByRole('dialog', { name: `unban ${name}` });
      await unbanDialog.getByPlaceholder('why this action is being taken').fill('checked again');
      await unbanDialog.getByRole('button', { name: 'unban place' }).click();
      await expect(page.getByText('place unbanned')).toBeVisible();
      expect(await placeStatus(admin, place.data.id)).toBe('active');

      await page.getByRole('button', { name: `delete ${name}` }).click();
      const deleteDialog = page.getByRole('dialog', { name: `delete ${name}` });
      await deleteDialog
        .getByPlaceholder('why this action is being taken')
        .fill('duplicate of another place');
      await deleteDialog.getByRole('button', { name: 'delete place' }).click();
      await expect(page.getByText('place deleted')).toBeVisible();
      expect(await placeStatus(admin, place.data.id)).toBe('deleted');

      // Unban brings a deleted place back, so the registry needs no separate restore.
      await page.getByRole('button', { name: `unban ${name}` }).click();
      const restoreDialog = page.getByRole('dialog', { name: `unban ${name}` });
      await restoreDialog.getByPlaceholder('why this action is being taken').fill('restored');
      await restoreDialog.getByRole('button', { name: 'unban place' }).click();
      await expect.poll(async () => placeStatus(admin, place.data.id)).toBe('active');

      // Each decision left an audit row naming the place. The listing is a replica fed by an
      // event, so it catches up a moment after the decision.
      await expect
        .poll(
          async () => {
            const audit = await admin.call<{
              content: { actionType: string; targetEntityId?: string }[];
            }>('GET', '/admin/actions?limit=30');
            return audit.data.content
              .filter((row) => row.targetEntityId === place.data.id)
              .map((row) => row.actionType)
              .sort();
          },
          { timeout: 180_000, intervals: [5_000] }
        )
        .toEqual(expect.arrayContaining(['ban_place', 'delete_place', 'unban_place']));
    } finally {
      await deletePost(owner, post.id);
      await session.close();
      await owner.dispose();
      await admin.dispose();
    }
  });

  test('P2-C4-R7 banning a reported place resolves the report', async ({ browser }) => {
    const owner = await apiSession(browser, OWNER);
    const reporter = await apiSession(browser, 'user_public');
    const admin = await apiSession(browser, 'admin');
    const name = `Spec Reported Pier ${Date.now()}`;
    const place = await owner.call<PlaceRow>('POST', '/places', { name });
    const filed = await reporter.call<{ id: string }>('POST', '/reports', {
      reportType: 'place',
      reportReason: 'spam',
      entityId: place.data.id,
      description: 'the name is an advertisement',
      turnstileToken: TURNSTILE_PASS_TOKEN,
    });
    expect(filed.status, `report a place: ${filed.code}`).toBeLessThan(300);

    const session = await signIn(browser, 'admin');
    const { page } = session;
    try {
      await page.goto(`/admin/reports/${filed.data.id}`);
      await page.getByTestId('open-places-registry').click();
      await page.waitForURL(/\/admin\/places/);
      await expect(page.getByRole('note')).toContainText('you are acting on a report');
      await shoot(page, 'P2-C4-R7', 1440);

      await page.getByRole('button', { name: `ban ${name}` }).click();
      const dialog = page.getByRole('dialog', { name: `ban ${name}` });
      await dialog.getByPlaceholder('why this action is being taken').fill('advertisement');
      await dialog.getByRole('button', { name: 'ban place' }).click();
      await expect(page.getByText('place banned')).toBeVisible();

      const report = await admin.call<{ status: string }>('GET', `/reports/${filed.data.id}`);
      expect(report.data.status).toBe('resolved');
    } finally {
      await admin.call('PATCH', `/admin/places/${place.data.id}`, { status: 'active' });
      await session.close();
      await owner.dispose();
      await reporter.dispose();
      await admin.dispose();
    }
  });
});
