import { tokens } from '@/utils/textMatch';

export const HIDDEN_WORD_INVALID_MESSAGE =
  'A hidden word must be 1 to 64 characters and contain 1 to 6 words.';

const PHRASE_MAX_CHARS = 64;
const PHRASE_MAX_WORDS = 6;

/**
 * Checks a phrase against the backend's rule (1 to 64 characters, 1 to 6 normalised words) so a
 * refusal needs no request. Returns the message to show, or null when the phrase is acceptable.
 */
export function validatePhrase(raw: string): string | null {
  const stripped = raw.trim();
  const wordCount = tokens(stripped).length;
  if (wordCount === 0) {
    return 'Enter a word or phrase.';
  }
  if (stripped.length > PHRASE_MAX_CHARS || wordCount > PHRASE_MAX_WORDS) {
    return HIDDEN_WORD_INVALID_MESSAGE;
  }
  return null;
}
