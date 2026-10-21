import type { AdminActionResponse, AdminPostRestoreResponse } from '@/types/admin';
/**
 * The one place a removal or restore outcome is worded, so the report detail and
 * the account content screen say the same thing about the same event.
 *
 * Three of the four restorable types answer with something the reviewer cannot
 * see from a bare "restored", and each is worded for what actually happened.
 */

/**
 * Names the banned tags a restored post's caption still carries.
 *
 * The server field is `remainingBannedHashtags`. It was once `droppedHashtags`
 * and it was renamed **because its meaning changed**: it is the post's present
 * state after the restore, not the set this call altered. Restoring the same
 * post twice returns the same names both times
 * (`uptake-contract-verification.md` §3).
 *
 * That is why this reads "still carries" rather than "dropped". A reviewer who
 * restores a post twice sees the same names twice, and the sentence has to make
 * that read as a description of the post rather than as the action repeating or
 * as a bug. "dropped: #x" said twice describes two events that did not happen.
 *
 * When the array is empty the caption carries no banned tag and the plain
 * success stands alone, with no dangling label.
 */
const postRestoreMessage = (data: { remainingBannedHashtags?: string[] } | null | undefined) => {
  const remaining = Array.isArray(data?.remainingBannedHashtags)
    ? data.remainingBannedHashtags
    : [];
  if (remaining.length === 0) {
    return 'post restored';
  }
  const tags = remaining.map((tag) => `#${tag}`).join(', ');
  return `post restored. its caption still carries ${
    remaining.length === 1 ? 'a banned hashtag' : 'banned hashtags'
  }: ${tags}`;
};

/**
 * A story restore lifts the removal and nothing else.
 *
 * Removal writes only the soft-delete marker; expiry keeps deciding visibility
 * independently. A story that expired while it was removed comes back to a live
 * row that no feed shows, and the server reports that with an ordinary success
 * carrying no hint of it.
 *
 * The panel cannot tell the reviewer which of the two happened for this story.
 * The report target payload carries no `expiresAt`, and the lifetime is not
 * derivable: it is set from the server's `story_duration_hours` setting, and in
 * this database three of four stories have an `expires_at` *earlier* than their
 * `created_at`. Computing "expired" from `createdAt` would state the opposite of
 * the truth on three rows out of four.
 *
 * So the message states the mechanism, which is true of every story, instead of
 * a per-story determination the panel would have to invent. It promises nothing
 * a restore cannot deliver.
 */
const storyRestoreMessage = () =>
  'story restored. this lifts the removal only — a story already past its expiry stays out of ' +
  'every feed, and restoring does not extend its lifetime';

/**
 * A message restore lifts moderation's removal only.
 *
 * The sender's own deletion is a separate column and is untouched, so a message
 * the sender had deleted is restored successfully and stays invisible to both
 * participants (`uptake-contract-verification.md` §1.2).
 */
const messageRestoreMessage = () =>
  'message restored. this lifts the removal only — if the sender had also deleted it, it stays ' +
  'hidden for both participants';

/**
 * @param {'post'|'comment'|'story'|'message'} targetType which content was restored
 * @param {Object} data the restore response payload
 * @returns {string} the success message to surface
 */
export const restoreSuccessMessage = (
  targetType: string,
  data: AdminActionResponse | AdminPostRestoreResponse | null | undefined
) => {
  switch (targetType) {
    case 'post':
      return postRestoreMessage(data && 'remainingBannedHashtags' in data ? data : null);
    case 'story':
      return storyRestoreMessage();
    case 'message':
      return messageRestoreMessage();
    case 'message_reaction':
      return 'reaction restored';
    default:
      return `${targetType} restored`;
  }
};

/**
 * What a removal took away, worded per type.
 *
 * A message removal is the one that withholds more than the reviewer might
 * expect — the text, the media, and any shared post or story disappear for both
 * participants, leaving the same placeholder a sender's own deletion leaves.
 */
export const removeSuccessMessage = (targetType: string) => {
  if (targetType === 'message') {
    return 'message removed. its text and any media are withheld from both participants';
  }
  if (targetType === 'message_reaction') {
    return 'reaction removed';
  }
  return `${targetType} removed`;
};

/**
 * What the confirmation says before a removal, per type.
 *
 * A message removal reaches further than the other three — it withholds the
 * text, the media, and any shared post or story from both participants — so the
 * reviewer is told that before confirming rather than after.
 */
export const removeConfirmDescription = (targetType: string) => {
  if (targetType === 'message') {
    return (
      'take down this message. its text, media, and any shared post or story are withheld from ' +
      'both participants, who see the same placeholder a deleted message leaves. the reason is ' +
      'recorded.'
    );
  }
  if (targetType === 'message_reaction') {
    return (
      'take down this reaction. it is hidden from both participants and the person who reacted ' +
      'is told. the reason is recorded.'
    );
  }
  return `take down this ${targetType}. the reason is recorded.`;
};

/**
 * What the confirmation says before a restore, per type.
 *
 * Two of the four cannot promise the content comes back, and the reviewer is
 * told which before confirming, not after — a reviewer who restores a story
 * expecting it to reappear and is only told afterwards has already made the
 * decision on a false premise.
 */
export const restoreConfirmDescription = (targetType: string) => {
  if (targetType === 'story') {
    return (
      'put this story back. this lifts the removal only: if the story has already passed its ' +
      'expiry it stays out of every feed, and restoring does not extend its lifetime. the reason ' +
      'is recorded.'
    );
  }
  if (targetType === 'message') {
    return (
      'put this message back. this lifts the removal only: if the sender also deleted it, it ' +
      'stays hidden for both participants. the reason is recorded.'
    );
  }
  if (targetType === 'message_reaction') {
    return (
      'put this reaction back. it returns to both participants with its original emoji and time. ' +
      'the reason is recorded.'
    );
  }
  return `put this ${targetType} back. the reason is recorded.`;
};
