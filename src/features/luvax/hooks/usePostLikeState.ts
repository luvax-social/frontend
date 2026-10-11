/**
 * Cache patching for the post interactions that used to live in component state.
 *
 * The same post is held by several caches at once: the feed's infinite list, a
 * profile's list, explore, and its own detail entry. Opening post detail from a
 * feed card renders two of those simultaneously, so a like applied only to the
 * instance that fired the mutation left the other one stale until a refetch.
 * Patching every entry is what keeps two renderings of one post in agreement.
 */

import type { QueryClient } from '@tanstack/react-query';
import type { SocialCacheRow, SocialCacheEntry } from '@/types/cache';
import type { SocialUser, Relationship } from '@/types/social';
type PostPatch = Partial<SocialCacheRow> | ((post: SocialCacheRow) => Partial<SocialCacheRow>);
import { withRelationshipPatch } from '../utils/relationship';

// Prefix keys. Every post query is keyed with parameters after the prefix, so
// matching on the prefix reaches each parameter variant that is currently held.
const POST_LIST_PREFIXES = [
  ['feed'],
  ['explore'],
  ['exploreSearch'],
  ['recommendedFeed'],
  ['userPosts'],
  ['savedPosts'],
  ['likedPosts'],
];

const applyToPost =
  (postId: string, patch: PostPatch) => (cached: SocialCacheEntry | undefined) => {
    if (!cached) return cached;

    const mapPost = (post: SocialCacheRow) => {
      if (post?.id !== postId) return post;
      const applied = typeof patch === 'function' ? patch(post) : patch;
      return { ...post, ...applied };
    };

    const mapRow = (row: SocialCacheRow) => {
      if (row?.post?.id === postId) {
        return { ...row, post: mapPost(row.post) };
      }
      return mapPost(row);
    };

    const mapPayload = (payload: SocialCacheEntry) => {
      const rows = payload?.data?.content;
      if (Array.isArray(rows)) {
        return { ...payload, data: { ...payload.data, content: rows.map(mapRow) } };
      }
      // The single-post entry carries one row under the same envelope.
      if (payload?.data?.id === postId) {
        return { ...payload, data: mapPost(payload.data) };
      }
      return payload;
    };

    if (Array.isArray(cached.pages)) {
      return { ...cached, pages: cached.pages.map(mapPayload) };
    }

    return mapPayload(cached);
  };

/**
 * Patches every cached copy of one post and returns a function restoring them.
 *
 * @param {Object} queryClient the TanStack Query client
 * @param {string} postId the post to patch
 * @param {Object|Function} patch fields to merge, or a function of the current post returning them
 * @returns {Function} restores every entry to the value it held before the patch
 */
export const patchCachedPost = (queryClient: QueryClient, postId: string, patch: PostPatch) => {
  const entries = POST_LIST_PREFIXES.flatMap((queryKey) =>
    queryClient.getQueriesData<SocialCacheEntry>({ queryKey })
  ).concat(queryClient.getQueriesData<SocialCacheEntry>({ queryKey: ['post', postId] }));

  entries.forEach(([queryKey]) => {
    queryClient.setQueryData<SocialCacheEntry>(queryKey, applyToPost(postId, patch));
  });

  // The snapshots are captured above rather than re-derived, so a rollback
  // cannot reinstate a value that a later interaction has already changed.
  return () => {
    entries.forEach(([queryKey, previous]) => {
      queryClient.setQueryData(queryKey, previous);
    });
  };
};

const applyToAuthor =
  (targetUserId: string, patch: Relationship) => (cached: SocialCacheEntry | undefined) => {
    if (!cached) return cached;

    const mapAuthor = (author: SocialUser | undefined) => {
      if (author?.id !== targetUserId) return author;
      const viewerState = withRelationshipPatch(author.viewerState, patch);
      const relationship = { ...(author.relationship || {}), ...patch };
      return { ...author, ...patch, relationship, viewerState };
    };

    const mapPost = (post: SocialCacheRow) => {
      if (!post) return post;
      const author = mapAuthor(post.author);
      if (author === post.author) return post;
      const viewerState = withRelationshipPatch(post.viewerState, patch);
      return { ...post, author, viewerState };
    };

    const mapRow = (row: SocialCacheRow) => {
      if (row?.post) return { ...row, post: mapPost(row.post) };
      if (row?.user?.id === targetUserId) {
        return {
          ...row,
          user: mapAuthor(row.user),
          viewerState: withRelationshipPatch(row.viewerState, patch),
        };
      }
      return mapPost(row);
    };

    const mapPayload = (payload: SocialCacheEntry) => {
      const rows = payload?.data?.content;
      if (Array.isArray(rows)) {
        return { ...payload, data: { ...payload.data, content: rows.map(mapRow) } };
      }
      if (payload?.data?.author?.id === targetUserId) {
        return { ...payload, data: mapPost(payload.data) };
      }
      if (payload?.data?.id === targetUserId) {
        return { ...payload, data: mapAuthor(payload.data) };
      }
      return payload;
    };

    if (Array.isArray(cached.pages)) {
      return { ...cached, pages: cached.pages.map(mapPayload) };
    }

    return mapPayload(cached);
  };

export const patchCachedAuthorRelationship = (
  queryClient: QueryClient,
  targetUserId: string,
  patch: Relationship
) => {
  const entries = POST_LIST_PREFIXES.flatMap((queryKey) =>
    queryClient.getQueriesData<SocialCacheEntry>({ queryKey })
  ).concat(queryClient.getQueriesData<SocialCacheEntry>({ queryKey: ['users'] }));

  entries.forEach(([queryKey]) => {
    queryClient.setQueryData<SocialCacheEntry>(queryKey, applyToAuthor(targetUserId, patch));
  });

  return () => {
    entries.forEach(([queryKey, previous]) => {
      queryClient.setQueryData(queryKey, previous);
    });
  };
};

const removeFromPostList = (postId: string) => (cached: SocialCacheEntry | undefined) => {
  if (!cached) return cached;

  const keepRow = (row: SocialCacheRow) => row?.id !== postId && row?.post?.id !== postId;

  const mapPayload = (payload: SocialCacheEntry) => {
    const rows = payload?.data?.content;
    if (!Array.isArray(rows)) return payload;
    return { ...payload, data: { ...payload.data, content: rows.filter(keepRow) } };
  };

  if (Array.isArray(cached.pages)) {
    return { ...cached, pages: cached.pages.map(mapPayload) };
  }

  return mapPayload(cached);
};

/**
 * Removes a post from every list cache and clears its detail entry after a
 * successful delete, so closed overlays and profile grids cannot keep showing a
 * post the server has already removed.
 */
export const removeCachedPost = (queryClient: QueryClient, postId: string) => {
  POST_LIST_PREFIXES.flatMap((queryKey) =>
    queryClient.getQueriesData<SocialCacheEntry>({ queryKey })
  ).forEach(([queryKey]) => {
    queryClient.setQueryData<SocialCacheEntry>(queryKey, removeFromPostList(postId));
  });

  queryClient.removeQueries({ queryKey: ['post', postId] });
};
