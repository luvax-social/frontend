import type { MessageReactionResponse } from '@/types/domain';

import type { Message, MessageData } from '../types';

export interface ReactionChange {
  messageId: string;
  userId: string;
  /** Null removes the user's reaction. */
  emoji: string | null;
  reactedAt: string;
}

const withReaction = (
  reactions: MessageReactionResponse[],
  { userId, emoji, reactedAt }: ReactionChange
) => {
  const others = reactions.filter((reaction) => reaction.userId !== userId);
  // Oldest first, matching the server: a changed reaction is newer than the one it replaces.
  return emoji === null ? others : [...others, { userId, emoji, reactedAt }];
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
