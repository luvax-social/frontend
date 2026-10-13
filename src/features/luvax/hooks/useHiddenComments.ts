import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { HTTP_STATUS } from '@/config/constants';
import { postService } from '@/services/post.service';
import type { ApiResponse, CursorPage } from '@/types/api';
import type { HiddenCommentResponse } from '@/types/domain';
import { getErrorCode } from '@/utils/captchaErrors';
import { getErrorResponse } from '@/utils/errors';
import { getNextCursor } from '@/utils/helpers';

type HiddenCommentsCache = InfiniteData<ApiResponse<CursorPage<HiddenCommentResponse>>>;

/** Backend code answered with 409 while the comment a reply answers is still hidden. */
export const PARENT_STILL_HIDDEN_CODE = 'COMMENT_PARENT_STILL_HIDDEN';

const hiddenCommentsKey = (postId: string | null | undefined) => ['comments', postId, 'hidden'];

/** True when the server refused an unhide because the comment's own parent is still hidden. */
export const isParentStillHidden = (error: unknown) =>
  getErrorCode(error) === PARENT_STILL_HIDDEN_CODE;

const withoutComment = (cached: HiddenCommentsCache | undefined, commentId: string) =>
  cached
    ? {
        ...cached,
        pages: cached.pages.map((envelope) =>
          envelope?.data
            ? {
                ...envelope,
                data: {
                  ...envelope.data,
                  content: envelope.data.content.filter((row) => row.id !== commentId),
                },
              }
            : envelope
        ),
      }
    : cached;

/**
 * The hidden comments on a post the viewer owns, newest first, paged on the server's cursor.
 *
 * Query key `['comments', postId, 'hidden']`, so every invalidation of `['comments', postId]`
 * also marks this list stale. The cache holds the response envelopes as the infinite query's
 * pages. The backend answers 404 to anyone who does not own the post, so only the owner's
 * panel mounts it.
 */
export const useHiddenComments = (postId: string | null | undefined) =>
  useInfiniteQuery({
    queryKey: hiddenCommentsKey(postId),
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      postService.getHiddenComments(postId!, { cursor: pageParam, limit: 20 }),
    getNextPageParam: getNextCursor,
    initialPageParam: null as string | null,
    enabled: Boolean(postId),
  });

/**
 * Approves one hidden comment.
 *
 * Optimistic: the row leaves the review list at once. On failure the list rolls back to the
 * snapshot taken in `onMutate`, so a refused unhide never leaves the row missing, and
 * `options.onError` receives the error with the comment id. A 404 also refetches the list,
 * because the comment is no longer hidden there. On success the post's comments, the post, the
 * feed and the open reply threads are invalidated for their counts; `['comments', postId]` is the
 * parent of the hidden list's key, so the list refetches too and replies released along with the
 * comment show up in the regular thread.
 */
export const useUnhideComment = (
  postId: string | null | undefined,
  options: { onError?: (error: unknown, commentId: string) => void } = {}
) => {
  const queryClient = useQueryClient();
  const key = hiddenCommentsKey(postId);
  return useMutation({
    mutationFn: (commentId: string) => postService.unhideComment(commentId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<HiddenCommentsCache>(key);
      queryClient.setQueryData<HiddenCommentsCache>(key, (cached) =>
        withoutComment(cached, commentId)
      );
      return { previous };
    },
    onError: (error, commentId, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      if (getErrorResponse(error)?.status === HTTP_STATUS.NOT_FOUND) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      options.onError?.(error, commentId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      // A released reply shows in an already expanded thread even when live updates are off.
      void queryClient.invalidateQueries({ queryKey: ['commentReplies'] });
    },
  });
};
