import type { MessageReactionResponse } from '@/types/domain';

import type { Message, MessageData } from '../types';

interface ReactionChangeBase {
  messageId: string;
  userId: string;
  reactedAt: string;
}

/** A set reaction names its own id; a removal needs none, because it matches on the user. */
export type ReactionChange =
  | (ReactionChangeBase & { emoji: string; reactionId: string })
  | (ReactionChangeBase & { emoji: null });

const withReaction = (reactions: MessageReactionResponse[], change: ReactionChange) => {
  const others = reactions.filter((reaction) => reaction.userId !== change.userId);
  if (change.emoji === null) return others;
  // Oldest first, matching the server: a changed reaction is newer than the one it replaces.
  return [
    ...others,
    {
      id: change.reactionId,
      userId: change.userId,
      emoji: change.emoji,
      reactedAt: change.reactedAt,
    },
  ];
};

/**
 * Applies one reaction change to the cached history of a conversation.
 *
 * Shared by the optimistic patch and the live frame handler, so the two cannot disagree: applying
 * the same change twice leaves the same reactions. A message that is not loaded is left alone and
 * picks its reactions up when it is fetched; a tombstoned message never shows reactions.
 */
export const applyReactionChange = (
  data: MessageData | undefined,
  change: ReactionChange
): MessageData | undefined => {
  if (!data?.pages?.length) return data;
  const patch = (message: Message): Message =>
    message.id === change.messageId && !message.isDeleted
      ? { ...message, reactions: withReaction(message.reactions || [], change) }
      : message;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: { ...page.data, content: (page.data?.content || []).map(patch) },
    })),
  };
};
