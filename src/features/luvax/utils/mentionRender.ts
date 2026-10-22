import type { PostMentionResponse } from '@/types/domain';

/**
 * One piece of a caption or comment: plain text, or a mention the server stored.
 *
 * `mention` is set only for a handle the backend resolved to an account, which is the only case a
 * client may link.
 */
export interface MentionSegment {
  text: string;
  mention?: PostMentionResponse;
}

/**
 * The handle grammar of registration: letters, digits, underscore and dot, at most 30 characters,
 * starting at an `@` that does not follow a handle character. Written to follow the backend
 * `MentionParser`, so the email address in "a@b.com" is not read as a mention.
 */
const mentionPattern = () => /(?<![A-Za-z0-9_.@])@([A-Za-z0-9_.]{1,30})/g;

const stripTrailingDots = (handle: string) => handle.replace(/\.+$/, '');

/**
 * Splits text into plain runs and stored mentions.
 *
 * An `@name` becomes a mention only when `mentions` lists it, compared case-insensitively because
 * usernames match that way. Every other `@name` stays plain text, so a renamed or deleted account
 * never points old text at someone else and an unstored name never looks linkable. A sentence that
 * ends in a mention ("thanks @jane.doe.") links `jane.doe` and keeps the final dot as text.
 *
 * @param text the caption or comment; may be null
 * @param mentions the mentions stored with it
 * @returns segments in reading order; their texts concatenate to the input
 */
export function splitMentions(
  text: string | null | undefined,
  mentions: readonly PostMentionResponse[] | null | undefined
): MentionSegment[] {
  if (!text) return [];
  if (!mentions || mentions.length === 0) return [{ text }];

  const byHandle = new Map(mentions.map((mention) => [mention.handle.toLowerCase(), mention]));
  const segments: MentionSegment[] = [];
  const pattern = mentionPattern();
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const handle = stripTrailingDots(match[1]);
    const mention = handle ? byHandle.get(handle.toLowerCase()) : undefined;
    if (!mention) continue;
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index) });
    const typed = `@${handle}`;
    segments.push({ text: typed, mention });
    lastIndex = match.index + typed.length;
  }

  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
  return segments;
}
