import { describe, expect, it, vi, beforeEach } from 'vitest';

import { appealResendSchema, inProductAppealSchema } from '@/features/support/utils/supportSchemas';
import { CONTENT_REMOVAL_TYPES, appealPath, appealableActionId } from '@/utils/appealEntry';

const post = vi.fn();
const get = vi.fn();
const publicPost = vi.fn();
const publicGet = vi.fn();

vi.mock('@/api/axiosClient', () => ({
  axiosClient: {
    post: (...args) => post(...args),
    get: (...args) => get(...args),
  },
  publicClient: {
    post: (...args) => publicPost(...args),
    get: (...args) => publicGet(...args),
  },
}));

const okEnvelope = (data) => ({ data: { data } });

/**
 * The two schemas added for the appeal reachability work.
 *
 * Every rule here mirrors a jakarta.validation annotation on the matching
 * backend record, which is the contract these tests exist to pin: a schema that
 * rejects what the server accepts blocks a legitimate request, and one that
 * accepts what the server rejects turns a friendly message into a 400.
 */
describe('appealResendSchema', () => {
  it('accepts an ordinary address', () => {
    const parsed = appealResendSchema.safeParse({ contactEmail: 'banned@example.com' });
    expect(parsed.success).toBe(true);
  });

  it('trims before validating, so a pasted address with spaces is accepted', () => {
    const parsed = appealResendSchema.safeParse({ contactEmail: '  banned@example.com  ' });
    expect(parsed.success).toBe(true);
    expect(parsed.data.contactEmail).toBe('banned@example.com');
  });

  it('refuses a blank address', () => {
    expect(appealResendSchema.safeParse({ contactEmail: '   ' }).success).toBe(false);
  });

  it('refuses something that is not an address', () => {
    expect(appealResendSchema.safeParse({ contactEmail: 'not-an-email' }).success).toBe(false);
  });

  // ResendAppealLinkRequest carries @Size(max = 255).
  it('refuses an address past the backend length limit', () => {
    const tooLong = `${'a'.repeat(250)}@example.com`;
    expect(appealResendSchema.safeParse({ contactEmail: tooLong }).success).toBe(false);
  });

  // The Turnstile token is deliberately not a schema field, so a refused
  // challenge reads as its own state rather than as a validation error on a
  // field the reader filled in correctly.
  it('does not carry the turnstile token', () => {
    const parsed = appealResendSchema.safeParse({
      contactEmail: 'banned@example.com',
      turnstileToken: 'cf-token',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data.turnstileToken).toBeUndefined();
  });
});

describe('inProductAppealSchema', () => {
  const valid = { adminActionId: 'a-uuid', subject: 'Subject', body: 'Body' };

  it('accepts a complete appeal', () => {
    expect(inProductAppealSchema.safeParse(valid).success).toBe(true);
  });

  it('refuses one with no decision named', () => {
    expect(inProductAppealSchema.safeParse({ ...valid, adminActionId: '' }).success).toBe(false);
  });

  it('refuses a blank subject or body', () => {
    expect(inProductAppealSchema.safeParse({ ...valid, subject: '  ' }).success).toBe(false);
    expect(inProductAppealSchema.safeParse({ ...valid, body: '  ' }).success).toBe(false);
  });

  // SignedAppealRequest and InProductAppealRequest declare the same limits.
  it('refuses a subject past 200 or a body past 5000 characters', () => {
    expect(inProductAppealSchema.safeParse({ ...valid, subject: 'x'.repeat(201) }).success).toBe(
      false
    );
    expect(inProductAppealSchema.safeParse({ ...valid, body: 'x'.repeat(5001) }).success).toBe(
      false
    );
  });

  // The category follows from the decision and is derived server-side. A
  // client-supplied one would let somebody appeal something they were never
  // entitled to appeal, which is why the record has no field for it.
  it('does not carry a category', () => {
    const parsed = inProductAppealSchema.safeParse({ ...valid, category: 'APPEAL_BAN' });
    expect(parsed.success).toBe(true);
    expect(parsed.data.category).toBeUndefined();
  });
});

describe('the appeal wire layer', () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue(okEnvelope({ id: 't1' }));
    publicPost.mockReset().mockResolvedValue(okEnvelope(null));
    publicGet.mockReset().mockResolvedValue(okEnvelope({ id: 't1' }));
  });

  it('posts the in-product appeal with exactly the declared fields', async () => {
    const { createInProductAppeal } = await import('@/features/support/services/supportApi');
    await createInProductAppeal({
      adminActionId: 'action-1',
      subject: 'Subject',
      body: 'Body',
    });

    const [url, sent] = post.mock.calls[0];
    expect(url).toBe('/support/appeals');
    // The endpoint rejects an undeclared body field outright, so the exact key
    // set is the contract rather than a convention.
    expect(Object.keys(sent).sort()).toEqual(['adminActionId', 'body', 'subject']);
  });

  it('uses the authenticated client for the in-product appeal', async () => {
    const { createInProductAppeal } = await import('@/features/support/services/supportApi');
    await createInProductAppeal({ adminActionId: 'a', subject: 's', body: 'b' });

    expect(post).toHaveBeenCalledTimes(1);
    expect(publicPost).not.toHaveBeenCalled();
  });

  it('posts the resend request anonymously with exactly the declared fields', async () => {
    const { resendAppealLink } = await import('@/features/support/services/supportApi');
    await resendAppealLink({ contactEmail: 'a@b.com', turnstileToken: 'cf' });

    const [url, sent] = publicPost.mock.calls[0];
    expect(url).toBe('/support/appeal/resend');
    expect(Object.keys(sent).sort()).toEqual(['contactEmail', 'turnstileToken']);
    // Anonymous by necessity: the account asking is the one that cannot sign in.
    expect(post).not.toHaveBeenCalled();
  });

  it('reads the appeal status anonymously, by query parameter', async () => {
    const { readAppealStatus } = await import('@/features/support/services/supportApi');
    await readAppealStatus('status-token');

    const [url, config] = publicGet.mock.calls[0];
    expect(url).toBe('/support/appeal/status');
    expect(config.params).toEqual({ token: 'status-token' });
    expect(get).not.toHaveBeenCalled();
  });
});

