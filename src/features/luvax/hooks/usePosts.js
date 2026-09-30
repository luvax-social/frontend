import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { postService } from '@/services/post.service';
import { recommendationService } from '@/services/recommendation.service';
import { getNextCursor, dedupeInfinitePagesById } from '@/utils/helpers';
import { STALE_TIME } from '@/config/constants';
import { patchCachedPost, removeCachedPost } from './usePostLikeState';
import { beginSelfPostLike, endSelfPostLike, noteSelfCommentLike } from './useLivePostUpdates';

export const useFeed = (params = {}, { enabled = true } = {}) => {
  return useInfiniteQuery({
    queryKey: ['feed', params],
    queryFn: ({ pageParam = null, signal }) =>
      postService.getFeed({ ...params, cursor: pageParam, limit: 10, signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    getNextPageParam: getNextCursor,
    initialPageParam: null,
    enabled,
  });
};

/**
 * Explore's own inline caption/people search (the `q`-driven branch), kept
 * under its previous implementation and endpoint. Renamed from the old
 * `useExplore` because that name now names the recommendation-backed
 * discovery feed (see useRecommendedFeed below); this is the unrelated,
 * pre-existing search-as-you-type path and is out of this task's scope
 * beyond not breaking it.
 */
export const useExploreSearch = (params = {}) => {
  return useInfiniteQuery({
    queryKey: ['exploreSearch', params],
    queryFn: ({ pageParam = null, signal }) =>
      postService.getExplorePosts({ ...params, cursor: pageParam, limit: 10, signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    getNextPageParam: getNextCursor,
    initialPageParam: null,
  });
};

/**
 * The personalized recommendation feed, in its two variants.
 *
 * `excludeFollowed=false` is the "for you" feed (Home's default tab);
 * `excludeFollowed=true` is the discovery feed that backs Explore and
 * Search's pre-query state. Both go through the same service call and the
 * same hook, keyed apart so switching between them never drops either
 * one's cache.
 *
 * Cross-page duplicate ids are removed in `select`, which only reshapes the
 * data handed to the component; `getNextPageParam` still runs against the
 * raw, unselected pages, so pagination is unaffected. See
 * dedupeInfinitePagesById in utils/helpers.js.
 *
 * Ranking is refit on the backend every 5 minutes, so a stale time shorter than that would re-request an order
 * that has not actually changed; a stale time much longer would leave a
 * fresh fit invisible for the rest of a session. STALE_TIME.MEDIUM (5
 * minutes) matches the fit cadence. No polling: a ranked list reordering
 * itself under the reader every minute (the old refetchInterval) is worse
 * than a slightly stale order until the next deliberate navigation.
 *
 * On a 429, TanStack Query's own retry is disabled so no automatic retry
 * fires while the caller's rate-limit cooldown (see
 * src/hooks/useRateLimitCooldown.js and its call sites) is the thing
 * deciding when to try again.
 */
export const useRecommendedFeed = (excludeFollowed, { enabled = true } = {}) => {
  return useInfiniteQuery({
    queryKey: ['recommendedFeed', excludeFollowed],
    queryFn: ({ pageParam = null, signal }) =>
      recommendationService.getRecommendedFeed({
        cursor: pageParam,
        limit: 10,
        excludeFollowed,
        signal,
      }),
    select: dedupeInfinitePagesById,
    getNextPageParam: getNextCursor,
    initialPageParam: null,
    staleTime: STALE_TIME.MEDIUM,
    retry: (failureCount, error) => error?.response?.status !== 429 && failureCount < 1,
    enabled,
  });
};

/** Home's "for you" tab: the personalized feed with no follow exclusion. */
export const useForYouFeed = ({ enabled = true } = {}) => useRecommendedFeed(false, { enabled });

/**
 * The discovery feed behind Explore and Search's pre-query state.
 *
 * Kept as `useExplore` (rather than renamed) so both existing and new
 * callers read naturally; it no longer takes a `q` param, since Explore's
 * own inline caption/people search still runs through `useExploreSearch`
 * on a separate path this hook does not touch.
 */
export const useExplore = () => useRecommendedFeed(true);

/**
 * A user's posts, optionally narrowed to a set of post types.
 *
 * `types` is part of the query key on purpose. A cursor issued under one type
 * filter is rejected under any other, so the filter and the cursor sequence
 * have to live and die together. Keying on the filter makes React Query treat
 * a filter change as a different query, which starts it at a null cursor and
 * makes replaying a foreign cursor impossible by construction.
 * This hook deliberately takes no open parameter bag. The endpoint rejects any
 * parameter it does not declare, so forwarding arbitrary caller keys into the
 * query string would turn a harmless call site mistake into a 400.
 * @param {string} userId - The profile being read.
 * @param {string[]} [types] - Post types to include; omit or pass an empty array for all.
 * @param {{enabled?: boolean}} [options] - Set enabled false when the profile is unreadable.
 */
export const useUserPosts = (userId, types = [], { enabled = true } = {}) => {
  const type = types.length > 0 ? types : undefined;
  return useInfiniteQuery({
    queryKey: ['userPosts', userId, type ?? 'all'],
    queryFn: ({ pageParam = null, signal }) =>
      postService.getUserPosts(userId, { type, cursor: pageParam, limit: 10, signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
    getNextPageParam: getNextCursor,
    initialPageParam: null,
    enabled: enabled && !!userId,
  });
};

export const usePostDetail = (postId) => {
  return useQuery({
    queryKey: ['post', postId],
    queryFn: () => postService.getPostById(postId),
    enabled: !!postId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });
};

export const useCreatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => postService.createPost(data),
    onSuccess: () => {
      // Invalidate feed and userPosts so the new post appears everywhere
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['recommendedFeed'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
  });
};

export const useUpdatePostStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, status }) => postService.updatePostStatus(postId, status),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['post', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['recommendedFeed'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
    },
  });
};

export const useUpdatePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, data }) => postService.updatePost(postId, data),
    onSuccess: (response, variables) => {
      const updated = response?.data || response;
      if (updated?.id) {
        patchCachedPost(queryClient, variables.postId, {
          caption: updated.caption,
          tags: updated.tags,
          updatedAt: updated.updatedAt,
          editedAt: updated.editedAt,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['post', variables.postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['recommendedFeed'] });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: savedPostsKey });
      queryClient.invalidateQueries({ queryKey: likedPostsKey });
    },
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId) => postService.deletePost(postId),
    onSuccess: (_data, postId) => {
      removeCachedPost(queryClient, postId);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['explore'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: savedPostsKey });
      queryClient.invalidateQueries({ queryKey: likedPostsKey });
    },
  });
};

