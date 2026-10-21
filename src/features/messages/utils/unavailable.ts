import { getErrorData, getErrorResponse } from '@/utils/errors';

/**
 * The only wording shown when a request or reaction action finds nothing.
 *
 * The server answers a missing conversation, a missing message and a blocked pair with the same
 * not-found, so the client must not add a reason of its own: any extra detail would reveal which
 * of them it was.
 */
export const UNAVAILABLE_NOTICE = 'This conversation is unavailable.';

const NOT_FOUND_CODES = new Set(['CONVERSATION_NOT_FOUND', 'MESSAGE_NOT_FOUND', 'NOT_FOUND']);

/** Whether a failed call was answered with the server's stealth not-found. */
export const isNotFoundError = (error: unknown) => {
  const code = getErrorData(error)?.code;
  if (typeof code === 'string' && NOT_FOUND_CODES.has(code)) return true;
  return getErrorResponse(error)?.status === 404;
};
