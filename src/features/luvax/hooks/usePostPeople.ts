import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import type { PostMediaResponse, PostTagInput } from '@/types/domain';
import type { SocialCacheRow } from '@/types/cache';
import { STALE_TIME } from '@/config/constants';
import { postService } from '@/services/post.service';
import { getNextCursor } from '@/utils/helpers';

import { invalidatePostAffectedQueries } from '../utils/postCacheKeys';
import { patchCachedPost } from './usePostLikeState';

export const peopleKeys = {
  tagRequests: () => ['notifications', 'tagRequests'],
  tagged: (userId: string | null | undefined) => ['taggedPosts', userId],
  invites: () => ['notifications', 'collaborationInvites'],
};

const mediaOf = (post: SocialCacheRow) => (post.media ?? []) as PostMediaResponse[];

type RequestPages = { pages?: { data: { content: { tagId: string }[] } }[] };

/**
 * Takes one tag out of the cached lists of waiting requests and returns a function that puts the
 * lists back, so a request leaves the viewer's screen the moment they answer it.
 */
const dropTagRequest = (queryClient: QueryClient, tagId: string) => {
  const snapshots = queryClient.getQueriesData<RequestPages>({
    queryKey: peopleKeys.tagRequests(),
  });
  snapshots.forEach(([key, cache]) => {
    if (!cache?.pages) return;
    queryClient.setQueryData(key, {
      ...cache,
      pages: cache.pages.map((page) => ({
        ...page,
        data: { ...page.data, content: page.data.content.filter((row) => row.tagId !== tagId) },
      })),
    });
  });
  return () => snapshots.forEach(([key, cache]) => queryClient.setQueryData(key, cache));
};

/**
 * Sets or clears the alt text of one media item of a post.
 *
 * Every cached copy of the post shows the new text at once. A refused save restores each copy to
 * the value it held before, and the error is thrown to the caller so the dialog can keep itself open
 * and say why. Alt text is editable by the owner on a post in any retained status.
 */
export const useEditAltText = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postId,
      postMediaId,
      altText,
    }: {
      postId: string;
      postMediaId: string;
      altText: string;
    }) => postService.updateAltText(postId, postMediaId, altText.trim() ? altText : null),
    onMutate: async ({ postId, postMediaId, altText }) => {
      await queryClient.cancelQueries({ queryKey: ['post', postId] });
      const restore = patchCachedPost(queryClient, postId, (post) => ({
        media: mediaOf(post).map((item) =>
          item.id === postMediaId ? { ...item, altText: altText.trim() || null } : item
        ),
      }));
      return { restore };
    },
    onError: (_error, _variables, context) => context?.restore(),
    onSettled: (_data, _error, { postId }) =>
      queryClient.invalidateQueries({ queryKey: ['post', postId] }),
  });
};

/**
 * Replaces the people tagged on a post with the given set.
 *
 * Calls `PUT /posts/{postId}/tags`; the response is the post with its resolved tags, so success
 * invalidates rather than patching, because which tags are pending or approved is the server's
 * decision.
 */
export const useReplacePostTags = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, tags }: { postId: string; tags: PostTagInput[] }) =>
      postService.replacePostTags(postId, tags),
    onSuccess: (_data, { postId }) => invalidatePostAffectedQueries(queryClient, postId),
  });
};

/**
 * Replaces the invited co-authors of a post.
 *
 * Success invalidates, because who accepted is the server's state and a withdrawn invitation must
 * disappear from the invitee's list.
 */
export const useReplaceCollaborators = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, userIds }: { postId: string; userIds: string[] }) =>
      postService.replaceCollaborators(postId, userIds),
    onSuccess: (_data, { postId }) => invalidatePostAffectedQueries(queryClient, postId),
  });
};

/**
 * Removes a tag from a post. The owner and the tagged person may, at any time.
 *
 * The marker leaves every cached copy of the post at once and comes back if the server refuses,
 * restoring the snapshot taken in `onMutate`. A tagged post also leaves the tagged tab of the person
 * who removed their own tag, so the tab and the waiting requests are refetched either way.
 */
export const useRemoveTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, tagId }: { postId: string; tagId: string }) =>
      postService.removeTag(postId, tagId),
    onMutate: async ({ postId, tagId }) => {
      await queryClient.cancelQueries({ queryKey: ['post', postId] });
      const restoreRequests = dropTagRequest(queryClient, tagId);
      const restorePost = patchCachedPost(queryClient, postId, (post) => ({
        media: mediaOf(post).map((item) => ({
          ...item,
          tags: (item.tags ?? []).filter((tag) => tag.id !== tagId),
        })),
      }));
      return {
        restore: () => {
          restorePost();
          restoreRequests();
        },
      };
    },
    onError: (_error, _variables, context) => context?.restore(),
    onSettled: (_data, _error, { postId }) => invalidatePostAffectedQueries(queryClient, postId),
  });
};

/**
 * Approves a tag that waits for the viewer.
 *
 * The marker turns approved in every cached copy of the post and the viewer's waiting-request list
 * drops the row at once; a refused approval restores both. The tagged tab is refetched afterwards,
 * because an approved tag is what puts the post on it.
 */
