// The P2-* identifiers in the test titles are the requirement identifiers of the post creation
// work. docs/post-creation/README.md maps each one to its behavior, spec file and screenshots.
// Behavior covered: Choosing or adding a place in the composer, one place per normalised name,
// the location page and its report, and the unavailable state a banned place shows while the posts
// that were tagged there stay visible.

import { expect, test } from '@playwright/test';
import { apiSession, signIn } from './helpers/session';
import { createPost, deletePost, readPost, shoot, shootAtAllWidths } from './helpers/postCreation';

const OWNER = 'user_power';

interface PlaceRow {
  id: string;
  name: string;
  postCount: number;
}

test.describe('places and the location page', () => {
  test('P2-C4-R1 a place is chosen or added in the composer and the post links to its page', async ({
    browser,
  }) => {
    const session = await signIn(browser, OWNER);
    const { page } = session;
    const name = `Spec Lantern Cove ${Date.now()}`;
    const caption = `at the cove ${Date.now()}`;

    await page.goto('/app/compose');
    await page.getByPlaceholder('title').fill(caption);
    await page.getByTestId('option-location').click();
    const picker = page.getByTestId('place-picker');
    await expect(picker).toBeVisible();
    await picker.getByLabel('search places').fill(name);
    await shoot(page, 'P2-C4-R1-picker', 1440);
    await picker.getByRole('button', { name: new RegExp(`Add .${name}.`) }).click();
    await picker.getByRole('button', { name: 'done' }).click();
    await expect(page.getByTestId('option-location')).toContainText(name);
    await page.getByTestId('publish-post').click();
    await page.waitForURL(/\/app$/);

    // The search index is fed by an event, so the new place appears a moment after it is created.
    let place: PlaceRow | undefined;
    await expect
      .poll(
        async () => {
          const found = await session.call<{ content: PlaceRow[] }>(
            'GET',
            `/places/search?q=${encodeURIComponent(name)}&limit=5`
          );
          place = found.data.content.find((row) => row.name === name);
          return place?.name;
        },
        { timeout: 60_000, intervals: [2_000] }
      )
      .toBe(name);

    const posts = await session.call<{ content: { id: string; caption: string }[] }>(
      'GET',
      `/posts/user/${session.user.id}?limit=10`
    );
    const post = posts.data.content.find((row) => row.caption === caption)!;
    await page.goto(`/app/p/${post.id}`);
    await shootAtAllWidths(page, 'P2-C4-R1', async () => {
      await page.evaluate(() => window.scrollTo(0, 0));
    });

    await page.locator('.lx-scrim').getByTestId('post-place').first().click();
    await page.waitForURL(new RegExp(`/app/places/${place!.id}`));
    await expect(page.getByTestId('place-grid')).toBeVisible();
    await expect(page.getByTestId('place-post-count')).toContainText('1');
    await shoot(page, 'P2-C4-R4', 1440);

    await page.getByTestId('report-place').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await shoot(page, 'P2-C4-R7-report', 1440);

    await deletePost(session, post.id);
    await session.close();
  });

  test('P2-C4-R1 two spellings of one name are one place', async ({ browser }) => {
    const owner = await apiSession(browser, OWNER);
    const stamp = Date.now();
    const first = await owner.call<PlaceRow>('POST', '/places', {
      name: `Quiet  Harbour ${stamp}`,
    });
    const second = await owner.call<PlaceRow>('POST', '/places', {
      name: `quiet harbour ${stamp}`,
    });
    expect(first.status).toBeLessThan(300);
    expect(second.data.id).toBe(first.data.id);
    await owner.dispose();
  });

  test('P2-C4-R3 place search finds a seeded place by part of its name', async ({ browser }) => {
    const owner = await apiSession(browser, OWNER);
    const admin = await apiSession(browser, 'admin');
    const registry = await admin.call<{
      content: (PlaceRow & { status: string; postCount: number })[];
    }>('GET', '/admin/places?limit=50');
    expect(registry.status).toBe(200);
    // Only a place a published post uses is searchable, so the target is one with posts.
    const target = registry.data.content.find(
      (row) => row.status === 'active' && row.postCount > 0
    )!;
    expect(target, 'the seed registers active places').toBeDefined();
    const listed = await owner.call<{ content: PlaceRow[] }>(
      'GET',
      `/places/search?q=${encodeURIComponent(target.name.slice(0, 4))}&limit=10`
    );
    expect(listed.status).toBe(200);
    expect(listed.data.content.map((row) => row.name)).toContain(target.name);

    const session = await signIn(browser, OWNER);
    await session.page.goto('/app/compose');
    await session.page.getByTestId('option-location').click();
    const picker = session.page.getByTestId('place-picker');
    await picker.getByLabel('search places').fill(target.name.slice(0, 4));
    await expect(picker.locator(`[data-place="${target.name}"]`)).toBeVisible();
    await shoot(session.page, 'P2-C4-R3', 1440);
    await session.close();
    await owner.dispose();
    await admin.dispose();
  });

  test('P2-C4-R5 a banned place shows as unavailable while its posts stay visible', async ({
    browser,
  }) => {
    const owner = await apiSession(browser, OWNER);
    const admin = await apiSession(browser, 'admin');
    const place = await owner.call<PlaceRow>('POST', '/places', {
      name: `Spec Banned Wharf ${Date.now()}`,
    });
    const post = await createPost(owner, {
      postType: 'text',
      caption: `posted at a place that is banned later ${Date.now()}`,
      status: 'published',
      placeId: place.data.id,
    });

    const ban = await admin.call('PATCH', `/admin/places/${place.data.id}`, {
      status: 'banned',
      note: 'removed from the registry for the spec',
    });
    expect(ban.status, `ban: ${ban.code}`).toBeLessThan(300);

    const reader = await signIn(browser, 'user_public');
    await reader.page.goto(`/app/places/${place.data.id}`);
    await expect(reader.page.getByTestId('place-state')).toContainText(
      'this place is not available'
    );
    await shoot(reader.page, 'P2-C4-R5-unavailable', 1440);

    // The post is untouched: it still reads, and it no longer names the place.
    const still = await readPost(owner, post.id);
    expect(still?.status).toBe('published');
    expect(still?.place).toBeNull();

    // A new post cannot be tagged there.
    const refused = await owner.call('POST', '/posts', {
      postType: 'text',
      caption: 'tagging a banned place',
      status: 'published',
      placeId: place.data.id,
    });
    expect(refused.status).toBe(422);
    expect(refused.code).toBe('POST_PLACE_UNAVAILABLE');

    await admin.call('PATCH', `/admin/places/${place.data.id}`, { status: 'active' });
    await deletePost(owner, post.id);
    await reader.close();
    await owner.dispose();
    await admin.dispose();
  });
});
