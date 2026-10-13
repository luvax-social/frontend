import type { VerifiedUser } from './support/identity.ts';
import { beforeAll, describe, expect, it } from 'vitest';
import { api, assertStackReachable, expectEnvelope } from './support/client.ts';
import { createVerifiedUser } from './support/identity.ts';

let user: VerifiedUser;

beforeAll(async () => {
  await assertStackReachable();
  user = await createVerifiedUser();
}, 40000);

/**
 * One authenticated read per module. These are contract smoke tests: they assert the endpoint
 * is routed, authorises the caller, and returns the ApiResponse envelope. They deliberately
 * do not assert on content, which depends on database state.
 */
const READS = [
  ['posts feed', '/posts/feed?limit=5'],
  ['post search', '/posts/search?q=a&limit=5'],
  ['saved posts', '/posts/saved?limit=5'],
  ['liked posts', '/posts/liked?limit=5'],
  ['stories feed', '/stories/feed'],
  ['notifications', '/notifications?limit=5'],
  ['notification unread count', '/notifications/unread-count'],
  ['media constraints', '/media/constraints'],
  // q has @Size(min = 2) on the server, so a single character is a 400 by contract.
  ['user search', '/users/search?q=te&limit=5'],
  ['my settings', '/users/me/settings'],
  ['conversations', '/conversations?limit=5'],
  ['conversations unread count', '/conversations/unread-count'],
];

describe('authenticated module reads', () => {
  for (const [label, path] of READS) {
    it(`${label} returns 200 with the standard envelope`, async () => {
      const result = await api(path, { token: user.accessToken });
      expectEnvelope(result);
      expect(result.status).toBe(200);
      expect(result.body!.success).toBe(true);
    });
  }
});

describe('social reads', () => {
  it('returns the follower list for the current user', async () => {
    const result = await api(`/social/users/${user.user.id}/followers?limit=5`, {
      token: user.accessToken,
    });
    expectEnvelope(result);
    expect(result.status).toBe(200);
  });

  it('returns the blocked list', async () => {
    const result = await api('/social/blocked?limit=5', { token: user.accessToken });
    expect(result.status).toBe(200);
  });

  it('returns pending follow requests', async () => {
    const result = await api('/social/follow-requests', { token: user.accessToken });
    expect(result.status).toBe(200);
  });
});

describe('query parameter constraints', () => {
  it('rejects a user search shorter than the documented minimum', async () => {
    const result = await api('/users/search?q=t&limit=5', { token: user.accessToken });
    expect(result.status).toBe(400);
  });

  it('rejects a limit above the documented maximum', async () => {
    const result = await api('/users/search?q=te&limit=101', { token: user.accessToken });
    expect(result.status).toBe(400);
  });
});

describe('public reads', () => {
  it('serves hashtag trending without a token', async () => {
    const result = await api('/hashtags/trending?limit=5');
    expectEnvelope(result);
    expect(result.status).toBe(200);
  });

  it('serves hashtag search without a token', async () => {
    const result = await api('/hashtags/search?q=a&limit=5');
    expect(result.status).toBe(200);
  });
});

describe('authorization boundaries', () => {
  it('denies the admin audit log to an ordinary user', async () => {
    const result = await api('/admin/actions?limit=5', { token: user.accessToken });
    expect(result.status).toBe(403);
  });

  it('denies the moderator report queue to an ordinary user', async () => {
    const result = await api('/reports/pending?limit=5', { token: user.accessToken });
    expect(result.status).toBe(403);
  });
});
