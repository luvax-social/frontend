import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { MESSAGE_ENDPOINT, subscribeTopic } from '@/services/realtime/stompConnection';

import {
  CONVERSATION_FOLDERS,
  conversationFolderKey,
  isConversationFolder,
  unreadCountKey,
} from './useConversations';

interface InboxFrame {
  eventType?: string;
  conversationId?: string;
  folder?: unknown;
}

/**
 * Keeps the inbox lists and counters fresh from the caller's own `/topic/inbox.{userId}` topic.
 *
 * Mount once per signed-in session. A frame is a prompt to refetch and never carries message
 * content: it names the event, the conversation and, for a new message, the folder it landed in.
 * The folder named in the frame is invalidated together with the unread counts. A frame without a
 * known folder, such as a reaction change, may affect a row in any folder, so all three are
 * invalidated. Delivery is best effort; REST stays authoritative.
 */
export const useInboxLive = (userId: string | null | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return undefined;

    return subscribeTopic<InboxFrame>(
      `/topic/inbox.${userId}`,
      (frame) => {
        const folders = isConversationFolder(frame?.folder) ? [frame.folder] : CONVERSATION_FOLDERS;
        folders.forEach((folder) =>
          queryClient.invalidateQueries({ queryKey: conversationFolderKey(folder) })
        );
        queryClient.invalidateQueries({ queryKey: unreadCountKey });
      },
      // The message flag owns this transport; the inbox topic is registered behind it too.
      { endpoint: MESSAGE_ENDPOINT }
    );
  }, [userId, queryClient]);
};