export const useApproveTag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, tagId }: { postId: string; tagId: string }) =>
      postService.approveTag(postId, tagId),
    onMutate: async ({ postId, tagId }) => {
      await queryClient.cancelQueries({ queryKey: ['post', postId] });
      const restoreRequests = dropTagRequest(queryClient, tagId);
      const restorePost = patchCachedPost(queryClient, postId, (post) => ({
        media: mediaOf(post).map((item) => ({
          ...item,
          tags: (item.tags ?? []).map((tag) =>
            tag.id === tagId ? { ...tag, status: 'approved' as const } : tag
          ),
        })),
      }));
      return {
        restore: () => {
          restorePost();
          restoreRequests();
        },
      };
    },
    onError: (_error, _variables, context) => context?.restore(),
    onSettled: (_data, _error, { postId }) => invalidatePostAffectedQueries(queryClient, postId),
  });
};

/**
 * The tags waiting for the viewer's approval.
 *
 * Query key `['notifications', 'tagRequests']`, under the `notifications` prefix the shared post
 * invalidation clears, so approving or removing a tag refreshes it.
 */
export const useTagRequests = ({ enabled = true } = {}) =>
  useInfiniteQuery({
    queryKey: peopleKeys.tagRequests(),
    queryFn: ({ pageParam = null, signal }) =>
      postService.getPendingTagRequests({ cursor: pageParam, limit: 20, signal }),
    getNextPageParam: getNextCursor,
    initialPageParam: null,
    staleTime: STALE_TIME.SHORT,
    enabled,
  });

/**
 * The published posts a user is tagged in, as the viewer may see them.
 *
 * Query key `['taggedPosts', userId]`.
 */
export const useTaggedPosts = (userId: string | null | undefined, { enabled = true } = {}) =>
  useInfiniteQuery({
    queryKey: peopleKeys.tagged(userId),
    queryFn: ({ pageParam = null, signal }) =>
      postService.getTaggedPosts(userId!, { cursor: pageParam, limit: 12, signal }),
    getNextPageParam: getNextCursor,
    initialPageParam: null,
    staleTime: STALE_TIME.SHORT,
    enabled: enabled && Boolean(userId),
  });

/** The invitations to co-author a post that the viewer has not answered. */
export const useCollaborationInvites = ({ enabled = true } = {}) =>
  useInfiniteQuery({
    queryKey: peopleKeys.invites(),
    queryFn: ({ pageParam = null, signal }) =>
      postService.getCollaborationInvites({ cursor: pageParam, limit: 20, signal }),
    getNextPageParam: getNextCursor,
    initialPageParam: null,
    staleTime: STALE_TIME.SHORT,
    enabled,
  });

/** The counts shown as one quiet line on the viewer's own profile. */
export const useWaitingInvolvement = ({ enabled = true } = {}) => {
  const tags = useQuery({
    queryKey: [...peopleKeys.tagRequests(), 'first'],
    queryFn: ({ signal }) => postService.getPendingTagRequests({ limit: 20, signal }),
    staleTime: STALE_TIME.SHORT,
    enabled,
  });
  const invites = useQuery({
    queryKey: [...peopleKeys.invites(), 'first'],
    queryFn: ({ signal }) => postService.getCollaborationInvites({ limit: 20, signal }),
    staleTime: STALE_TIME.SHORT,
    enabled,
  });
  return {
    tagRequests: tags.data?.data.content.length ?? 0,
    invitations: invites.data?.data.content.length ?? 0,
  };
};

/**
 * Accepts or declines an invitation to co-author a post, or leaves one already accepted.
 *
 * The invitation row leaves the viewer's list at once; the post is refetched either way because
 * accepting is what puts the viewer on its byline. A refused answer restores the list.
 */
export const useRespondToCollaboration = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, action }: { postId: string; action: 'accept' | 'decline' | 'leave' }) =>
      action === 'accept'
        ? postService.acceptCollaboration(postId)
        : action === 'decline'
          ? postService.declineCollaboration(postId)
          : postService.leaveCollaboration(postId),
    onMutate: async ({ postId }) => {
      await queryClient.cancelQueries({ queryKey: peopleKeys.invites() });
      const snapshots = queryClient.getQueriesData<{
        pages?: { data: { content: { postId: string }[] } }[];
      }>({ queryKey: peopleKeys.invites() });
      snapshots.forEach(([key, cache]) => {
        if (!cache?.pages) return;
        queryClient.setQueryData(key, {
          ...cache,
          pages: cache.pages.map((page) => ({
            ...page,
            data: {
              ...page.data,
              content: page.data.content.filter((row) => row.postId !== postId),
            },
          })),
        });
      });
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      // Rolls back to the snapshots taken in onMutate, so a refused answer leaves the invitation
      // in the list instead of making it disagree with the server.
      context?.snapshots.forEach(([key, cache]) => queryClient.setQueryData(key, cache));
    },
    onSettled: (_data, _error, { postId }) => invalidatePostAffectedQueries(queryClient, postId),
  });
};
