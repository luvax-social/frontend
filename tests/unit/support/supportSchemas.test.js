import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_FIELDS,
  MIN_EVIDENCE_FIELDS,
  appealSchema,
  countEvidence,
  publicTicketSchema,
  ticketSchema,
  verificationSchema,
} from '@/features/support/utils/supportSchemas';

/**
 * These schemas mirror jakarta.validation annotations on the backend request
 * records. The property that matters is that they neither reject a value the
 * server accepts nor accept one it rejects, so the boundaries are tested at the
 * exact sizes the annotations declare.
 */

const validVerification = {
  categoryKey: 'music',
  claimedName: 'someone',
  evidenceWebsite: 'https://example.invalid',
  evidenceOtherProfile: 'https://example.invalid/profile',
  evidenceEmailDomain: 'example.invalid',
  evidencePublishedWork: '',
  evidencePress: '',
  evidenceOfficialListing: '',
  evidenceNote: '',
};

describe('ticketSchema', () => {
  it('accepts a complete request', () => {
    const result = ticketSchema.safeParse({
      category: 'bug_report',
      subject: 'something broke',
      body: 'here is what happened',
    });
    expect(result.success).toBe(true);
  });

  it('requires a category, because the server binds a non-null enum', () => {
    const result = ticketSchema.safeParse({ category: '', subject: 'a', body: 'b' });
    expect(result.success).toBe(false);
  });

  it('rejects a whitespace-only body, matching @NotBlank rather than @NotNull', () => {
    const result = ticketSchema.safeParse({ category: 'other', subject: 'a', body: '   ' });
    expect(result.success).toBe(false);
  });

  it('accepts a subject of exactly 200 characters', () => {
    const result = ticketSchema.safeParse({
      category: 'other',
      subject: 'x'.repeat(200),
      body: 'b',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a subject of 201 characters', () => {
    const result = ticketSchema.safeParse({
      category: 'other',
      subject: 'x'.repeat(201),
      body: 'b',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a body of exactly 5000 characters and rejects 5001', () => {
    const base = { category: 'other', subject: 's' };
    expect(ticketSchema.safeParse({ ...base, body: 'y'.repeat(5000) }).success).toBe(true);
    expect(ticketSchema.safeParse({ ...base, body: 'y'.repeat(5001) }).success).toBe(false);
  });
});

describe('publicTicketSchema', () => {
  it('accepts a complete anonymous submission', () => {
    const result = publicTicketSchema.safeParse({
      contactEmail: 'someone@example.invalid',
      category: 'bug_report',
      subject: 'a',
      body: 'b',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an address that is not an email', () => {
    const result = publicTicketSchema.safeParse({
      contactEmail: 'not-an-email',
      category: 'bug_report',
      subject: 'a',
      body: 'b',
    });
    expect(result.success).toBe(false);
  });

  it('does not carry the turnstile token, which is not a validation concern', () => {
    // A failed challenge must read as its own state rather than as a form
    // error, so the token is deliberately outside the schema.
    const result = publicTicketSchema.safeParse({
      contactEmail: 'someone@example.invalid',
      category: 'bug_report',
      subject: 'a',
      body: 'b',
    });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('turnstileToken');
  });
});

describe('appealSchema', () => {
  it('accepts a subject and body', () => {
    expect(appealSchema.safeParse({ subject: 'a', body: 'b' }).success).toBe(true);
  });

  it('carries no category, because the token supplies it server-side', () => {
    // A client-supplied category would let a submitter appeal something the
    // signed link never authorised.
    const result = appealSchema.safeParse({ subject: 'a', body: 'b', category: 'appeal_ban' });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('category');
  });
});

describe('verificationSchema', () => {
  it('accepts a request carrying three pieces of evidence', () => {
    expect(verificationSchema.safeParse(validVerification).success).toBe(true);
  });

  it('rejects a request with two, matching the server floor', () => {
    const result = verificationSchema.safeParse({
      ...validVerification,
      evidenceEmailDomain: '',
    });
    expect(result.success).toBe(false);
  });

  it('does not count a whitespace-only evidence field towards the floor', () => {
    const result = verificationSchema.safeParse({
      ...validVerification,
      evidenceEmailDomain: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('requires the claimed name and the category', () => {
    expect(verificationSchema.safeParse({ ...validVerification, claimedName: '' }).success).toBe(
      false
    );
    expect(verificationSchema.safeParse({ ...validVerification, categoryKey: '' }).success).toBe(
      false
    );
  });

  it('accepts any three of the seven, not three particular ones', () => {
    const lastThree = {
      ...validVerification,
      evidenceWebsite: '',
      evidenceOtherProfile: '',
      evidenceEmailDomain: '',
      evidencePress: 'a press piece',
      evidenceOfficialListing: 'a listing',
      evidenceNote: 'something else',
    };
    expect(verificationSchema.safeParse(lastThree).success).toBe(true);
  });
});

describe('countEvidence', () => {
  it('counts only non-blank fields', () => {
    expect(countEvidence(validVerification)).toBe(3);
    expect(countEvidence({})).toBe(0);
    expect(countEvidence({ evidenceWebsite: '  ' })).toBe(0);
  });

  it('counts every one of the seven declared fields', () => {
    const all = Object.fromEntries(EVIDENCE_FIELDS.map((field) => [field.name, 'x']));
    expect(countEvidence(all)).toBe(EVIDENCE_FIELDS.length);
    expect(EVIDENCE_FIELDS.length).toBeGreaterThanOrEqual(MIN_EVIDENCE_FIELDS);
  });
});
