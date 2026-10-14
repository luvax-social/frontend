const MAX_REACTION_LENGTH = 32;
const EMOJI_MARK = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;

const graphemeCount = (value: string) => {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value))
      .length;
  }
  return Array.from(value).length;
};

/**
 * Whether the text is one emoji, which is all a message reaction may be.
 *
 * A convenience check so the any-emoji field can refuse obvious text before a request. The server
 * validates the same rule (one grapheme cluster, at most 32 characters) and stays the authority,
 * answering `MESSAGE_REACTION_INVALID_EMOJI` for anything this lets through.
 */
export const isSingleEmoji = (value: string) =>
  value.length > 0 &&
  value.length <= MAX_REACTION_LENGTH &&
  graphemeCount(value) === 1 &&
  EMOJI_MARK.test(value);