/**
 * The shared entry-point helper.
 *
 * Both in-product entries exist because the appeal link for a decision lived
 * only inside one email. What each has to get right is the identifier it hands
 * on: an appeal opened against the wrong audit row is an appeal against the
 * wrong decision, so one builder serves both.
 */
describe('appealPath', () => {
  it('points at the support screen and names the decision', () => {
    expect(appealPath('action-42')).toBe('/app/settings/support?appeal=action-42');
  });

  it('encodes the identifier rather than splicing it in raw', () => {
    expect(appealPath('a/b c&d')).toBe('/app/settings/support?appeal=a%2Fb%20c%26d');
  });

  // The support screen reads the plain address as the ordinary ticket form,
  // which is the right fallback for a row that carries no decision.
  it('falls back to the plain support address with no decision', () => {
    expect(appealPath('')).toBe('/app/settings/support');
    expect(appealPath(undefined)).toBe('/app/settings/support');
  });
});

describe('appealableActionId', () => {
  it('offers an appeal on each of the four removal notices', () => {
    for (const type of CONTENT_REMOVAL_TYPES) {
      expect(appealableActionId({ type, entityType: 'admin_action', entityId: 'action-1' })).toBe(
        'action-1'
      );
    }
  });

  it('covers comment, story and message removal, which had no notice at all before', () => {
    expect(CONTENT_REMOVAL_TYPES.has('comment_removed')).toBe(true);
    expect(CONTENT_REMOVAL_TYPES.has('story_removed')).toBe(true);
    expect(CONTENT_REMOVAL_TYPES.has('message_removed')).toBe(true);
  });

  // A post_removed notification written before this work points at the post.
  // Offering an appeal against a post id would open an appeal against nothing.
  it('offers nothing when the entity is not an audit row', () => {
    expect(
      appealableActionId({ type: 'post_removed', entityType: 'post', entityId: 'post-1' })
    ).toBeNull();
  });

  it('offers nothing on a notification that is not an enforcement removal', () => {
    expect(
      appealableActionId({ type: 'like_post', entityType: 'admin_action', entityId: 'x' })
    ).toBeNull();
    // Reinstatement carries no appeal: there is nothing to contest about being
    // restored, which is why the backend maps it to no category either.
    expect(
      appealableActionId({ type: 'post_restored', entityType: 'admin_action', entityId: 'x' })
    ).toBeNull();
  });

  it('tolerates a malformed row', () => {
    expect(appealableActionId(null)).toBeNull();
    expect(appealableActionId({})).toBeNull();
  });
});
