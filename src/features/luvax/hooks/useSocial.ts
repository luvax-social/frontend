import type { QueryClient } from '@tanstack/react-query';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import * as socialService from '../../../services/social.service';
import { getNextCursor } from '@/utils/helpers';
import { notifKeys } from './useNotifications';
import { patchCachedAuthorRelationship } from './usePostLikeState';

export const socialKeys = {
  all: ['social'],
  followers: (userId?: string | null) =>
    userId ? [...socialKeys.all, 'followers', userId] : [...socialKeys.all, 'followers'],
  following: (userId?: string | null) =>
    userId ? [...socialKeys.all, 'following', userId] : [...socialKeys.all, 'following'],
  requests: () => [...socialKeys.all, 'follow-requests'],
  blocked: () => [...socialKeys.all, 'blocked'],
};

// Caches that can list an account somewhere other than the feeds: the story tray, the trending
// hashtag previews with their cover images, account suggestions, search results and hashtag
// pages. Literals, like the feed keys used below them: the hooks that own these keys sit in
// several modules and the search key in another slice. A block changes who is visible on all of
// them at once.
const ACCOUNT_SURFACE_KEYS = [
  ['storyFeed'],
  ['trendingPreviews'],
  ['suggestions'],
  ['search'],
  ['hashtag'],
];

const refreshAccountSurfaces = (queryClient: QueryClient) =>
  ACCOUNT_SURFACE_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));

// --- Queries ---

export const useFollowers = (userId: string | null | undefined, enabled = true) => {
  return useInfiniteQuery({
    queryKey: socialKeys.followers(userId),
    queryFn: ({ pageParam = null, signal }) =>
      socialService.getFollowers(userId!, pageParam, undefined, signal),
    initialPageParam: undefined as string | null | undefined,
    getNextPageParam: getNextCursor,
    enabled: !!userId && enabled,
  });
};

export const useFollowing = (userId: string | null | undefined, enabled = true) => {
  return useInfiniteQuery({
    queryKey: socialKeys.following(userId),
    queryFn: ({ pageParam = null, signal }) =>
      socialService.getFollowing(userId!, pageParam, undefined, signal),
    initialPageParam: undefined as string | null | undefined,
    getNextPageParam: getNextCursor,
    enabled: !!userId && enabled,
  });
};

export const usePendingFollowRequests = () => {
  return useQuery({
    queryKey: socialKeys.requests(),
    queryFn: socialService.getPendingFollowRequests,
  });
};

export const useBlockedUsers = () => {
  return useQuery({
    queryKey: socialKeys.blocked(),
    // Wrapped rather than passed by reference: TanStack calls queryFn with a
    // context object, which would otherwise be received as the cursor.
    queryFn: ({ signal }) => socialService.getBlockedUsers(undefined, undefined, signal),
  });
};

// --- Mutations ---

export const useFollow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => socialService.followUser(targetUserId),
    onMutate: (targetUserId) => {
      const restore = patchCachedAuthorRelationship(queryClient, targetUserId, {
        isFollowing: true,
        isFollowedByViewer: true,
        isFollowRequested: false,
      });
      return { restore };
    },
    onSuccess: () => {
      // Refresh profile data, user posts, following lists
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: socialKeys.following() });
      queryClient.invalidateQueries({ queryKey: socialKeys.followers() });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.resetQueries({ queryKey: ['feed'] });
      queryClient.resetQueries({ queryKey: ['recommendedFeed'] });
      queryClient.resetQueries({ queryKey: ['explore'] });
      queryClient.resetQueries({ queryKey: ['userPosts'] });
    },
    onError: (_error, _variables, context) => {
      context?.restore?.();
    },
  });
};

export const useUnfollow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => socialService.unfollowUser(targetUserId),
    onMutate: (targetUserId) => {
      const restore = patchCachedAuthorRelationship(queryClient, targetUserId, {
        isFollowing: false,
        isFollowedByViewer: false,
        isFollowRequested: false,
      });
      return { restore };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: socialKeys.following() });
      queryClient.invalidateQueries({ queryKey: socialKeys.followers() });
      queryClient.invalidateQueries({ queryKey: ['post'] });
      queryClient.resetQueries({ queryKey: ['feed'] });
      queryClient.resetQueries({ queryKey: ['recommendedFeed'] });
      queryClient.resetQueries({ queryKey: ['explore'] });
      queryClient.resetQueries({ queryKey: ['userPosts'] });
    },
    onError: (err, _variables, context) => {
      context?.restore?.();
      if (import.meta.env.DEV) {
        console.error('[useUnfollow]', err);
      }
    },
  });
};

// The blocked list is server state. It is read back from GET /social/blocked
// rather than mirrored into client storage, so a rejected mutation must reach
// the caller instead of being reported as a success.
/**
 * Drops every cache that can still show a blocked account.
 *
 * Shared by the profile block action and the message request block action, which reach the same
 * server-side block through different endpoints.
 */
export const invalidateAfterBlock = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: socialKeys.blocked() });
  queryClient.invalidateQueries({ queryKey: ['users'] });
  queryClient.invalidateQueries({ queryKey: socialKeys.following() });
  queryClient.invalidateQueries({ queryKey: socialKeys.followers() });
  queryClient.invalidateQueries({ queryKey: ['post'] });
  refreshAccountSurfaces(queryClient);
  queryClient.resetQueries({ queryKey: ['feed'] });
  queryClient.resetQueries({ queryKey: ['recommendedFeed'] });
  queryClient.resetQueries({ queryKey: ['explore'] });
  queryClient.resetQueries({ queryKey: ['userPosts'] });
};

export const useBlock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => socialService.blockUser(targetUserId),
    onSuccess: () => invalidateAfterBlock(queryClient),
  });
};

export const useUnblock = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => socialService.unblockUser(targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.blocked() });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      refreshAccountSurfaces(queryClient);
    },
  });
};

export const useApproveFollowRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requesterId: string) => socialService.approveFollowRequest(requesterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.requests() });
      queryClient.invalidateQueries({ queryKey: socialKeys.followers() });
      queryClient.invalidateQueries({ queryKey: notifKeys.all });
    },
  });
};

export const useRejectFollowRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requesterId: string) => socialService.rejectFollowRequest(requesterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.requests() });
      queryClient.invalidateQueries({ queryKey: notifKeys.all });
    },
  });
};