/**
 * Likes or unlikes a post.
 *
 * The optimistic update is applied to every cache entry holding the post rather
 * than to the component that fired it, because the feed card and post detail can
 * be on screen at the same time and must agree. A failure restores every entry
 * to the value it held before.
 */
export const useLikePost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, liked }) =>
      liked ? postService.unlikePost(postId) : postService.likePost(postId),
    // Two mechanisms cooperate on the like path. The optimistic patch gives the
    // tap an immediate result across every rendering of the post at once. The
    // in-flight guard tells the live post-like handler to skip the broadcast
    // frame for this post until the mutation settles, because that frame carries
    // an absolute count that may not yet include this viewer's tap and would
    // otherwise visibly undo it.
    onMutate: async ({ postId, liked }) => {
      beginSelfPostLike(postId);
      await queryClient.cancelQueries({ queryKey: ['post', postId] });
      const nextLiked = !liked;

      const restore = patchCachedPost(queryClient, postId, (post) => ({
        isLiked: nextLiked,
        likeCount: Math.max(0, (post.likeCount ?? 0) + (nextLiked ? 1 : -1)),
      }));

      return { restore };
    },
    onSuccess: (data, { postId }) => {
      // The endpoint may answer with the authoritative count. Applying it
      // through the same patch reaches both renderings, which is what the
      // per-component reconciliation could not do.
      const result = data?.data || data;
      if (typeof result?.likeCount === 'number') {
        patchCachedPost(queryClient, postId, { likeCount: result.likeCount });
      }
    },
    onError: (_error, _variables, context) => {
      context?.restore?.();
    },
    onSettled: (_data, _error, { postId }) => {
      endSelfPostLike(postId);
      // The profile "liked" tab is a distinct list keyed on likedAt, so a like
      // or unlike must refetch it; the optimistic post patch alone never adds or
      // removes the row there.
      queryClient.invalidateQueries({ queryKey: likedPostsKey });
    },
  });
};

export const savedPostsKey = ['savedPosts'];

