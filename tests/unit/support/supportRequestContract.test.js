import { describe, expect, it, vi, beforeEach } from 'vitest';

import { buildBody, pickParams } from '@/utils/requestContract';

const post = vi.fn();
const get = vi.fn();
const patch = vi.fn();
const publicPost = vi.fn();

vi.mock('@/api/axiosClient', () => ({
  axiosClient: {
    post: (...args) => post(...args),
    get: (...args) => get(...args),
    patch: (...args) => patch(...args),
  },
  publicClient: {
    post: (...args) => publicPost(...args),
    get: (...args) => get(...args),
  },
}));

const okEnvelope = { data: { data: { ok: true } } };

/**
 * The backend rejects an undeclared query parameter or body field with 400, so
 * the two shortcuts React invites - spreading a filter into `params` and
 * handing form state to a request body - both fail against it. These tests pin
 * that the support clients assemble requests explicitly rather than by
 * spreading, and that the one enum seam is crossed.
 */
describe('pickParams', () => {
  it('keeps only declared keys', () => {
    expect(pickParams({ status: 'OPEN', rogue: 'x' }, ['status'])).toEqual({ status: 'OPEN' });
  });

  it('drops undefined, null and blank values', () => {
    expect(pickParams({ a: undefined, b: null, c: '  ', d: 0 }, ['a', 'b', 'c', 'd'])).toEqual({
      d: 0,
    });
  });
});

describe('buildBody', () => {
  it('drops undefined but keeps null and empty string', () => {
    expect(buildBody({ a: undefined, b: null, c: '' })).toEqual({ b: null, c: '' });
  });
});

