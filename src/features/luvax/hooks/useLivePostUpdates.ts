import type { QueryClient } from '@tanstack/react-query';
import type { ApiResponse } from '@/types/api';
import type { Post } from '@/types/social';
import type { CommentResponse } from '@/types/domain';
import type { CommentCachePage } from '@/types/cache';
type CommentBroadcast = Omit<CommentResponse, 'isLiked' | 'hasReported' | 'pinned'>;
/**
 * The comment frames this hook acts on. `comment.unhidden.v1` is the release of a comment the
 * post owner had hidden; it reaches every subscriber whole, as a created comment does.
 */
type CommentEventType =
  | 'comment.created.v1'
  | 'comment.unhidden.v1'
  | 'comment.edited.v1'
  | 'comment.deleted.v1'
  | 'comment.liked.v1'
  | 'comment.unliked.v1';
interface CommentEvent {
  eventType: CommentEventType;
  data?: {
    comment?: CommentBroadcast;
    userId?: string;
    parentId?: string | null;
    rootId?: string | null;
    commentId?: string;
    deletedCommentCount?: number;
  };
}
interface PostEvent {
  eventType: string;
  data?: { likeCount?: number };
}
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { subscribeTopic } from '@/services/realtime/stompConnection';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Applies live comment and post events to the query cache for one open post.
 *
 * Scope is deliberately the post the viewer currently has open. The feed does
 * not subscribe and notifications do not subscribe.
 *
 * Everything here writes to the TanStack Query cache rather than to component
 * state, so a live update and a refetch converge on the same place instead of
 * competing.
 */

const COMMENT_TOPIC = (postId: string) => `/topic/comments.${postId}.events`;
const POST_TOPIC = (postId: string) => `/topic/posts.${postId}.events`;

/**
 * Records of actions the viewer performed themselves, so the broadcast echo of
 * those actions can be skipped.
 *
 * This exists because `comment.liked.v1` and `comment.unliked.v1` carry no
 * count and no liker identity: the frame says only that some comment's like
 * state moved. The client must therefore adjust the count by one itself, and a
 * viewer who likes a comment receives the echo of their own like. Without
 * suppression that like would be counted twice, once optimistically and once on
 * arrival.
 *
 * Keyed by `commentId:eventType`, holding a count so two rapid taps are both
 * accounted for. Entries expire so a dropped frame cannot suppress a later,
 * genuinely remote event forever.
 */
const SELF_ECHO_TTL_MS = 10000;
const selfEchoes = new Map<string, { count: number; at: number }>();

const echoKey = (id: string, eventType: string) => `${id}:${eventType}`;

const noteSelfEcho = (id: string, eventType: string) => {
  const key = echoKey(id, eventType);
  const entry = selfEchoes.get(key) ?? { count: 0, at: 0 };
  selfEchoes.set(key, { count: entry.count + 1, at: Date.now() });
};

const consumeSelfEcho = (id: string, eventType: string) => {
  const key = echoKey(id, eventType);
  const entry = selfEchoes.get(key);
  if (!entry) {
    return false;
  }
  if (Date.now() - entry.at > SELF_ECHO_TTL_MS) {
    selfEchoes.delete(key);
    return false;
  }
  if (entry.count <= 1) {
    selfEchoes.delete(key);
  } else {
    selfEchoes.set(key, { count: entry.count - 1, at: entry.at });
  }
  return true;
};

/** Called by the comment like mutation so its own broadcast echo is ignored. */
export const noteSelfCommentLike = (commentId: string, willBeLiked: boolean) =>
  noteSelfEcho(commentId, willBeLiked ? 'comment.liked.v1' : 'comment.unliked.v1');

/**
 * Post like mutations in flight, per post id.
 *
 * The post like frame carries an absolute count, which is self-healing and safe
 * to apply blind in most cases. The exception is the moment the viewer's own tap
 * is in flight: the server's count may not include it yet, so applying the frame
 * would visibly undo the viewer's own action before the mutation settles.
 */
const postLikesInFlight = new Map<string, number>();

export const beginSelfPostLike = (postId: string) =>
  postLikesInFlight.set(postId, (postLikesInFlight.get(postId) ?? 0) + 1);

export const endSelfPostLike = (postId: string) => {
  const next = (postLikesInFlight.get(postId) ?? 1) - 1;
  if (next <= 0) {
    postLikesInFlight.delete(postId);
  } else {
    postLikesInFlight.set(postId, next);
  }
};

/**
 * Rewrites every comment row held in a cache entry.
 *
 * The two comment queries have different shapes: the top-level list is an
 * infinite query with a `pages` array, the replies query is a single payload.
 * Both wrap rows in the `ApiResponse` envelope under `data.content`.
 */
const mapCachedComments =
  (mapper: (comment: CommentResponse) => CommentResponse) =>
  (cached: CommentCachePage | undefined) => {
    if (!cached) {
      return cached;
    }
    const mapPayload = (payload: CommentCachePage) => {
      const rows = payload?.data?.content;
      if (!cached || !Array.isArray(rows)) {
        return payload;
      }
      return { ...payload, data: { ...payload.data, content: rows.map(mapper) } };
    };
    if (Array.isArray(cached.pages)) {
      return { ...cached, pages: cached.pages.map(mapPayload) };
    }
    return mapPayload(cached);
  };

