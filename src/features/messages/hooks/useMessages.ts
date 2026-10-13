import type { Message, MessageData } from '../types';
import type { SendMessageRequest } from '@/types/domain';
interface SendMessageVariables {
  conversationId: string;
  body: SendMessageRequest;
  idempotencyKey?: string;
  optimisticMessage: Message;
}
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { messageService } from '@/services/message.service';
import { getNextCursor } from '@/utils/helpers';

import { conversationsKey, unreadCountKey } from './useConversations';

export const messagesKey = (conversationId: string | null | undefined) => [
  'conversations',
  conversationId,
  'messages',
];

const messageTime = (message: Message) => {
  const value = message?.createdAt ? new Date(message.createdAt).getTime() : 0;
  return Number.isNaN(value) ? 0 : value;
};

const isPendingMessage = (message: Message) =>
  typeof message?.id === 'string' && message.id.startsWith('pending-');

/**
 * Keeps already-loaded history visible when the newest page is re-read.
 *
 * A busy conversation can push a visible "marker" message out of the first page between live
 * refreshes. The server is still correct, but replacing the cache with only the newest page makes
 * that loaded message disappear from the open thread. New rows win by id so edits/deletes reflected
 * by the fresh response still update, while older rows that were already in the cache remain
 * visible until the user closes or reloads the conversation.
 */
export const mergeMessagePages = (
  oldData: MessageData | undefined,
  newData: MessageData
): MessageData => {
  if (!oldData?.pages?.length || !newData?.pages?.length) return newData;

  const byId = new Map<string, Message>();
  newData.pages.forEach((page) => {
    (page?.data?.content || []).forEach((message) => byId.set(message.id, message));
  });
  oldData.pages.forEach((page) => {
    (page?.data?.content || []).forEach((message) => {
      if (isPendingMessage(message)) return;
      if (!byId.has(message.id)) byId.set(message.id, message);
    });
  });

  const merged = Array.from(byId.values()).sort((a, b) => messageTime(b) - messageTime(a));
  const firstPage = newData.pages[0];
  return {
    ...newData,
    pages: [
      {
        ...firstPage,
        data: {
          ...firstPage.data,
          content: merged,
        },
      },
    ],
    pageParams: [newData.pageParams?.[0] ?? null],
  };
};

/**
 * Cursor-paginated history for one conversation.
 *
 * Disabled until a conversation is selected, so the screen does not fire a request for a null id on
 * first render.
 */
export const useMessages = (conversationId: string | null | undefined) => {
  const query = useInfiniteQuery({
    queryKey: messagesKey(conversationId),
    queryFn: ({ pageParam = null, signal }) =>
      messageService.listMessages(conversationId!, { cursor: pageParam, limit: 30, signal }),
    enabled: Boolean(conversationId),
    staleTime: 0,
    getNextPageParam: getNextCursor,
    initialPageParam: null,
    structuralSharing: (oldData, newData) =>
      mergeMessagePages(oldData as MessageData | undefined, newData as MessageData),
  });

  const messages = (query.data?.pages || []).flatMap((page) => page?.data?.content || []);
  return { ...query, messages };
};

/** Replaces the first page's content, leaving the rest of the pagination intact. */
const withFirstPageContent = (
  old: MessageData | undefined,
  updater: (content: Message[]) => Message[]
) => {
  if (!old?.pages?.length) return old;
  const pages = [...old.pages];
  const first = pages[0];
  pages[0] = {
    ...first,
    data: { ...first.data, content: updater(first.data?.content || []) },
  };
  return { ...old, pages };
};

/**
 * Sends a message, showing it immediately and restoring the previous history if the request fails.
 *
 * Rollback is not optional: leaving an unsent message on screen tells the reader something happened
 * that did not.
 *
 * `conversationId` travels with each call's variables rather than being fixed when the hook is
 * created: a conversation that does not exist yet (a profile's "message" button, before either
 * side has sent anything) has no id to bind at that point, only once the first send resolves one.
 */
export const useSendMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, body, idempotencyKey }: SendMessageVariables) =>
      messageService.sendMessage(conversationId, body, idempotencyKey),
    onMutate: async ({ conversationId, optimisticMessage }) => {
      const key = messagesKey(conversationId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MessageData>(key);
      // History is newest first, so a new message belongs at the front.
      queryClient.setQueryData<MessageData>(key, (old) =>
        withFirstPageContent(old, (content) => [optimisticMessage, ...content])
      );
      return { previous, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSuccess: (response, variables, context) => {
      const createdMessage = response?.data;
      const optimisticId = variables.optimisticMessage?.id;
      if (!createdMessage?.id || !optimisticId || !context?.key) return;

      queryClient.setQueryData<MessageData>(context.key, (old) =>
        withFirstPageContent(old, (content) =>
          content.map((message) => (message.id === optimisticId ? createdMessage : message))
        )
      );
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: messagesKey(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: conversationsKey });
    },
  });
};

/**
 * Sender-only soft delete. The message stays in history as a placeholder rather than vanishing.
 */
export const useDeleteMessage = (conversationId: string | null | undefined) => {
  const queryClient = useQueryClient();
  const key = messagesKey(conversationId);

  return useMutation({
    mutationFn: (messageId: string) => messageService.deleteMessage(conversationId!, messageId),
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MessageData>(key);
      queryClient.setQueryData<MessageData>(key, (old) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: {
              ...page.data,
              content: (page.data?.content || []).map((message) =>
                message.id === messageId ? { ...message, isDeleted: true, content: null } : message
              ),
            },
          })),
        };
      });
      return { previous };
    },
    onError: (_error, _messageId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: conversationsKey });
      queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
};
