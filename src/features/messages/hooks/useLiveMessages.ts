import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { MESSAGE_ENDPOINT, subscribeTopic } from '@/services/realtime/stompConnection';

import { conversationsKey, unreadCountKey } from './useConversations';
import { messagesKey } from './useMessages';

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
 */
export const useLiveMessages = (conversationId: string | null | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return undefined;

    return subscribeTopic(
      `/topic/conversations.${conversationId}.messages`,
      () => {
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
