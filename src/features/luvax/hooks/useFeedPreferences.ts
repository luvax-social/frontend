import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as feedbackService from '@/services/postFeedback.service';
import * as safetyService from '@/services/safety.service';

import { currentUserId } from '../store/resetOnUserChange';
import { useDismissedPostsStore, type PostDismissal } from '../store/useDismissedPostsStore';
import { RECOMMENDED_FEED_KEYS } from '../utils/feedCacheKeys';

interface DismissVariables {
  postId: string;
  authorId: string;
  authorHandle: string;
  /** The viewer used the card's own menu, so the undo row that replaces it takes focus. */
  focusUndo?: boolean;
}

interface Options {
  onError?: (error: unknown) => void;
}

// Marked stale rather than refetched. The viewer is still looking at the undo row, and a refetch
// would drop the post, and the row with it, before the undo could be used. The next mount, focus
// or poll fetches the lists, and the server leaves the post out.
const markStale = (queryClient: QueryClient, keys: unknown[][]) => {
  keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: 'none' }));
};

// One scope for every feedback change, so an undo tapped while its signal is still in flight is
// sent after it and the server ends in the state the viewer last chose.
const FEEDBACK_SCOPE = { id: 'feed-preferences' };

const dismissed = (postId: string) => useDismissedPostsStore.getState().byPostId[postId];

interface RollbackContext {
  previous: PostDismissal | undefined;
  userId: string | null;
}

const snapshot = (postId: string): RollbackContext => ({
  previous: dismissed(postId),
  userId: currentUserId(),
});

// A failure can land after another account signed in. The store was emptied then, so putting the
// earlier snapshot back would show the previous account's row to the new one; the failure is
// that account's alone and is dropped.
const rollBack = (
  postId: string,
  context: RollbackContext | undefined,
  options: Options,
  error: unknown
) => {
  if (context && context.userId !== currentUserId()) return;
  useDismissedPostsStore.getState().restore(postId, context?.previous);
  options.onError?.(error);
};

/**
 * Not interested: hides one post from the feed and tells the recommender.
 *
 * Returns `apply` (`POST /posts/{postId}/not-interested`) and `undo` (`DELETE`). Both are
 * optimistic through the dismissed-posts store, which the feed reads to swap the card for its
 * undo row. On failure the store is restored to the snapshot taken in `onMutate`, so a refused
 * request puts the card back, and `options.onError` runs for every failure. On success `['feed']`
 * and both `['recommendedFeed', excludeFollowed]` lists are marked stale without refetching.
 */
export const useNotInterested = (options: Options = {}) => {
  const queryClient = useQueryClient();
  const apply = useMutation({
    scope: FEEDBACK_SCOPE,
    mutationFn: ({ postId }: DismissVariables) => feedbackService.markNotInterested(postId),
    onMutate: ({ postId, authorId, authorHandle, focusUndo }) => {
      const context = snapshot(postId);
      useDismissedPostsStore
        .getState()
        .set(postId, { kind: 'not-interested', authorId, authorHandle, focusUndo });
      return context;
    },
    // Rolls back to the dismissal the post had before this change, which is none for a new one.
    onError: (error, { postId }, context) => rollBack(postId, context, options, error),
    onSuccess: () => markStale(queryClient, [['feed'], ...RECOMMENDED_FEED_KEYS]),
  });
  const undo = useMutation({
    scope: FEEDBACK_SCOPE,
    mutationFn: ({ postId }: { postId: string }) => feedbackService.undoNotInterested(postId),
    onMutate: ({ postId }) => {
      const context = snapshot(postId);
      useDismissedPostsStore.getState().clear(postId);
      return context;
    },
    // Rolls back to the row the viewer was looking at, so a refused undo leaves it in place.
    onError: (error, { postId }, context) => rollBack(postId, context, options, error),
    onSuccess: () => markStale(queryClient, [['feed'], ...RECOMMENDED_FEED_KEYS]),
  });
  return { apply, undo };
};

/**
 * Show fewer: asks the recommender for less from one author.
 *
 * Returns `apply` (`POST /social/show-fewer/{authorId}`) and `undo` (`DELETE`). Optimistic and
 * rolled back the same way as `useNotInterested`. It changes For You and Explore only, so only
 * both `['recommendedFeed', excludeFollowed]` lists are marked stale, never `['feed']`.
 */
export const useShowFewer = (options: Options = {}) => {
  const queryClient = useQueryClient();
  const apply = useMutation({
    scope: FEEDBACK_SCOPE,
    mutationFn: ({ authorId }: DismissVariables) => safetyService.showFewer(authorId),
    onMutate: ({ postId, authorId, authorHandle, focusUndo }) => {
      const context = snapshot(postId);
      useDismissedPostsStore
        .getState()
        .set(postId, { kind: 'show-fewer', authorId, authorHandle, focusUndo });
      return context;
    },
    // Rolls back to the dismissal the post had before this change, which is none for a new one.
    onError: (error, { postId }, context) => rollBack(postId, context, options, error),
    onSuccess: () => markStale(queryClient, RECOMMENDED_FEED_KEYS),
  });
  const undo = useMutation({
    scope: FEEDBACK_SCOPE,
    mutationFn: ({ authorId }: { postId: string; authorId: string }) =>
      safetyService.undoShowFewer(authorId),
    onMutate: ({ postId }) => {
      const context = snapshot(postId);
      useDismissedPostsStore.getState().clear(postId);
      return context;
    },
    // Rolls back to the row the viewer was looking at, so a refused undo leaves it in place.
    onError: (error, { postId }, context) => rollBack(postId, context, options, error),
    onSuccess: () => markStale(queryClient, RECOMMENDED_FEED_KEYS),
  });
  return { apply, undo };
};
