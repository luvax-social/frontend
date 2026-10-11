import { getErrorData, getErrorMessage, getErrorResponse, getErrorHeader } from '@/utils/errors';
export interface PanelError {
  kind: 'field' | 'toast' | 'page' | 'silent';
  code: string | null;
  message: string;
  fields: Record<string, string> | null;
  retryAfterSeconds: number | null;
  isConflict: boolean;
}
/**
 * Error handling for the panel.
 *
 * The rule is to branch on the response envelope's `code`, never on `message`.
 * The shared Axios interceptor rewrites `error.message` to a safe string but
 * leaves `error.response.data.code` intact, so the code is read from there.
 *
 * Every error is classified into one of four kinds:
 * - `field`  a validation failure carrying a field-name-to-message map
 * - `toast`  a transient message shown and dismissed
 * - `page`   a full-page state such as not-found or a role refusal
 * - `silent` handled without any user-facing message, such as a stale cursor
 *
 * A separate `isConflict` flag marks the two "another reviewer acted first"
 * codes, which are shown as a calm toast and followed by a refetch rather than
 * an alarming dialogue.
 */

/** Reads the backend error code from the envelope the interceptor preserves. */
export const getErrorCode = (error: unknown) =>
  typeof getErrorData(error)?.code === 'string' ? (getErrorData(error)!.code as string) : null;

/** The field-name-to-message map carried only by VALIDATION_ERROR. */
export const getFieldErrors = (error: unknown) => {
  const data = getErrorData(error)?.data;
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, string>)
    : null;
};

/**
 * Reads `Retry-After` (seconds) from a 429 response. The header is exposed to
 * the browser through the API's CORS configuration, so it is readable here.
 */
export const getRetryAfterSeconds = (error: unknown) => {
  const raw = getErrorHeader(error, 'retry-after');
  const parsed = Number.parseInt(String(raw), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const PAGE_CODES = new Set([
  'FORBIDDEN',
  'USER_NOT_FOUND',
  'REPORT_NOT_FOUND',
  'ADMIN_ACTION_NOT_FOUND',
  'POST_NOT_FOUND',
  'COMMENT_NOT_FOUND',
]);

// "Another reviewer acted first" and "the entity is already in that state".
// Both are shown calmly and followed by a refetch, never a raw error. The
// account lifecycle codes join this set because capabilities normally prevent an
// ineligible control from rendering at all, so when one of these does arrive it
// means the target's state changed under the reviewer (a race) and the honest
// response is to refetch the detail rather than alarm — see
// accounts-contract-verification.md 3.3.
const CONFLICT_CODES = new Set([
  'REPORT_INVALID_TRANSITION',
  'ADMIN_INVALID_TRANSITION',
  'ADMIN_ROLE_TRANSITION_NOT_ALLOWED',
  'ADMIN_SELF_ACTION_NOT_ALLOWED',
  'ADMIN_TARGET_PROTECTED',
]);

/**
 * Classifies an Axios error into a kind the caller can act on.
 *
 * @param {unknown} error an Axios error whose message the interceptor normalised
 * @returns {{kind: 'field'|'toast'|'page'|'silent', code: string|null,
 *   message: string, fields: Object|null, retryAfterSeconds: number|null,
 *   isConflict: boolean}}
 */
export const describeError = (error: unknown): PanelError => {
  const code = getErrorCode(error);
  const message = getErrorMessage(error, 'Something went wrong.');

  if (code === 'VALIDATION_ERROR') {
    return {
      kind: 'field',
      code,
      message,
      fields: getFieldErrors(error) ?? {},
      retryAfterSeconds: null,
      isConflict: false,
    };
  }

  if (code === 'INVALID_CURSOR') {
    return {
      kind: 'silent',
      code,
      message: '',
      fields: null,
      retryAfterSeconds: null,
      isConflict: false,
    };
  }

  if (code === 'TOO_MANY_REQUESTS') {
    return {
      kind: 'toast',
      code,
      message,
      fields: null,
      retryAfterSeconds: getRetryAfterSeconds(error),
      isConflict: false,
    };
  }

  if (PAGE_CODES.has(code ?? '')) {
    return {
      kind: 'page',
      code,
      message,
      fields: null,
      retryAfterSeconds: null,
      isConflict: false,
    };
  }

  if (CONFLICT_CODES.has(code ?? '')) {
    return {
      kind: 'toast',
      code,
      message,
      fields: null,
      retryAfterSeconds: null,
      isConflict: true,
    };
  }

  return { kind: 'toast', code, message, fields: null, retryAfterSeconds: null, isConflict: false };
};

/** True for the codes that mean another reviewer or a double submit won the race. */
export const isConflictError = (error: unknown) => CONFLICT_CODES.has(getErrorCode(error) ?? '');

/** True for a 429, which the caller must never auto-retry. */
export const isRateLimited = (error: unknown) =>
  getErrorCode(error) === 'TOO_MANY_REQUESTS' || getErrorResponse(error)?.status === 429;
