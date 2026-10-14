import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as safetyService from '@/services/safety.service';
import * as userService from '@/services/user.service';
import type { ApiResponse, CursorPage } from '@/types/api';
import type { MuteResponse, PublicUserProfileResponse } from '@/types/domain';
import { getNextCursor } from '@/utils/helpers';
import { unwrapApiResponse } from '@/utils/unwrapApiResponse';

import { socialKeys } from './useSocial';
import { userKeys } from './useUsers';

type MutesCache = InfiniteData<ApiResponse<CursorPage<MuteResponse>>>;
type ProfileCache = ApiResponse<PublicUserProfileResponse>;

/** What is muted about one account. Both false means the account is not muted. */
export interface MuteFlags {
  mutePosts: boolean;
  muteStories: boolean;
}

/** A change to one account's mute: the new absolute values, and the values they replace. */
export interface SetMuteVariables extends MuteFlags {
  userId: string;
  was: MuteFlags;
}

interface Options {
  onError?: (error: unknown) => void;
}

interface Snapshots {
  previousProfile?: ProfileCache;
  previousMutes?: MutesCache;
}

const mutesKey = [...socialKeys.all, 'mutes'];
// Both mutation keys start with the list key, so one prefix counts every mute write in flight.
const muteWritesKey = [...mutesKey, 'write'];
const NOT_MUTED: MuteFlags = { mutePosts: false, muteStories: false };
const RECOMMENDED_KEYS = [
  ['recommendedFeed', false],
  ['recommendedFeed', true],
];
const PAGE_SIZE = 20;

/**
 * The accounts the viewer has muted, newest change first, paged on the server's cursor.
 *
 * Query key `['social', 'mutes']`. The cache holds the response envelopes as the infinite query's
 * pages. `useSetMute` and `useUnmute` edit it in place and invalidate it once their changes have
 * settled.
 */
export const useMutes = () =>
  useInfiniteQuery({
    queryKey: mutesKey,
    queryFn: ({ pageParam, signal }: { pageParam: string | null; signal: AbortSignal }) =>
      safetyService.getMutes({ cursor: pageParam, limit: PAGE_SIZE, signal }),
    getNextPageParam: getNextCursor,
    initialPageParam: null as string | null,
  });

/**
 * The viewer's current mute of one account, read from that account's profile.
 *
 * Reads `['users', 'profile', id]`, whose `viewerState` carries `isMutingPosts` and
 * `isMutingStories`, and always fetches on mount so a dialog never shows a value from an earlier
 * visit. `status` is `loading` until that fetch has answered, then `ready` or `error`; the flags
 * are false until `ready`, and a caller must not act on them before.
 */
export const useMuteState = (userId: string | null | undefined) => {
  const query = useQuery({
    queryKey: userKeys.profile(userId),
    queryFn: () => userService.getUserProfile(userId!),
    enabled: Boolean(userId),
    refetchOnMount: 'always',
  });
  const state = query.data
    ? unwrapApiResponse<PublicUserProfileResponse>(query.data).viewerState
    : undefined;
  const status = !query.isFetchedAfterMount
    ? 'loading'
    : query.isError || !state
      ? 'error'
      : 'ready';
  return {
    status,
    mutePosts: Boolean(state?.isMutingPosts),
    muteStories: Boolean(state?.isMutingStories),
  } as const;
};

const withFlags = (cache: ProfileCache | undefined, flags: MuteFlags) =>
  cache?.data?.viewerState
    ? {
        ...cache,
        data: {
          ...cache.data,
          viewerState: {
            ...cache.data.viewerState,
            isMutingPosts: flags.mutePosts,
            isMutingStories: flags.muteStories,
          },
        },
      }
    : cache;

const withRowChanged = (cache: MutesCache | undefined, userId: string, flags: MuteFlags) => {
  if (!cache) return cache;
  const keep = flags.mutePosts || flags.muteStories;
  return {
    ...cache,
    pages: cache.pages.map((envelope) =>
      envelope?.data
        ? {
            ...envelope,
            data: {
              ...envelope.data,
              content: envelope.data.content.flatMap((row) =>
                row.userId !== userId ? [row] : keep ? [{ ...row, ...flags }] : []
              ),
            },
          }
        : envelope
    ),
  };
};

// Applies a mute change to every cache that shows it and returns the snapshots a failure restores.
const applyOptimistically = async (
  queryClient: QueryClient,
  userId: string,
  flags: MuteFlags
): Promise<Snapshots> => {
  const profileKey = userKeys.profile(userId);
  await Promise.all([
    queryClient.cancelQueries({ queryKey: profileKey }),
    queryClient.cancelQueries({ queryKey: mutesKey }),
  ]);
  const previousProfile = queryClient.getQueryData<ProfileCache>(profileKey);
  const previousMutes = queryClient.getQueryData<MutesCache>(mutesKey);
  queryClient.setQueryData<ProfileCache>(profileKey, (cache) => withFlags(cache, flags));
  queryClient.setQueryData<MutesCache>(mutesKey, (cache) => withRowChanged(cache, userId, flags));
  return { previousProfile, previousMutes };
};