const removeCachedComment = (commentId: string) => (cached: CommentCachePage | undefined) => {
  if (!cached) {
    return cached;
  }
  const filterPayload = (payload: CommentCachePage) => {
    const rows = payload?.data?.content;
    if (!Array.isArray(rows)) {
      return payload;
    }
    return {
      ...payload,
      data: { ...payload.data, content: rows.filter((row) => row.id !== commentId) },
    };
  };
  if (Array.isArray(cached.pages)) {
    return { ...cached, pages: cached.pages.map(filterPayload) };
  }
  return filterPayload(cached);
};

const cachedCommentIds = (cached: CommentCachePage | undefined) => {
  const ids = new Set<string>();
  const collect = (payload: CommentCachePage) => {
    for (const row of payload?.data?.content ?? []) {
      ids.add(row.id);
    }
  };
  if (Array.isArray(cached?.pages)) {
    cached.pages.forEach(collect);
  } else if (cached) {
    collect(cached);
  }
  return ids;
};

/** Adjusts a counter on the cached post detail without touching viewer state. */
const adjustPostCounter = (
  queryClient: QueryClient,
  postId: string,
  field: 'likeCount' | 'commentCount',
  delta: number
) => {
  queryClient.setQueryData<ApiResponse<Post>>(['post', postId], (cached) => {
    const post = cached?.data;
    if (!post) {
      return cached;
    }
    return {
      ...cached,
      data: { ...post, [field]: Math.max(0, (post[field] ?? 0) + delta) },
    };
  });
};

