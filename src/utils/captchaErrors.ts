/**
 * Classifies a refused Turnstile challenge, wherever it was refused.
 *
 * Lives here rather than in a feature slice because three of them need it now:
 * the support form, the authentication forms and the report dialog. A feature
 * must not import another feature's internals, so the shared part moved out
 * before the second consumer existed.
 *
 * Branches on the response envelope's `code`, never on `message`. The Axios
 * interceptor rewrites `error.message` to a safe string but leaves
 * `error.response.data.code` intact.
 */

/** The public support form's refusal. Fails closed on the server. */
export const SUPPORT_CAPTCHA_FAILED = 'SUPPORT_CAPTCHA_FAILED';

/**
 * The refusal raised by every fail-open surface: the five authentication forms
 * and report submission. One code for the whole group, and deliberately silent
 * about whether the token was wrong, expired or already spent.
 */
export const AUTH_CAPTCHA_FAILED = 'AUTH_CAPTCHA_FAILED';

/** Reads the backend error code from the envelope the interceptor preserves. */
export const getErrorCode = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('response' in error)) return null;
  const response = error.response;
  if (!response || typeof response !== 'object' || !('data' in response)) return null;
  const data = response.data;
  return data && typeof data === 'object' && 'code' in data ? data.code : null;
};

/**
 * True when the server refused the challenge rather than the form's contents.
 *
 * A distinct state from a validation failure: the form is filled in correctly
 * and the thing that refused is the bot control, so telling the reader to check
 * their answers would send them hunting for a mistake that is not there.
 *
 * @param {unknown} error an Axios error
 * @returns {boolean} whether this failure was the challenge
 */
export const isCaptchaFailure = (error: unknown) => {
  const code = getErrorCode(error);
  return code === SUPPORT_CAPTCHA_FAILED || code === AUTH_CAPTCHA_FAILED;
};

/** The one sentence every surface shows for a refused challenge. */
export const CAPTCHA_FAILURE_MESSAGE = 'The challenge was not accepted. Try it again.';
