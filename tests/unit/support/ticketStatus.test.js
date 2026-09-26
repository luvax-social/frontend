import { describe, expect, it } from 'vitest';

import {
  findBlockingTicket,
  findPendingVerification,
  isActive,
  isTerminal,
  staffResponseHeading,
  statusLabel,
} from '@/features/support/utils/ticketStatus';

const ticket = (status, category = 'BUG_REPORT', id = status) => ({ id, status, category });

describe('findBlockingTicket', () => {
  it('finds an open request', () => {
    expect(findBlockingTicket([ticket('OPEN')])?.status).toBe('OPEN');
  });

  it('treats in_progress and escalated as blocking too', () => {
    expect(findBlockingTicket([ticket('IN_PROGRESS')])).not.toBeNull();
    expect(findBlockingTicket([ticket('ESCALATED')])).not.toBeNull();
  });

  it('does not treat a decided request as blocking', () => {
    expect(findBlockingTicket([ticket('ANSWERED'), ticket('REJECTED')])).toBeNull();
  });

  it('does not treat an unconfirmed public submission as blocking', () => {
    // pending_confirmation sits outside the guard at both ends: it is not yet a
    // real ticket and must not block the account's genuine one.
    expect(findBlockingTicket([ticket('PENDING_CONFIRMATION')])).toBeNull();
  });

  // The rule this whole helper exists for. The backend excludes
  // verification_request from the one-open-ticket index so a pending badge
  // request cannot stop the same account opening a ban appeal.
  it('does not treat a pending verification request as blocking', () => {
    expect(findBlockingTicket([ticket('OPEN', 'VERIFICATION_REQUEST')])).toBeNull();
  });

  it('finds the appeal when a verification request is also open', () => {
    const tickets = [
      ticket('OPEN', 'VERIFICATION_REQUEST', 'verification'),
      ticket('OPEN', 'APPEAL_BAN', 'appeal'),
    ];
    expect(findBlockingTicket(tickets)?.id).toBe('appeal');
  });

  it('returns null for an empty list', () => {
    expect(findBlockingTicket([])).toBeNull();
    expect(findBlockingTicket()).toBeNull();
  });
});

describe('findPendingVerification', () => {
  it('finds an outstanding verification request', () => {
    expect(findPendingVerification([ticket('IN_PROGRESS', 'VERIFICATION_REQUEST')])).not.toBeNull();
  });

  it('ignores a decided one', () => {
    expect(findPendingVerification([ticket('ANSWERED', 'VERIFICATION_REQUEST')])).toBeNull();
  });

  it('ignores an ordinary ticket', () => {
    expect(findPendingVerification([ticket('OPEN', 'BUG_REPORT')])).toBeNull();
  });

  it('is independent of the blocking ticket, so an account can hold one of each', () => {
    const tickets = [
      ticket('OPEN', 'VERIFICATION_REQUEST', 'verification'),
      ticket('OPEN', 'APPEAL_BAN', 'appeal'),
    ];
    expect(findPendingVerification(tickets)?.id).toBe('verification');
    expect(findBlockingTicket(tickets)?.id).toBe('appeal');
  });
});

describe('isActive and isTerminal', () => {
  it('classifies every status the lifecycle declares', () => {
    expect(isActive(ticket('OPEN'))).toBe(true);
    expect(isActive(ticket('IN_PROGRESS'))).toBe(true);
    expect(isActive(ticket('ESCALATED'))).toBe(true);
    expect(isActive(ticket('ANSWERED'))).toBe(false);
    expect(isTerminal(ticket('ANSWERED'))).toBe(true);
    expect(isTerminal(ticket('REJECTED'))).toBe(true);
    // Neither, deliberately.
    expect(isActive(ticket('PENDING_CONFIRMATION'))).toBe(false);
    expect(isTerminal(ticket('PENDING_CONFIRMATION'))).toBe(false);
  });
});

describe('statusLabel', () => {
  it('gives human wording rather than the raw enum', () => {
    expect(statusLabel('IN_PROGRESS')).toBe('With a reviewer');
    expect(statusLabel('ESCALATED')).toBe('With an administrator');
  });

  it('falls back to a readable form for an unknown status', () => {
    expect(statusLabel('SOMETHING_NEW')).toBe('something new');
  });
});

describe('a refusal is named as one', () => {
  // P7-FE-001. Both terminal states used to read as an ending without saying which: REJECTED was
  // labelled "closed" and its staff text sat under the same heading an answered ticket uses, so
  // the only thing telling a grant from a refusal was whatever prose a moderator typed. These two
  // assertions are the rule - the two states must not present alike - not the specific wording.
  it('gives REJECTED its own word, distinct from ANSWERED', () => {
    expect(statusLabel('REJECTED')).toBe('declined');
    expect(statusLabel('REJECTED')).not.toBe(statusLabel('ANSWERED'));
    // And not the word that reads as a neutral ending.
    expect(statusLabel('REJECTED')).not.toBe('closed');
  });

  it('gives REJECTED its own staff-text heading, distinct from ANSWERED', () => {
    expect(staffResponseHeading('REJECTED')).toBe('Why this was declined');
    expect(staffResponseHeading('REJECTED')).not.toBe(staffResponseHeading('ANSWERED'));
  });

  it('leaves every other status under the ordinary heading', () => {
    expect(staffResponseHeading('ANSWERED')).toBe('Our reply');
    expect(staffResponseHeading('OPEN')).toBe('Our reply');
  });
});