const restore = (queryClient: QueryClient, userId: string, snapshots?: Snapshots) => {
  if (snapshots?.previousProfile) {
    queryClient.setQueryData(userKeys.profile(userId), snapshots.previousProfile);
  }
  if (snapshots?.previousMutes) queryClient.setQueryData(mutesKey, snapshots.previousMutes);
};

// Refreshes the surfaces whose content depends on what changed. Search and hashtag caches are
// deliberately left alone: muting hides an account from the feeds and the story tray, and the
// search and hashtag surfaces still show it.
const refreshAffectedSurfaces = (queryClient: QueryClient, was: MuteFlags, now: MuteFlags) => {
  if (was.mutePosts !== now.mutePosts) {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    RECOMMENDED_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  }
  if (was.muteStories !== now.muteStories) {
    queryClient.invalidateQueries({ queryKey: ['storyFeed'] });
  }
};

// The last change to settle brings the caches back to what the server holds. Until then a
// rollback may have restored a value that a change still in flight had set. The settling mutation
// still counts as in flight here, so one means it is the last.
const reconcileWithServer = (queryClient: QueryClient, userId: string) => {
  const forAccount = queryClient.isMutating({
    mutationKey: muteWritesKey,
    predicate: (mutation) => (mutation.state.variables as { userId?: string })?.userId === userId,
  });
  if (forAccount === 1) {
    queryClient.invalidateQueries({ queryKey: userKeys.profile(userId) });
  }
  if (queryClient.isMutating({ mutationKey: muteWritesKey }) === 1) {
    queryClient.invalidateQueries({ queryKey: mutesKey });
  }
};

/**
 * Saves what the viewer mutes about one account with `PUT /social/mutes/{userId}`.
 *
 * Callers pass absolute values for both flags plus `was`, the values on screen before the change,
 * so the hook knows whether posts, stories or both changed. Optimistic: the profile's
 * `viewerState` and the muted list change at once, and a change that leaves both flags off removes
 * the list row. On failure both caches roll back to the snapshots taken in `onMutate`, and
 * `options.onError` runs for every failed change. All mute writes share one mutation scope, so
 * quick toggles are sent one at a time in the order they were made, and the profile and the list
 * are invalidated once the last change for them has settled. On success a posts change refreshes
 * `['feed']` and both `['recommendedFeed', excludeFollowed]` lists, and a stories change refreshes
 * `['storyFeed']`, the only cache that holds stories.
 */
export const useSetMute = (options: Options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...muteWritesKey, 'set'],
    scope: { id: 'social-mutes' },
    mutationFn: ({ userId, mutePosts, muteStories }: SetMuteVariables) =>
      safetyService.setMute(userId, { mutePosts, muteStories }),
    onMutate: ({ userId, mutePosts, muteStories }) =>
      applyOptimistically(queryClient, userId, { mutePosts, muteStories }),
    onError: (error, { userId }, context) => {
      restore(queryClient, userId, context);
      options.onError?.(error);
    },
    onSuccess: (_response, { mutePosts, muteStories, was }) =>
      refreshAffectedSurfaces(queryClient, was, { mutePosts, muteStories }),
    onSettled: (_response, _error, { userId }) => reconcileWithServer(queryClient, userId),
  });
};

/**
 * Removes a mute outright with `DELETE /social/mutes/{userId}`.
 *
 * Optimistic and rolled back like `useSetMute`: the list row leaves and the profile's flags clear
 * at once, and a failure restores the snapshots taken in `onMutate`. It shares the mute mutation
 * scope and refreshes the same surfaces, for whichever of posts and stories `was` shows muted.
 */
export const useUnmute = (options: Options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: [...muteWritesKey, 'unmute'],
    scope: { id: 'social-mutes' },
    mutationFn: ({ userId }: { userId: string; was: MuteFlags }) => safetyService.unmute(userId),
    onMutate: ({ userId }) => applyOptimistically(queryClient, userId, NOT_MUTED),
    onError: (error, { userId }, context) => {
      restore(queryClient, userId, context);
      options.onError?.(error);
    },
    onSuccess: (_response, { was }) => refreshAffectedSurfaces(queryClient, was, NOT_MUTED),
    onSettled: (_response, _error, { userId }) => reconcileWithServer(queryClient, userId),
  });
};
