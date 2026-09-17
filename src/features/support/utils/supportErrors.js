/**
 * Support error codes, and the sentences the interface shows for them.
 *
 * The rule the panel already follows applies here: branch on the response
 * envelope's `code`, never on `message`. The Axios interceptor rewrites
 * `error.message` to a safe string but leaves `error.response.data.code`
 * intact.
 *
 * Several of these exist precisely so a refusal can be explained rather than
 * shown as a generic 403, and using the server's own prose would throw that
 * away.
 */
import {
  CAPTCHA_FAILURE_MESSAGE,
  getErrorCode,
  isCaptchaFailure as isSharedCaptchaFailure,
} from '@/utils/captchaErrors';

/** Reads the backend error code from the envelope the interceptor preserves. */
export const getSupportErrorCode = getErrorCode;

const MESSAGES = {
  // The viewer took the decision this ticket is appealing. Distinct from a
  // plain permission refusal, and the reason is the point.
  SUPPORT_CONFLICT_OF_INTEREST:
    'You took the action this ticket is appealing, so you cannot act on it. Hand it to another reviewer.',
  // A moderator on an appeal. They may read it and escalate it, and that is the
  // route the message names rather than leaving them at a dead end.
  SUPPORT_APPEAL_REQUIRES_ADMIN:
    'Only an administrator can answer an appeal. Escalate it and an administrator will pick it up.',
  SUPPORT_TICKET_ALREADY_CLAIMED: 'Another reviewer claimed this first.',
  SUPPORT_TICKET_NOT_CLAIMED: 'Claim this ticket before acting on it.',
  SUPPORT_TICKET_INVALID_TRANSITION: 'This ticket has already been answered.',
  SUPPORT_TICKET_ALREADY_OPEN: 'You already have an open request.',
  // One decision, one appeal, in any status. A rejected appeal is terminal, so
  // this is also what a second attempt after a refusal is told.
  SUPPORT_APPEAL_ALREADY_FILED: 'You have already appealed this decision.',
  // Returned both for an identifier that names nothing and for one belonging to
  // another account. The wording must cover both without hinting that the second
  // case exists, or the endpoint becomes an oracle for whose decision an id is.
  SUPPORT_APPEAL_ACTION_NOT_FOUND: 'We cannot find that decision.',
  SUPPORT_APPEAL_NOT_APPEALABLE: 'This decision cannot be appealed.',
  SUPPORT_TICKET_NOT_FOUND: 'That request no longer exists.',
  SUPPORT_TOKEN_INVALID: 'This link is invalid or has already been used.',
  SUPPORT_CAPTCHA_FAILED: CAPTCHA_FAILURE_MESSAGE,
  SUPPORT_DAILY_LIMIT_REACHED: 'Too many requests from here. Try again later.',
  SUPPORT_CATEGORY_NOT_PUBLIC: 'That category cannot be used on this form.',
  VERIFICATION_INSUFFICIENT_EVIDENCE: 'Fill at least three evidence fields.',
  VERIFICATION_ALREADY_VERIFIED: 'This account already holds a badge.',
  TOO_MANY_REQUESTS: 'Too many requests. Wait a moment and try again.',
};

/**
 * A sentence for a support failure.
 *
 * @param {unknown} error an Axios error
 * @param {string} fallback what to say when the code is not one of ours
 * @returns {string} lowercase, human copy for the interface
 */
export const describeSupportError = (error, fallback = 'That did not work. Try again.') => {
  const code = getSupportErrorCode(error);
  return MESSAGES[code] ?? fallback;
};

/** True when the refusal is the conflict-of-interest rule rather than a role rule. */
export const isConflictOfInterest = (error) =>
  getSupportErrorCode(error) === 'SUPPORT_CONFLICT_OF_INTEREST';

/** True when a moderator was refused an appeal decision and should escalate instead. */
export const isAppealRequiresAdmin = (error) =>
  getSupportErrorCode(error) === 'SUPPORT_APPEAL_REQUIRES_ADMIN';

/** True when another reviewer won the claim race; the caller refetches. */
export const isClaimCollision = (error) =>
  getSupportErrorCode(error) === 'SUPPORT_TICKET_ALREADY_CLAIMED';

/** True when the one-open-ticket rule refused a second request. */
export const isAlreadyOpen = (error) =>
  getSupportErrorCode(error) === 'SUPPORT_TICKET_ALREADY_OPEN';

/** True when this decision has already been appealed once. */
export const isAppealAlreadyFiled = (error) =>
  getSupportErrorCode(error) === 'SUPPORT_APPEAL_ALREADY_FILED';

/** True when the decision behind an appeal entry point is gone or was never the caller's. */
export const isAppealActionNotFound = (error) =>
  getSupportErrorCode(error) === 'SUPPORT_APPEAL_ACTION_NOT_FOUND';

/** True when the decision exists but carries no appeal route. */
export const isAppealNotAppealable = (error) =>
  getSupportErrorCode(error) === 'SUPPORT_APPEAL_NOT_APPEALABLE';

/** True when a single-use link was already redeemed, or never valid. */
export const isTokenInvalid = (error) => getSupportErrorCode(error) === 'SUPPORT_TOKEN_INVALID';

/**
 * True when Turnstile refused. A distinct state from a validation failure.
 *
 * Delegates to the shared classifier so the auth slice can ask the same question
 * without importing this module. This path only ever sees the support code, so
 * what it reports here is unchanged.
 */
export const isCaptchaFailure = isSharedCaptchaFailure;

/** True when the public path's rate limit refused. */
export const isRateLimited = (error) =>
  getSupportErrorCode(error) === 'SUPPORT_DAILY_LIMIT_REACHED' ||
  getSupportErrorCode(error) === 'TOO_MANY_REQUESTS' ||
  error?.response?.status === 429;
