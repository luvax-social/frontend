import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as feedbackService from '@/services/postFeedback.service';
import * as safetyService from '@/services/safety.service';

import { useDismissedPostsStore } from '../store/useDismissedPostsStore';

interface DismissVariables {
  postId: string;
  authorId: string;
  authorHandle: string;
}

interface Options {
  onError?: (error: unknown) => void;
}

const RECOMMENDED_KEYS = [
  ['recommendedFeed', false],
  ['recommendedFeed', true],
];

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
    onMutate: ({ postId, authorId, authorHandle }) => {
      const previous = dismissed(postId);
      useDismissedPostsStore
        .getState()
        .set(postId, { kind: 'not-interested', authorId, authorHandle });
      return { previous };
    },
    // Rolls back to the dismissal the post had before this change, which is none for a new one.
    onError: (error, { postId }, context) => {
      useDismissedPostsStore.getState().restore(postId, context?.previous);
      options.onError?.(error);
    },
    onSuccess: () => markStale(queryClient, [['feed'], ...RECOMMENDED_KEYS]),
  });
  const undo = useMutation({
    scope: FEEDBACK_SCOPE,
    mutationFn: ({ postId }: { postId: string }) => feedbackService.undoNotInterested(postId),
    onMutate: ({ postId }) => {
      const previous = dismissed(postId);
      useDismissedPostsStore.getState().clear(postId);
      return { previous };
    },
    // Rolls back to the row the viewer was looking at, so a refused undo leaves it in place.
    onError: (error, { postId }, context) => {
      useDismissedPostsStore.getState().restore(postId, context?.previous);
      options.onError?.(error);
    },
    onSuccess: () => markStale(queryClient, [['feed'], ...RECOMMENDED_KEYS]),
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
    onMutate: ({ postId, authorId, authorHandle }) => {
      const previous = dismissed(postId);
      useDismissedPostsStore.getState().set(postId, { kind: 'show-fewer', authorId, authorHandle });
      return { previous };
    },
    // Rolls back to the dismissal the post had before this change, which is none for a new one.
    onError: (error, { postId }, context) => {
      useDismissedPostsStore.getState().restore(postId, context?.previous);
      options.onError?.(error);
    },
    onSuccess: () => markStale(queryClient, RECOMMENDED_KEYS),
  });
  const undo = useMutation({
    scope: FEEDBACK_SCOPE,
    mutationFn: ({ authorId }: { postId: string; authorId: string }) =>
      safetyService.undoShowFewer(authorId),
    onMutate: ({ postId }) => {
      const previous = dismissed(postId);
      useDismissedPostsStore.getState().clear(postId);
      return { previous };
    },
    // Rolls back to the row the viewer was looking at, so a refused undo leaves it in place.
    onError: (error, { postId }, context) => {
      useDismissedPostsStore.getState().restore(postId, context?.previous);
      options.onError?.(error);
    },
    onSuccess: () => markStale(queryClient, RECOMMENDED_KEYS),
  });
  return { apply, undo };
};