describe('the support client', () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue(okEnvelope);
    get.mockReset().mockResolvedValue({ data: { data: [] } });
    patch.mockReset().mockResolvedValue(okEnvelope);
    publicPost.mockReset().mockResolvedValue(okEnvelope);
  });

  it('uppercases the category, because the vocabulary key is not the enum name', async () => {
    // The vocabulary answers lowercase keys while the request DTO binds a Java
    // enum, which Jackson reads by its uppercase constant name and refuses
    // case-insensitively. Sending the key as it arrives answers 400.
    const { createTicket, toCategoryEnum, toCategoryKey } =
      await import('@/features/support/services/supportApi');
    expect(toCategoryEnum('appeal_ban')).toBe('APPEAL_BAN');
    expect(toCategoryKey('APPEAL_BAN')).toBe('appeal_ban');

    await createTicket({ category: 'bug_report', subject: 's', body: 'b' });
    expect(post).toHaveBeenCalledWith('/support/tickets', {
      category: 'BUG_REPORT',
      subject: 's',
      body: 'b',
    });
  });

  it('sends only the three declared ticket fields', async () => {
    const { createTicket } = await import('@/features/support/services/supportApi');
    await createTicket({ category: 'other', subject: 's', body: 'b', rogue: 'x' });
    expect(Object.keys(post.mock.calls[0][1]).sort()).toEqual(['body', 'category', 'subject']);
  });

  it('sends the appeal through the anonymous client and without a category', async () => {
    // The category comes from the token server-side. An appeal path that used
    // the authenticated client would also try to refresh a session the banned
    // submitter has never had.
    const { createAppeal } = await import('@/features/support/services/supportApi');
    await createAppeal({ token: 't', subject: 's', body: 'b' });
    expect(publicPost).toHaveBeenCalledWith('/support/appeal', {
      token: 't',
      subject: 's',
      body: 'b',
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('sends the confirmation token as a query parameter, not a body', async () => {
    // This endpoint declares @RequestParam("token") while the appeal endpoint
    // beside it takes a body. Sending a body here answers
    // MISSING_REQUIRED_PARAMETER, which end-to-end testing caught.
    const { confirmPublicTicket } = await import('@/features/support/services/supportApi');
    await confirmPublicTicket('raw-token');
    expect(publicPost).toHaveBeenCalledWith('/support/public/confirm', null, {
      params: { token: 'raw-token' },
    });
  });

  it('sends the public form through the anonymous client with its turnstile token', async () => {
    const { createPublicTicket } = await import('@/features/support/services/supportApi');
    await createPublicTicket({
      contactEmail: 'a@example.invalid',
      category: 'bug_report',
      subject: 's',
      body: 'b',
      turnstileToken: 'tok',
    });
    expect(publicPost).toHaveBeenCalledWith('/support/public/tickets', {
      contactEmail: 'a@example.invalid',
      category: 'BUG_REPORT',
      subject: 's',
      body: 'b',
      turnstileToken: 'tok',
    });
  });

  it('names every verification field rather than spreading the form', async () => {
    const { createVerificationRequest } = await import('@/features/support/services/supportApi');
    await createVerificationRequest({
      categoryKey: 'music',
      claimedName: 'someone',
      evidenceWebsite: 'w',
      rogueField: 'must not reach the wire',
    });
    const body = post.mock.calls[0][1];
    expect(body).not.toHaveProperty('rogueField');
    expect(body.categoryKey).toBe('music');
    // The category key stays lowercase here: this endpoint binds a String
    // against verification_categories, not the SupportCategory enum.
    expect(body.claimedName).toBe('someone');
  });

  it('sends exactly the field names CreateVerificationRequest declares', async () => {
    // The previous assertion only proved that a rogue field was dropped, which
    // is why two wrong names survived: `evidenceAward` and `evidenceOther`
    // against a record declaring `evidenceOfficialListing` and `evidenceNote`.
    // The endpoint refuses an undeclared body field rather than ignoring it, so
    // every submission answered 400 MALFORMED_REQUEST_BODY - and because the
    // form seeds each field with an empty string, both were on the wire whether
    // or not the requester typed in them. Pinning the whole key set is the only
    // assertion that catches that; a per-field spot check does not.
    const { createVerificationRequest } = await import('@/features/support/services/supportApi');
    const { EVIDENCE_FIELDS } = await import('@/features/support/utils/supportSchemas');

    // Every evidence field carries a value, because `buildBody` drops only
    // `undefined`: an evidence field left out of this call would be absent from
    // the body for a reason that has nothing to do with its name.
    await createVerificationRequest({
      categoryKey: 'music',
      claimedName: 'someone',
      ...Object.fromEntries(EVIDENCE_FIELDS.map((field) => [field.name, 'x'])),
    });

    expect(Object.keys(post.mock.calls[0][1]).sort()).toEqual(
      [
        'categoryKey',
        'claimedName',
        'evidenceWebsite',
        'evidenceOtherProfile',
        'evidenceEmailDomain',
        'evidencePublishedWork',
        'evidencePress',
        'evidenceOfficialListing',
        'evidenceNote',
      ].sort()
    );
    // The form and the wire must not be able to drift apart either: a field
    // renamed in one place and not the other reopens the same defect.
    expect(EVIDENCE_FIELDS.map((field) => field.name).sort()).toEqual(
      [
        'evidenceWebsite',
        'evidenceOtherProfile',
        'evidenceEmailDomain',
        'evidencePublishedWork',
        'evidencePress',
        'evidenceOfficialListing',
        'evidenceNote',
      ].sort()
    );
  });
});

describe('the staff client', () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue(okEnvelope);
    get.mockReset().mockResolvedValue({ data: { data: [] } });
    patch.mockReset().mockResolvedValue(okEnvelope);
  });

  it('sends only status and limit on the queue', async () => {
    const { supportAdminApi } = await import('@/features/admin/api/supportAdminApi');
    await supportAdminApi.listTickets({ status: 'OPEN', limit: 20, rogue: 'x' });
    expect(get).toHaveBeenCalledWith('/admin/support/tickets', {
      params: { status: 'OPEN', limit: 20 },
    });
  });

  it('omits an absent status rather than sending an empty one', async () => {
    const { supportAdminApi } = await import('@/features/admin/api/supportAdminApi');
    await supportAdminApi.listTickets({ status: undefined, limit: 20 });
    expect(get.mock.calls[0][1].params).toEqual({ limit: 20 });
  });

  it('sends reject as a query parameter and the note in the body', async () => {
    const { supportAdminApi } = await import('@/features/admin/api/supportAdminApi');
    await supportAdminApi.respondToTicket('t1', {
      staffResponse: 'r',
      internalNote: 'n',
      reject: true,
    });
    expect(post).toHaveBeenCalledWith(
      '/admin/support/tickets/t1/respond',
      { staffResponse: 'r', internalNote: 'n' },
      { params: { reject: true } }
    );
  });

  it('sends the escalation as reason, the field the request record declares', async () => {
    const { supportAdminApi } = await import('@/features/admin/api/supportAdminApi');
    await supportAdminApi.escalateTicket('t1', { reason: 'needs an administrator' });
    expect(patch).toHaveBeenCalledWith('/admin/support/tickets/t1/escalate', {
      reason: 'needs an administrator',
    });
  });
});
