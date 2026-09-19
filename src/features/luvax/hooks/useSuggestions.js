import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as suggestionService from '@/services/suggestion.service';
import * as socialService from '@/services/social.service';

export const suggestionKeys = {
  all: ['suggestions'],
  list: (limit) => [...suggestionKeys.all, 'list', limit],
};

/**
 * Flattens the API envelope into the shape LxSuggestedList was already built for.
 *
 * The component predates the endpoint and takes a flat row; the API answers the shared
 * `UserListItemResponse` envelope of an identity summary plus the viewer's relationship. Adapting
 * the response here is deliberate: the component's shape is the one the rail renders, and bending
 * a working component to a wire format is the wrong way round.
 */
export const toRow = (item) => {
  const user = item?.user ?? {};
  const state = item?.viewerState ?? {};
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatarUrl: user.avatarUrl,
    verified: Boolean(user.isVerified),
    verifiedCategory: user.verifiedCategory ?? null,
    // Not on the shared UserSummaryResponse: the suggestions endpoint carries them beside it, so
    // they sit on the item rather than on item.user.
    bannerUrl: item?.bannerUrl ?? null,
    followerCount: item?.followerCount ?? 0,
    // A pending request to a private account is not a follow, and must not render as one.
    isFollowing: Boolean(state.isFollowing),
    isFollowRequested: Boolean(state.isFollowRequested),
  };
};

export const useSuggestions = (limit = 5, enabled = true) => {
  return useQuery({
    queryKey: suggestionKeys.list(limit),
    queryFn: ({ signal }) => suggestionService.getSuggestions(limit, signal),
    enabled,
    select: (payload) => (payload?.data ?? []).map(toRow),
  });
};

const patchRow = (queryClient, userId, patch) => {
  const snapshots = [];
  queryClient.getQueriesData({ queryKey: suggestionKeys.all }).forEach(([key, previous]) => {
    if (!previous?.data) return;
    snapshots.push([key, previous]);
    queryClient.setQueryData(key, {
      ...previous,
      data: previous.data.map((item) =>
        item?.user?.id === userId
          ? { ...item, viewerState: { ...(item.viewerState ?? {}), ...patch } }
          : item
      ),
    });
  });
  return () => snapshots.forEach(([key, previous]) => queryClient.setQueryData(key, previous));
};

const removeRow = (queryClient, userId) => {
  const snapshots = [];
  queryClient.getQueriesData({ queryKey: suggestionKeys.all }).forEach(([key, previous]) => {
    if (!previous?.data) return;
    snapshots.push([key, previous]);
    queryClient.setQueryData(key, {
      ...previous,
      data: previous.data.filter((item) => item?.user?.id !== userId),
    });
  });
  return () => snapshots.forEach(([key, previous]) => queryClient.setQueryData(key, previous));
};

/**
 * Follows from the rail, optimistically.
 *
 * The optimistic patch is deliberately not "followed". The server decides which of the two
 * outcomes a follow produces, because only it knows whether the target is private, so the row is
 * marked pending until the response says otherwise. Showing "following" and correcting it a moment
 * later would state something untrue about somebody else's account.
 */
export const useFollowSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => socialService.followUser(userId),
    onMutate: (userId) => ({ restore: patchRow(queryClient, userId, { isFollowRequested: true }) }),
    onSuccess: (response, userId) => {
      const status = response?.data?.status ?? response?.data;
      const accepted = status === 'accepted' || status === 'ACCEPTED';
      patchRow(queryClient, userId, {
        isFollowing: accepted,
        isFollowRequested: !accepted,
      });
      queryClient.invalidateQueries({ queryKey: ['social'] });
    },
    onError: (_error, _userId, context) => {
      context?.restore?.();
    },
  });
};

/**
 * Dismisses a suggestion.
 *
 * The row is removed immediately and the list is not refetched afterwards. A refetch would be
 * correct, but the server has already stopped offering the account, so it would only cost a
 * request to redraw the same list; the removal is permanent, so there is nothing to reconcile.
 */
export const useDismissSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => suggestionService.dismissSuggestion(userId),
    onMutate: (userId) => ({ restore: removeRow(queryClient, userId) }),
    onError: (_error, _userId, context) => {
      context?.restore?.();
    },
  });
};
