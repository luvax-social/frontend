import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/features/luvax/components/Toast';
import { messageService } from '@/services/message.service';

import type { MessageData } from '../types';
import { applyReactionChange } from '../utils/reactionCache';
import { UNAVAILABLE_NOTICE, isNotFoundError } from '../utils/unavailable';
import { CONVERSATION_FOLDERS, conversationFolderKey } from './useConversations';
import { messagesKey } from './useMessages';

interface ReactionVariables {
  messageId: string;
  /** Null removes the caller's reaction. */
  emoji: string | null;
}

/**
 * Sets, changes or removes the caller's reaction on a message of one conversation.
 *
 * Cache key: `messagesKey(conversationId)`. The reaction is patched into the cached message at
 * once, and `onError` rolls the history back to the snapshot taken in `onMutate` and re-reads the
 * thread, so a refused reaction never stays on screen. Writes to one conversation share a mutation
 * scope and run one at a time. The server's live frame applies the same change through
 * `applyReactionChange`, so it agrees with this patch instead of refetching the thread. The
 * conversation lists are re-read afterwards because their rows carry the newest reaction.
 *
 * A not-found answer covers a missing message, a removed message and a blocked pair alike, so it
 * is reported with the generic unavailable notice and never with a reason.
 *
 * @returns `react(messageId, emoji)`, which resolves when the request settles and never rejects:
 * the failure notice is shown here.
 */
export const useReactions = (
  conversationId: string | null | undefined,
  currentUserId: string | undefined
) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    // One scope per conversation, so quick reactions are sent in the order they were made and a
    // late rollback cannot overwrite a newer change.
    scope: { id: `message-reactions:${conversationId}` },
    mutationFn: async ({ messageId, emoji }: ReactionVariables) => {
      if (emoji === null) {
        await messageService.removeMessageReaction(conversationId!, messageId);
        return null;
      }
      const response = await messageService.reactToMessage(conversationId!, messageId, emoji);
      return response.data;
    },
    onMutate: async ({ messageId, emoji }) => {
      const key = messagesKey(conversationId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MessageData>(key);
      if (currentUserId) {
        queryClient.setQueryData<MessageData>(key, (old) =>
          applyReactionChange(
            old,
            emoji === null
              ? { messageId, userId: currentUserId, emoji, reactedAt: new Date().toISOString() }
              : {
                  messageId,
                  userId: currentUserId,
                  emoji,
                  // The caller's own reaction is never reportable, so the placeholder is never
                  // sent anywhere; onSuccess replaces it with the stored id.
                  reactionId: `pending:${messageId}`,
                  reactedAt: new Date().toISOString(),
                }
          )
        );
      }
      return { previous, key };
    },
    // Rolls back to the history snapshot taken in onMutate.
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(context.key, context.previous);
      // The thread is re-read after every failure, so whatever the server holds replaces the
      // snapshot, which may predate a newer reaction or a live frame.
      queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
      if (isNotFoundError(error)) {
        toast(UNAVAILABLE_NOTICE);
        return;
      }
      toast("Couldn't update that reaction. Try again.");
    },
    onSuccess: (stored, { messageId }) => {
      if (!stored || !currentUserId) return;
      queryClient.setQueryData<MessageData>(messagesKey(conversationId), (old) =>
        applyReactionChange(old, {
          messageId,
          userId: currentUserId,
          reactionId: stored.id,
          emoji: stored.emoji,
          reactedAt: stored.reactedAt,
        })
      );
    },
    onSettled: () => {
      CONVERSATION_FOLDERS.forEach((folder) =>
        queryClient.invalidateQueries({ queryKey: conversationFolderKey(folder) })
      );
    },
  });

  const { mutateAsync } = mutation;
  const react = useCallback(
    (messageId: string, emoji: string | null) =>
      mutateAsync({ messageId, emoji }).then(
        () => undefined,
        () => undefined
      ),
    [mutateAsync]
  );

  return { react, isPending: mutation.isPending };
};