/**
 * The viewer's saved posts.
 *
 * Rows are SavedPostResponse, so consumers unwrap `row.post` rather than
 * reading the post fields off the row.
 */
export const useSavedPosts = () => {
  return useInfiniteQuery({
    queryKey: savedPostsKey,
    queryFn: ({ pageParam = null, signal }) =>
      postService.getSavedPosts({ cursor: pageParam ?? undefined, limit: 12, signal }),
    getNextPageParam: getNextCursor,
    initialPageParam: null,
  });
};

export const likedPostsKey = ['likedPosts'];

/**
 * The viewer's liked posts.
 *
 * Always the authenticated account's own likes. The endpoint takes no path
 * parameter for another user, so this cannot be pointed at a profile the
 * viewer is looking at.
 *
 * Rows are LikedPostResponse, so consumers unwrap `row.post`. The row
 * timestamp is `likedAt`, not `savedAt`.
 */
export const useLikedPosts = (enabled = true) => {
  return useInfiniteQuery({
    queryKey: likedPostsKey,
    queryFn: ({ pageParam = null, signal }) =>
      postService.getLikedPosts({ cursor: pageParam ?? undefined, limit: 12, signal }),
    getNextPageParam: getNextCursor,
    initialPageParam: null,
    enabled,
  });
};

/**
 * Saves or unsaves a post.
 *
 * Carries no counter of its own, so the patch is a single flag, but it spans the
 * same set of cache entries for the same reason.
 */
export const useSavePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, saved }) =>
      saved ? postService.unsavePost(postId) : postService.savePost(postId),
    onMutate: async ({ postId, saved }) => {
      await queryClient.cancelQueries({ queryKey: ['post', postId] });
      const nextSaved = !saved;
      const restore = patchCachedPost(queryClient, postId, (post) => ({
        isSaved: nextSaved,
        viewerState: { ...(post.viewerState || {}), isSaved: nextSaved },
      }));
      return { restore };
    },
    onError: (_error, _variables, context) => {
      context?.restore?.();
    },
    // The saved list is server state, so it is re-read rather than patched.
    // This is what makes saving from anywhere in the application show up on the
    // saved screen, and unsaving from the saved screen drop the row without a
    // reload.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: savedPostsKey });
    },
  });
};

export const useTopLevelComments = (postId) => {
  return useInfiniteQuery({
    queryKey: ['comments', postId],
    queryFn: ({ pageParam = null }) =>
      postService.getComments(postId, { cursor: pageParam, limit: 20 }),
    getNextPageParam: getNextCursor,
    initialPageParam: null,
    enabled: !!postId,
  });
};

export const useCommentReplies = (commentId, enabled) => {
  return useQuery({
    queryKey: ['commentReplies', commentId],
    queryFn: () => postService.getCommentReplies(commentId, { limit: 50 }),
    enabled: !!commentId && enabled,
  });
};

/**
 * How many comments deleting this one would remove, for the confirmation copy.
 *
 * Fetched only while the dialogue is open. It is not retried: the dialogue has
 * wording that works without a number, so a second attempt would keep the user
 * waiting for something the screen does not need.
 */
