/**
 * The ticket lifecycle, mirrored from `support/DATA_RULES.md` section 2.
 *
 * The transition map itself is enforced server-side; what the client needs from
 * it is which statuses are still live, because that decides whether the help
 * centre shows a form or the request the account already holds.
 */

/** Statuses a ticket can still move out of. */
export const ACTIVE_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'ESCALATED']);

/** Statuses a ticket can never leave. */
export const TERMINAL_STATUSES = new Set(['ANSWERED', 'REJECTED']);

/**
 * Written but not yet confirmed, so invisible to staff.
 *
 * Deliberately neither active nor terminal: an unconfirmed public submission is
 * not yet a real ticket and must not block the account's genuine one.
 */
export const PENDING_CONFIRMATION = 'PENDING_CONFIRMATION';

/** The category that is exempt from the one-open-ticket rule. */
export const VERIFICATION_CATEGORY = 'VERIFICATION_REQUEST';

/** Whether a ticket is still being worked. */
export const isActive = (ticket) => ACTIVE_STATUSES.has(ticket?.status);

/** Whether a ticket has been decided. */
export const isTerminal = (ticket) => TERMINAL_STATUSES.has(ticket?.status);

/**
 * The open ticket that blocks a new request, if the account holds one.
 *
 * A pending verification request is deliberately not one. The backend excludes
 * `verification_request` from the one-open-ticket index for exactly this reason
 * - so a badge request sitting in the queue cannot stop the same account
 * opening a ban appeal - and the interface has to model that or it would refuse
 * a request the server would have accepted.
 *
 * @param {Array} tickets the caller's own tickets
 * @returns {Object|null} the blocking ticket, or null when none blocks
 */
export const findBlockingTicket = (tickets = []) =>
  tickets.find((ticket) => isActive(ticket) && ticket.category !== VERIFICATION_CATEGORY) ?? null;

/**
 * The account's outstanding verification request, if any.
 *
 * Read separately from the blocking ticket because it occupies its own slot: an
 * account may hold one of each at once.
 *
 * @param {Array} tickets the caller's own tickets
 * @returns {Object|null} the pending verification ticket, or null
 */
export const findPendingVerification = (tickets = []) =>
  tickets.find((ticket) => isActive(ticket) && ticket.category === VERIFICATION_CATEGORY) ?? null;

/**
 * Lowercase, human wording for a status.
 *
 * REJECTED is named as a refusal rather than as "closed". Both terminal states
 * previously read as an ending without saying which one: a rejected ticket
 * showed "closed" above a block headed the same way an answered one is, so the
 * only thing distinguishing a grant from a refusal anywhere in the owner-facing
 * interface was whatever prose a moderator happened to type. The staff console
 * was never affected, because it renders the raw status - so a moderator saw
 * REJECTED correctly while the person it was about did not.
 */
export const statusLabel = (status) =>
  ({
    PENDING_CONFIRMATION: 'Waiting for you to confirm your email',
    OPEN: 'Waiting for a reviewer',
    IN_PROGRESS: 'With a reviewer',
    ESCALATED: 'With an administrator',
    ANSWERED: 'answered',
    REJECTED: 'declined',
  })[status] ??
  String(status ?? '')
    .toLowerCase()
    .replace(/_/g, ' ');

/**
 * The heading the staff text sits under, which differs by outcome.
 *
 * Changed together with the status word above, deliberately. Either alone still
 * leaves a grant and a refusal introduced by the same label, which is the whole
 * defect: a reader skimming sees the heading before the prose.
 *
 * @param {string} status the ticket's status
 * @returns {string} the heading for the staff response block
 */
export const staffResponseHeading = (status) =>
  status === 'REJECTED' ? 'Why this was declined' : 'Our reply';
