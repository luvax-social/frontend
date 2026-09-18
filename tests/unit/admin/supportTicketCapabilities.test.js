import { describe, expect, it } from 'vitest';

import { ROLES } from '@/config/roles';
import {
  isAppealTicket,
  requiresAdminDecision,
  isTerminalTicket,
  ticketCapabilities,
} from '@/features/admin/lib/supportTicketSchema';

/**
 * The console's role gating mirrors real server rules, so these tests are
 * written as the rules rather than as the rendering. The property that matters
 * is that a control this returns as available is one the server would accept,
 * and every control it withholds is one the server would refuse.
 */

const ME = 'staff-me';
const OTHER = 'staff-other';

const moderator = { id: ME, role: ROLES.MODERATOR };
const administrator = { id: ME, role: ROLES.ADMIN };

const ticket = (overrides = {}) => ({
  id: 't1',
  category: 'BUG_REPORT',
  status: 'OPEN',
  assignedTo: null,
  ...overrides,
});

describe('an unclaimed ticket', () => {
  it('offers only the claim, so no decision form can answer 409', () => {
    const caps = ticketCapabilities(ticket(), moderator);
    expect(caps.canClaim).toBe(true);
    expect(caps.canRespond).toBe(false);
    expect(caps.canEscalate).toBe(false);
    expect(caps.blockedReason).toBe('unclaimed');
  });

  it('offers only the claim to an administrator too', () => {
    // The server's refusal does not depend on role: deciding requires holding
    // the claim, whoever you are.
    const caps = ticketCapabilities(ticket(), administrator);
    expect(caps.canClaim).toBe(true);
    expect(caps.canRespond).toBe(false);
  });
});

describe('a ticket claimed by somebody else', () => {
  it('withholds every action and says who holds it', () => {
    // The defect this replaces tested whether a ticket was claimed rather than
    // who had claimed it, so it enabled a complete decision form for a staff
    // member whose every submission was refused.
    const caps = ticketCapabilities(
      ticket({ assignedTo: OTHER, status: 'IN_PROGRESS' }),
      moderator
    );
    expect(caps.canClaim).toBe(false);
    expect(caps.canRespond).toBe(false);
    expect(caps.canEscalate).toBe(false);
    expect(caps.claimedBySomeoneElse).toBe(true);
    expect(caps.blockedReason).toBe('claimed-by-other');
  });

  it('withholds them from an administrator as well', () => {
    const caps = ticketCapabilities(
      ticket({ assignedTo: OTHER, status: 'IN_PROGRESS' }),
      administrator
    );
    expect(caps.canRespond).toBe(false);
    expect(caps.claimedBySomeoneElse).toBe(true);
  });
});

describe('a ticket claimed by the viewer', () => {
  const mine = ticket({ assignedTo: ME, status: 'IN_PROGRESS' });

  it('lets a moderator answer an ordinary ticket', () => {
    const caps = ticketCapabilities(mine, moderator);
    expect(caps.canRespond).toBe(true);
    expect(caps.canEscalate).toBe(true);
    expect(caps.canNote).toBe(true);
    expect(caps.claimedByMe).toBe(true);
    expect(caps.blockedReason).toBeNull();
  });
});

describe('an appeal', () => {
  // A real appeal carries the audit row it contests. That is what marks it as an
  // appeal; the category is what decides who may answer it.
  const appeal = ticket({
    category: 'APPEAL_BAN',
    adminActionId: '8f14e45f-ceea-467a-9e7c-6f1a2b3c4d5e',
    assignedTo: ME,
    status: 'IN_PROGRESS',
  });

  it('lets a moderator read and escalate but not answer or close', () => {
    // Unban, unsuspend, revoke-warning and revoke-strike are all
    // administrator-only, so a moderator closing an appeal would record a
    // verdict they cannot execute.
    const caps = ticketCapabilities(appeal, moderator);
    expect(caps.isAppeal).toBe(true);
    expect(caps.canRespond).toBe(false);
    expect(caps.canNote).toBe(false);
    expect(caps.canEscalate).toBe(true);
    expect(caps.blockedReason).toBe('appeal-requires-admin');
  });

  it('lets an administrator answer it', () => {
    const caps = ticketCapabilities(appeal, administrator);
    expect(caps.canRespond).toBe(true);
    expect(caps.canEscalate).toBe(true);
    expect(caps.blockedReason).toBeNull();
  });

  // Who may decide is a category question, and mirrors the server: it evaluates
  // `category.isAppeal()` and refuses a moderator with
  // SUPPORT_APPEAL_REQUIRES_ADMIN.
  it('reserves all four appeal categories to an administrator', () => {
    for (const category of [
      'APPEAL_BAN',
      'APPEAL_SUSPENSION',
      'APPEAL_WARNING_STRIKE',
      'APPEAL_CONTENT_REMOVAL',
    ]) {
      expect(requiresAdminDecision({ category })).toBe(true);
    }
    // Verification is deliberately not an appeal: that is what admits a
    // moderator to the verification queue.
    expect(requiresAdminDecision({ category: 'VERIFICATION_REQUEST' })).toBe(false);
  });

  // What a ticket *is* comes from the audit row instead. The authenticated
  // ticket form takes its category from the client, so a category on its own
  // would let anyone label an ordinary request as an appeal.
  it('marks a ticket as an appeal from its audit row rather than its category', () => {
    expect(isAppealTicket(appeal)).toBe(true);
    expect(isAppealTicket({ category: 'APPEAL_BAN', adminActionId: null })).toBe(false);
  });
});

describe('a decided ticket', () => {
  it('offers nothing, whatever the role or the claim', () => {
    for (const status of ['ANSWERED', 'REJECTED']) {
      const caps = ticketCapabilities(ticket({ status, assignedTo: ME }), administrator);
      expect(caps.canRespond).toBe(false);
      expect(caps.canEscalate).toBe(false);
      expect(caps.canClaim).toBe(false);
      expect(caps.blockedReason).toBe('decided');
      expect(isTerminalTicket({ status })).toBe(true);
    }
  });
});

describe('missing inputs', () => {
  it('offers nothing rather than defaulting open', () => {
    expect(ticketCapabilities(null, moderator).canRespond).toBe(false);
    expect(ticketCapabilities(ticket(), null).canClaim).toBe(false);
    expect(ticketCapabilities(ticket(), { id: null, role: ROLES.ADMIN }).canClaim).toBe(false);
  });
});
