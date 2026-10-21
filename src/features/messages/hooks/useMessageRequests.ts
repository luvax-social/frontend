import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidateAfterBlock } from '@/features/luvax/hooks/useSocial';
import { messageService } from '@/services/message.service';
import type { ApiResponse, CursorPage } from '@/types/api';

import { conversationFolderKey, unreadCountKey } from './useConversations';

type FolderData = InfiniteData<ApiResponse<CursorPage<{ id: string }>>, string | null>;

const REQUEST_FOLDERS = ['requests', 'hidden_requests'] as const;

const withoutConversation = (old: FolderData | undefined, conversationId: string) => {
  if (!old?.pages?.length) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      data: {
        ...page.data,
        content: (page.data?.content || []).filter(
          (conversation) => conversation.id !== conversationId
        ),
      },
    })),
  };
};

interface RequestSnapshot {
  folder: (typeof REQUEST_FOLDERS)[number];
  data: FolderData | undefined;
}

/**
 * Builds a mutation that removes one incoming request from the requests and hidden requests
 * folders at once and puts the lists back if the server refuses.
 *
 * Cache keys: `['conversations', 'requests']` and `['conversations', 'hidden_requests']`. The
 * recipient's lists are the only ones touched, because the sender's own conversation stays in the
 * primary folder whatever the recipient decides. Rolls back to the snapshots taken in `onMutate`.
 * The folder counts and the unread counter belong to the database, so success re-reads them rather
 * than patching a number. With `optimistic` false the row stays until the server answers and the
 * folders are re-read, which keeps the open request on screen while a decision is in flight.
 */
const useRequestDecision = (
  mutationFn: (conversationId: string) => Promise<unknown>,
  afterSuccess: (queryClient: QueryClient, conversationId: string) => Promise<unknown> | void,
  optimistic = true
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (conversationId: string) => {
      if (!optimistic) return { snapshots: [] };
      await Promise.all(
        REQUEST_FOLDERS.map((folder) =>
          queryClient.cancelQueries({ queryKey: conversationFolderKey(folder) })
        )
      );
      const snapshots: RequestSnapshot[] = REQUEST_FOLDERS.map((folder) => ({
        folder,
        data: queryClient.getQueryData<FolderData>(conversationFolderKey(folder)),
      }));
      REQUEST_FOLDERS.forEach((folder) =>
        queryClient.setQueryData<FolderData>(conversationFolderKey(folder), (old) =>
          withoutConversation(old, conversationId)
        )
      );
      return { snapshots };
    },
    // Rolls back to the folder snapshots taken in onMutate, so a refused decision leaves the
    // request exactly where it was.
    onError: (_error, _conversationId, context) => {
      context?.snapshots.forEach(({ folder, data }) => {
        if (data !== undefined) queryClient.setQueryData(conversationFolderKey(folder), data);
      });
    },
    onSuccess: (_result, conversationId) => afterSuccess(queryClient, conversationId),
    onSettled: () => {
      REQUEST_FOLDERS.forEach((folder) =>
        queryClient.invalidateQueries({ queryKey: conversationFolderKey(folder) })
      );
      queryClient.invalidateQueries({ queryKey: unreadCountKey });
    },
  });
};

/**
 * Accepts an incoming request: `POST /conversations/{id}/accept`.
 *
 * The primary folder is refetched before the mutation settles, including when no screen is
 * observing it, so the caller can switch to it and find the accepted conversation already listed.
 * The row is not removed ahead of the answer: the open request and its decision bar stay on screen
 * while the accept is in flight, and the folders are re-read once it settles.
 */
export const useAcceptRequest = () =>
  useRequestDecision(
    (conversationId) => messageService.acceptRequest(conversationId),
    (queryClient) =>
      queryClient.refetchQueries({ queryKey: conversationFolderKey('primary'), type: 'all' }),
    false
  );

/** Deletes an incoming request: `DELETE /conversations/{id}/request`. The sender is not told. */
export const useDeleteRequest = () =>
  useRequestDecision(
    (conversationId) => messageService.deleteRequest(conversationId),
    () => undefined
  );

/**
 * Declines an incoming request and blocks its sender: `POST /conversations/{id}/block`.
 *
 * The server does both in one transaction, so success invalidates the same social caches as a
 * block from a profile.
 */
export const useBlockRequester = () =>
  useRequestDecision(
    (conversationId) => messageService.blockRequester(conversationId),
    (queryClient) => invalidateAfterBlock(queryClient)
  );