export const useCommentDeletionScope = (commentId, enabled) => {
  return useQuery({
    queryKey: ['commentDeletionScope', commentId],
    queryFn: () => postService.getCommentDeletionScope(commentId),
    enabled: !!commentId && enabled,
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
};

/**
 * The cache entry that holds a given comment.
 *
 * Top-level comments live in the post's infinite list; a reply lives in its
 * parent's replies query. Targeting the exact entry is what keeps liking a deep
 * reply from refetching the whole tree.
 */
const commentListKey = (postId, parentId) =>
  parentId ? ['commentReplies', parentId] : ['comments', postId];

/**
 * Applies a mapper to every comment held in a cache entry.
 *
 * The two comment queries have different shapes: the top-level list is an
 * infinite query with a `pages` array, the replies query is a single payload.
 * Both wrap the rows in the `ApiResponse` envelope under `data.content`.
 */
const mapCachedComments = (mapper) => (cached) => {
  if (!cached) {
    return cached;
  }

  const mapPayload = (payload) => {
    const rows = payload?.data?.content;
    if (!Array.isArray(rows)) {
      return payload;
    }
    return { ...payload, data: { ...payload.data, content: rows.map(mapper) } };
  };

  if (Array.isArray(cached.pages)) {
    return { ...cached, pages: cached.pages.map(mapPayload) };
  }

  return mapPayload(cached);
};

export const useCreateComment = (postId) => {
  const queryClient = useQueryClient();
  // Held across attempts so a retry of the same submission replays the same key
  // and the backend returns the original comment instead of creating a second.
  // Cleared once a submission succeeds, so the next comment gets a fresh key.
  const pendingKeyRef = useRef(null);

  return useMutation({
    mutationFn: ({ parentId, content }) => {
      if (!pendingKeyRef.current) {
        pendingKeyRef.current = crypto.randomUUID();
      }

      return postService.createComment(postId, {
        parentId,
        content,
        idempotencyKey: pendingKeyRef.current,
      });
    },
    onSuccess: (_, variables) => {
      pendingKeyRef.current = null;

      if (variables.parentId) {
        queryClient.invalidateQueries({ queryKey: ['commentReplies', variables.parentId] });
      }
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });
};

/**
 * Likes or unlikes a comment.
 *
 * The like endpoints answer with no body, so the count cannot be read back from
 * the response. It is adjusted in the cache instead and rolled back if the
 * request fails, which keeps a wrong number from surviving on screen. Nothing is
 * invalidated on success: the trigger moves the counter by exactly the amount
 * applied here, and refetching the first page would re-run the pinned selection
 * and could reorder comments under the reader mid-interaction.
 */
export const useToggleCommentLike = (postId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, isLiked }) =>
      isLiked ? postService.unlikeComment(commentId) : postService.likeComment(commentId),
    onMutate: async ({ commentId, isLiked, parentId }) => {
      // The like broadcast carries no count and does not say who liked, so the
      // live handler moves the count by one for every frame it sees. This
      // viewer's own like comes back as such a frame, and the optimistic change
      // below has already accounted for it. Recording it here lets the live
      // handler skip that one echo instead of counting the like twice.
      noteSelfCommentLike(commentId, !isLiked);

      const queryKey = commentListKey(postId, parentId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(
        queryKey,
        mapCachedComments((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                isLiked: !isLiked,
                likeCount: Math.max(0, (comment.likeCount ?? 0) + (isLiked ? -1 : 1)),
              }
            : comment
        )
      );

      return { queryKey, previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
  });
};

/**
 * Replaces the body of a comment the viewer authored.
 *
 * Only the body and its timestamps are copied out of the response. A
 * single-comment response always reports `pinned` as false, so spreading the
 * whole object would silently strip the pinned marker from a comment that is in
 * the pinned block.
 *
 * `editedAt` is among them because it is what the edited marker reads. Copying
 * only the body would leave the marker absent until the list happened to be
 * refetched.
 */
export const useEditComment = (postId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, content }) => postService.editComment(commentId, content),
    onSuccess: (response, { parentId }) => {
      const updated = response?.data;
      if (!updated?.id) {
        return;
      }

      queryClient.setQueryData(
        commentListKey(postId, parentId),
        mapCachedComments((comment) =>
          comment.id === updated.id
            ? {
                ...comment,
                content: updated.content,
                updatedAt: updated.updatedAt,
                editedAt: updated.editedAt,
              }
            : comment
        )
      );
    },
  });
};

/**
 * Soft-deletes a comment and every descendant.
 *
 * The response now reports how many comments were removed, but the affected
 * lists are still refetched rather than patched. The count says how many rows
 * went, not which ones, and the descendants are spread across nested replies
 * entries the client never enumerated. Patching the post's comment count from
 * the number would also mean computing a denormalised counter client-side,
 * which the workspace counter policy reserves to the database.
 *
 * The count is used to drop the deleted subtree's own replies entry, which can
 * no longer be fetched and would otherwise sit in the cache until collected.
 */
export const useDeleteComment = (postId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId }) => postService.deleteComment(commentId),
    onSuccess: (response, { commentId, parentId }) => {
      const removedCount = response?.data?.deletedCommentCount ?? 0;

      if (removedCount > 1) {
        queryClient.removeQueries({ queryKey: ['commentReplies', commentId] });
      }
      queryClient.removeQueries({ queryKey: ['commentDeletionScope', commentId] });

      if (parentId) {
        queryClient.invalidateQueries({ queryKey: ['commentReplies', parentId] });
      }
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });
};