export const useLivePostUpdates = (postId: string | null | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!postId) {
      return undefined;
    }

    const onCommentEvent = ({ eventType, data }: CommentEvent) => {
      if (!data) {
        return;
      }
      const commentsKey = ['comments', postId];

      if (eventType === 'comment.created.v1' || eventType === 'comment.unhidden.v1') {
        const incoming = data.comment;
        if (!incoming) {
          return;
        }
        const released = eventType === 'comment.unhidden.v1';

        if (released) {
          // The owner's review list no longer holds a comment that has been released, whoever
          // released it. Nothing is written when that list was never opened.
          queryClient.setQueryData<CommentCachePage>(
            [...commentsKey, 'hidden'],
            removeCachedComment(incoming.id)
          );
          // A released comment is new to every viewer, including the owner whose unhide already
          // invalidated these queries, so a frame for a row that is already cached must not
          // count it a second time.
          const alreadyCached = incoming.parentId
            ? cachedCommentIds(
                queryClient.getQueryData<CommentCachePage>(['commentReplies', incoming.parentId])
              ).has(incoming.id)
            : cachedCommentIds(queryClient.getQueryData<CommentCachePage>(commentsKey)).has(
                incoming.id
              );
          if (alreadyCached) {
            return;
          }
        }

        // The viewer's own new comment is already applied to the cache by the
        // create mutation, which invalidates the comment, replies and post
        // queries so the authoritative counts and rows are refetched. Applying
        // this broadcast on top of that counted the same comment twice, which
        // showed a single reply as two. A self-authored creation is therefore
        // skipped here; a remote one still flows through below. data.userId is
        // the event author on every comment.* frame.
        const currentUserId = useAuthStore.getState().user?.id;
        if (!released && currentUserId && data.userId && currentUserId === data.userId) {
          return;
        }

        // A reply belongs to its parent's replies query, which only exists once
        // the viewer has expanded that thread. If it is not cached, there is
        // nothing to update and the count below is the only visible effect.
        if (incoming.parentId) {
          const repliesKey = ['commentReplies', incoming.parentId];
          if (queryClient.getQueryData<CommentCachePage>(repliesKey)) {
            queryClient.setQueryData<CommentCachePage>(repliesKey, (cached) => {
              if (cachedCommentIds(cached).has(incoming.id)) {
                return cached;
              }
              const rows = cached?.data?.content;
              if (!Array.isArray(rows)) {
                return cached;
              }
              return {
                ...cached,
                data: { ...cached?.data, content: [...rows, decorateNewComment(incoming)] },
              };
            });
          }
          queryClient.setQueryData<CommentCachePage>(
            commentsKey,
            mapCachedComments((comment) =>
              comment.id === incoming.parentId
                ? { ...comment, replyCount: (comment.replyCount ?? 0) + 1 }
                : comment
            )
          );
          adjustPostCounter(queryClient, postId, 'commentCount', 1);
          return;
        }

        queryClient.setQueryData<CommentCachePage>(commentsKey, (cached) => {
          if (!cached || !Array.isArray(cached.pages) || cached.pages.length === 0) {
            return cached;
          }
          // The viewer's own comment reaches the cache twice: once because
          // creating it invalidates this query, and once as this broadcast.
          // Matching on id collapses both into the single row that is already
          // there, whichever arrived first.
          if (cachedCommentIds(cached).has(incoming.id)) {
            return cached;
          }
          // Appended to the last page, never prepended. The first page opens
          // with a pinned block the server selected, and a live arrival must not
          // land inside it. Appending also means nothing already on screen moves
          // under a reader.
          const pages = [...cached.pages];
          const last = pages[pages.length - 1];
          const rows = last?.data?.content;
          if (!Array.isArray(rows)) {
            return cached;
          }
          pages[pages.length - 1] = {
            ...last,
            data: { ...last.data, content: [...rows, decorateNewComment(incoming)] },
          };
          return { ...cached, pages };
        });
        adjustPostCounter(queryClient, postId, 'commentCount', 1);
        return;
      }

      if (eventType === 'comment.edited.v1') {
        const incoming = data.comment;
        if (!incoming) {
          return;
        }
        // Only the fields an edit can actually change are copied across. The
        // broadcast omits isLiked, hasReported and pinned because they are
        // per-viewer or per-page, so the cached values are kept verbatim. This
        // is the case where overwriting with a default would silently reset the
        // viewer's own like.
        const applyEdit = (comment: CommentResponse) =>
          comment.id === incoming.id
            ? {
                ...comment,
                content: incoming.content,
                editedAt: incoming.editedAt,
                updatedAt: incoming.updatedAt,
              }
            : comment;
        queryClient.setQueryData<CommentCachePage>(commentsKey, mapCachedComments(applyEdit));
        if (data.parentId) {
          queryClient.setQueryData<CommentCachePage>(
            ['commentReplies', data.parentId],
            mapCachedComments(applyEdit)
          );
        }
        return;
      }

      if (eventType === 'comment.deleted.v1') {
        const { commentId, deletedCommentCount } = data;
        if (!commentId) {
          return;
        }
        queryClient.setQueryData<CommentCachePage>(commentsKey, removeCachedComment(commentId));
        queryClient.setQueryData<CommentCachePage>(['commentReplies', commentId], undefined);
        queryClient.removeQueries({ queryKey: ['commentReplies', commentId] });
        // The frame carries how many comments went, because deleting a comment
        // soft-deletes its replies too. That count is used rather than
        // refetching: a refetch of the first page would re-run the server's
        // pinned selection and could reorder comments under a reader who is in
        // the middle of reading. The count is enough to keep the post's total
        // honest, which is all the refetch would have bought.
        adjustPostCounter(queryClient, postId, 'commentCount', -(deletedCommentCount || 1));
        return;
      }

      if (eventType === 'comment.liked.v1' || eventType === 'comment.unliked.v1') {
        const { commentId } = data;
        if (!commentId || consumeSelfEcho(commentId, eventType)) {
          return;
        }
        // These frames carry no count, so the count is moved by one here. The
        // viewer's own isLiked is never touched: the frame does not say who
        // liked, so it cannot say anything about this viewer.
        const delta = eventType === 'comment.liked.v1' ? 1 : -1;
        const applyLike = (comment: CommentResponse) =>
          comment.id === commentId
            ? { ...comment, likeCount: Math.max(0, (comment.likeCount ?? 0) + delta) }
            : comment;
        queryClient.setQueryData<CommentCachePage>(commentsKey, mapCachedComments(applyLike));
        if (data.rootId) {
          queryClient.setQueryData<CommentCachePage>(
            ['commentReplies', data.rootId],
            mapCachedComments(applyLike)
          );
        }
      }
    };

    const onPostEvent = ({ eventType, data }: PostEvent) => {
      if (eventType !== 'post.live.liked.v1' && eventType !== 'post.live.unliked.v1') {
        return;
      }
      if (typeof data?.likeCount !== 'number' || postLikesInFlight.has(postId)) {
        return;
      }
      const likeCount = data.likeCount;
      // The count is absolute rather than a delta, so it is assigned, not added.
      // isLiked is left exactly as the cache holds it: the frame is shared by
      // every subscriber and says nothing about this viewer.
      queryClient.setQueryData<ApiResponse<Post>>(['post', postId], (cached) => {
        const post = cached?.data;
        if (!post || post.likeCount === likeCount) {
          return cached;
        }
        return { ...cached, data: { ...post, likeCount } };
      });
    };

    const unsubscribeComments = subscribeTopic(COMMENT_TOPIC(postId), onCommentEvent);
    const unsubscribePosts = subscribeTopic(POST_TOPIC(postId), onPostEvent);

    return () => {
      unsubscribeComments();
      unsubscribePosts();
    };
  }, [postId, queryClient]);
};

/**
 * Fills the three fields a broadcast deliberately omits, for a comment that has
 * just been created.
 *
 * This is not inventing a value to paper over a gap. A comment that came into
 * existence a moment ago cannot have been liked or reported by anyone, and the
 * server's pinned block is chosen per page and never contains an arrival, so all
 * three values are determined rather than guessed. The same assumption would be
 * wrong on any other event type, which is why this is only applied here.
 */
const decorateNewComment = (comment: CommentBroadcast): CommentResponse => ({
  ...comment,
  isLiked: false,
  hasReported: false,
  pinned: false,
});
