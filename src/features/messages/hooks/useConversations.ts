import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { STALE_TIME } from '@/config/constants';
import { messageService } from '@/services/message.service';
import { getNextCursor } from '@/utils/helpers';

export const conversationsKey = ['conversations'];
export const unreadCountKey = ['conversations', 'unread-count'];

/**
 * The caller's conversations, most recent activity first.
 *
 * Each row already carries its unread count and newest message, so this is the only request the
 * list screen makes; there is no follow-up per conversation.
 */
export const useConversations = () => {
  const query = useInfiniteQuery({
    queryKey: conversationsKey,
    queryFn: ({ pageParam = null, signal }) =>
      messageService.listConversations({ cursor: pageParam, limit: 20, signal }),
    staleTime: STALE_TIME.SHORT,
    getNextPageParam: getNextCursor,
    initialPageParam: null,
  });

  const conversations = (query.data?.pages || []).flatMap((page) => page?.data?.content || []);
  return { ...query, conversations };
};

/**
 * Total unread messages across every conversation.
 *
 * Named `useUnreadMessageCount`, not `useUnreadCount`: the notifications feature already exports a
 * hook by that name and the shell imports it. Two hooks with one name in the same component is a
 * merge conflict waiting to happen.
 *
 * The count is database-owned, so it is re-read rather than adjusted locally.
 */
export const useUnreadMessageCount = () => {
  const { data } = useQuery({
    queryKey: unreadCountKey,
    queryFn: () => messageService.getUnreadCount(),
    staleTime: STALE_TIME.SHORT,
  });
  return data?.data?.unreadCount ?? 0;
};

/**
 * Marks a conversation read.
 *
 * The list and the badge are re-read from the server afterwards rather than decremented in place,
 * because the unread count belongs to the database.
 */
export const useMarkRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => messageService.markRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationsKey });
      queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
};

/** Marks a conversation unread; same re-read approach as {@link useMarkRead}. */
export const useMarkUnread = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => messageService.markUnread(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationsKey });
      queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
};

/**
 * Deletes a conversation from the caller's own inbox.
 *
 * The row disappears from `conversationsKey` on refetch because the server no longer lists it for
 * this user; nothing here deletes it locally ahead of that, since a failed request must leave the
 * list exactly as it was.
 */
export const useLeaveConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => messageService.leaveConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationsKey });
      queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
};

/** Pins a conversation to the top of the caller's own list; re-reads the list on success. */
export const usePinConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => messageService.pinConversation(conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
  });
};

/** Unpins a conversation for the caller. */
export const useUnpinConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => messageService.unpinConversation(conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
  });
};

/** Mutes a conversation's notifications for the caller. */
export const useMuteConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => messageService.muteConversation(conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
  });
};

/** Unmutes a conversation for the caller. */
export const useUnmuteConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => messageService.unmuteConversation(conversationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
  });
};

/** Sets or clears the caller's private label for the other participant in a conversation. */
export const useSetNickname = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      nickname,
    }: {
      conversationId: string;
      nickname: string | null;
    }) => messageService.setNickname(conversationId, nickname),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationsKey }),
  });
};
