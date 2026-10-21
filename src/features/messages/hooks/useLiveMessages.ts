import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { MESSAGE_ENDPOINT, subscribeTopic } from '@/services/realtime/stompConnection';

import type { MessageData } from '../types';
import { applyReactionChange } from '../utils/reactionCache';
import { conversationsKey, unreadCountKey } from './useConversations';
import { messagesKey } from './useMessages';

const REACTION_CHANGED = 'message.reaction.changed.v1';

interface ThreadFrame {
  eventType?: string;
  data?: {
    messageId?: string;
    reactionId?: string;
    userId?: string;
    emoji?: string | null;
    reactedAt?: string;
  };
}

/**
 * Applies live message frames for the open conversation.
 *
 * Additive by design: if the socket never connects, the screen behaves exactly as it did before and
 * the REST responses remain authoritative. A dropped frame costs freshness until the next refetch,
 * never correctness.
 *
 * The frame is used as a signal rather than as data. Its payload differs per event type, so
 * invalidating and re-reading keeps this hook independent of that shape, at the cost of one request
 * per event. Conversations arrive one message at a time, so that cost is bounded by how fast a
 * person types.
 *
 * A reaction frame is the exception: it names the message, the reactor, the reaction's id and the
 * emoji (absent for a removal), so it is patched into the cached history instead of refetching it.
 * A set frame without a reaction id cannot be patched into a reportable reaction, so it falls
 * through to the refetch. The patch is the same one the optimistic update applies, so a frame that
 * echoes the caller's own change is a no-op.
 */
export const useLiveMessages = (conversationId: string | null | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return undefined;

    return subscribeTopic<ThreadFrame>(
      `/topic/conversations.${conversationId}.messages`,
      (frame) => {
        const change = frame?.data;
        if (
          frame?.eventType === REACTION_CHANGED &&
          change?.messageId &&
          change.userId &&
          change.reactedAt &&
          (!change.emoji || change.reactionId)
        ) {
          const { messageId, userId, reactedAt, reactionId, emoji } = change;
          queryClient.setQueryData<MessageData>(messagesKey(conversationId), (old) =>
            applyReactionChange(
              old,
              emoji && reactionId
                ? { messageId, userId, reactedAt, emoji, reactionId }
                : { messageId, userId, reactedAt, emoji: null }
            )
          );
          return;
        }
        queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
        queryClient.invalidateQueries({ queryKey: conversationsKey });
        queryClient.invalidateQueries({ queryKey: unreadCountKey });
      },
      // Its own transport: /ws/messages is registered behind app.message.live.enabled, so
      // borrowing the comment endpoint would tie delivery to an unrelated flag.
      { endpoint: MESSAGE_ENDPOINT }
    );
  }, [conversationId, queryClient]);
};
