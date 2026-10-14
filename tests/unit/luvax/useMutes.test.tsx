import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useMuteState, useMutes, useSetMute, useUnmute } from '@/features/luvax/hooks/useMutes';
import * as safetyService from '@/services/safety.service';
import * as userService from '@/services/user.service';
import type { ApiResponse, CursorPage } from '@/types/api';
import type { MuteResponse, PublicUserProfileResponse } from '@/types/domain';
import { profileFixture } from '../../fixtures/domain';
import { apiError, envelope } from './settings/settingsFixtures';
import { muteFixture, mutePage } from './settings/safetyFixtures';

vi.mock('@/services/safety.service');
vi.mock('@/services/user.service');

const safety = vi.mocked(safetyService);
const users = vi.mocked(userService);

const PROFILE_KEY = ['users', 'profile', 'u1'];
const MUTES_KEY = ['social', 'mutes'];

const profileWith = (mutePosts: boolean, muteStories: boolean) =>
  envelope(
    profileFixture({
      id: 'u1',
      username: 'an.pham',
      viewerState: {
        isFollowing: false,
        isFollowRequested: false,
        isFollowedBy: false,
        isBlocking: false,
        hasReported: false,
        isMutingPosts: mutePosts,
        isMutingStories: muteStories,
        isShowingFewer: false,
      },
    })
  );

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, invalidate, wrapper };
};

const seed = (
  queryClient: QueryClient,
  { profile, rows }: { profile?: [boolean, boolean]; rows?: MuteResponse[] } = {}
) => {
  if (profile) queryClient.setQueryData(PROFILE_KEY, profileWith(profile[0], profile[1]));
  if (rows) {
    queryClient.setQueryData(MUTES_KEY, {
      pages: [mutePage(rows)],
      pageParams: [null],
    });
  }
};

const cachedProfile = (queryClient: QueryClient) =>
  queryClient.getQueryData<ApiResponse<PublicUserProfileResponse>>(PROFILE_KEY)?.data.viewerState;

const cachedRows = (queryClient: QueryClient) =>
  queryClient
    .getQueryData<{ pages: ApiResponse<CursorPage<MuteResponse>>[] }>(MUTES_KEY)
    ?.pages.flatMap((page) => page.data.content) ?? [];

const keysOf = (invalidate: ReturnType<typeof setup>['invalidate']) =>
  invalidate.mock.calls.map(([filter]) => JSON.stringify(filter?.queryKey));

const WAS_NONE = { mutePosts: false, muteStories: false };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useMutes', () => {
  it('pages the muted accounts under the social mutes key', async () => {
    safety.getMutes.mockResolvedValueOnce(
      mutePage([muteFixture('u1', 'an.pham', true, false)], 'c1')
    );
    safety.getMutes.mockResolvedValueOnce(mutePage([muteFixture('u2', 'quang.do', true, true)]));
    const { queryClient, wrapper } = setup();

    const { result } = renderHook(() => useMutes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(safety.getMutes).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: null, limit: 20 })
    );
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(safety.getMutes).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'c1', limit: 20 })
    );
    expect(queryClient.getQueryState(MUTES_KEY)?.status).toBe('success');
    expect(cachedRows(queryClient).map((row) => row.userId)).toEqual(['u1', 'u2']);
  });
});

describe('useMuteState', () => {
  it('reports loading, then the mute state read from the profile', async () => {
    users.getUserProfile.mockResolvedValue(profileWith(true, false));
    const { wrapper } = setup();

    const { result } = renderHook(() => useMuteState('u1'), { wrapper });

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ mutePosts: true, muteStories: false });
  });

  it('fetches again on mount even when a profile is already cached', async () => {
    users.getUserProfile.mockResolvedValue(profileWith(true, true));
    const { queryClient, wrapper } = setup();
    seed(queryClient, { profile: [false, false] });

    const { result } = renderHook(() => useMuteState('u1'), { wrapper });

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(users.getUserProfile).toHaveBeenCalledWith('u1');
    expect(result.current.mutePosts).toBe(true);
  });

  it('reports an error when the profile cannot be read', async () => {
    users.getUserProfile.mockRejectedValue(apiError('USER_NOT_FOUND', 404));
    const { wrapper } = setup();

    const { result } = renderHook(() => useMuteState('u1'), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});

describe('useSetMute', () => {
  const request = (mutePosts: boolean, muteStories: boolean, was = WAS_NONE) => ({
    userId: 'u1',
    mutePosts,
    muteStories,
    was,
  });

  it('puts absolute values and patches the profile and the list before the answer', async () => {
    let finish: (value: ApiResponse<MuteResponse>) => void = () => {};
    safety.setMute.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { queryClient, wrapper } = setup();
    seed(queryClient, {
      profile: [false, true],
      rows: [muteFixture('u1', 'an.pham', false, true)],
    });
    const { result } = renderHook(() => useSetMute(), { wrapper });

    act(() => {
      result.current.mutate(request(true, true, { mutePosts: false, muteStories: true }));
    });

    await waitFor(() => expect(cachedProfile(queryClient)?.isMutingPosts).toBe(true));
    expect(cachedProfile(queryClient)?.isMutingStories).toBe(true);
    expect(cachedRows(queryClient)[0]).toMatchObject({ mutePosts: true, muteStories: true });
    expect(safety.setMute).toHaveBeenCalledWith('u1', { mutePosts: true, muteStories: true });

    await act(async () => finish(envelope(muteFixture('u1', 'an.pham', true, true))));
  });

  it('drops the row from the list when both toggles are off', async () => {
    safety.setMute.mockResolvedValue(envelope(muteFixture('u1', 'an.pham', false, false)));
    const { queryClient, wrapper } = setup();
    seed(queryClient, {
      profile: [true, false],
      rows: [muteFixture('u1', 'an.pham', true, false), muteFixture('u2', 'quang.do', true, true)],
    });
    const { result } = renderHook(() => useSetMute(), { wrapper });

    act(() => {
      result.current.mutate(request(false, false, { mutePosts: true, muteStories: false }));
    });

    await waitFor(() => expect(cachedRows(queryClient).map((row) => row.userId)).toEqual(['u2']));
    expect(cachedProfile(queryClient)).toMatchObject({
      isMutingPosts: false,
      isMutingStories: false,
    });
  });

  it('restores the snapshots taken before the change when the request fails', async () => {
    safety.setMute.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));
    const onError = vi.fn();
    const { queryClient, wrapper } = setup();
    seed(queryClient, {
      profile: [true, false],
      rows: [muteFixture('u1', 'an.pham', true, false)],
    });
    const { result } = renderHook(() => useSetMute({ onError }), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync(request(false, false, { mutePosts: true, muteStories: false }))
        .catch(() => undefined);
    });

    expect(cachedProfile(queryClient)?.isMutingPosts).toBe(true);
    expect(cachedRows(queryClient)).toHaveLength(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('refreshes the feed, both recommendation lists, the profile and the list for a posts change', async () => {
    safety.setMute.mockResolvedValue(envelope(muteFixture('u1', 'an.pham', true, false)));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSetMute(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(request(true, false));
    });

    const keys = keysOf(invalidate);
    expect(keys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['feed']),
        JSON.stringify(['recommendedFeed', false]),
        JSON.stringify(['recommendedFeed', true]),
        JSON.stringify(PROFILE_KEY),
        JSON.stringify(MUTES_KEY),
      ])
    );
    expect(keys).not.toContain(JSON.stringify(['storyFeed']));
  });

  it('refreshes the story tray, the profile and the list for a stories change', async () => {
    safety.setMute.mockResolvedValue(envelope(muteFixture('u1', 'an.pham', false, true)));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSetMute(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(request(false, true));
    });

    const keys = keysOf(invalidate);
    expect(keys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['storyFeed']),
        JSON.stringify(PROFILE_KEY),
        JSON.stringify(MUTES_KEY),
      ])
    );
    expect(keys).not.toContain(JSON.stringify(['feed']));
    expect(keys).not.toContain(JSON.stringify(['recommendedFeed', false]));
  });

  it('leaves search and hashtag caches alone, because muting does not affect them', async () => {
    safety.setMute.mockResolvedValue(envelope(muteFixture('u1', 'an.pham', true, true)));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSetMute(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(request(true, true));
    });

    const keys = keysOf(invalidate).join(' ');
    expect(keys).not.toContain('search');
    expect(keys).not.toContain('hashtag');
    expect(keys).not.toContain('suggestions');
  });

  it('sends two quick changes one after the other, in the order they were made', async () => {
    const calls: { body: { mutePosts: boolean; muteStories: boolean }; accept: () => void }[] = [];
    safety.setMute.mockImplementation(
      (_userId, body) =>
        new Promise((resolve) =>
          calls.push({
            body,
            accept: () =>
              resolve(envelope(muteFixture('u1', 'an.pham', body.mutePosts, body.muteStories))),
          })
        )
    );
    const { queryClient, wrapper } = setup();
    seed(queryClient, { profile: [false, false] });
    const { result } = renderHook(() => useSetMute(), { wrapper });

    act(() => {
      result.current.mutate(request(true, false));
      result.current.mutate(request(true, true, { mutePosts: true, muteStories: false }));
    });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body).toEqual({ mutePosts: true, muteStories: false });
    await act(async () => calls[0]?.accept());
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]?.body).toEqual({ mutePosts: true, muteStories: true });
    await act(async () => calls[1]?.accept());
  });

  it('reconciles with the server only once the last change for the account has settled', async () => {
    const calls: { accept: () => void; refuse: () => void }[] = [];
    safety.setMute.mockImplementation(
      (_userId, body) =>
        new Promise((resolve, reject) =>
          calls.push({
            accept: () =>
              resolve(envelope(muteFixture('u1', 'an.pham', body.mutePosts, body.muteStories))),
            refuse: () => reject(apiError('INTERNAL_SERVER_ERROR', 500)),
          })
        )
    );
    const { queryClient, invalidate, wrapper } = setup();
    seed(queryClient, { profile: [false, false] });
    const { result } = renderHook(() => useSetMute(), { wrapper });
    const profileInvalidations = () =>
      keysOf(invalidate).filter((key) => key === JSON.stringify(PROFILE_KEY)).length;

    act(() => {
      result.current.mutate(request(true, false));
      result.current.mutate(request(true, true, { mutePosts: true, muteStories: false }));
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => calls[0]?.refuse());
    await waitFor(() => expect(calls).toHaveLength(2));

    expect(profileInvalidations()).toBe(0);

    await act(async () => calls[1]?.accept());

    await waitFor(() => expect(profileInvalidations()).toBeGreaterThan(0));
  });
});

describe('useUnmute', () => {
  it('deletes the mute, removes the row and clears both flags at once', async () => {
    safety.unmute.mockResolvedValue(undefined);
    const { queryClient, invalidate, wrapper } = setup();
    seed(queryClient, {
      profile: [true, true],
      rows: [muteFixture('u1', 'an.pham', true, true), muteFixture('u2', 'quang.do', true, false)],
    });
    const { result } = renderHook(() => useUnmute(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        userId: 'u1',
        was: { mutePosts: true, muteStories: true },
      });
    });

    expect(safety.unmute).toHaveBeenCalledWith('u1');
    expect(cachedRows(queryClient).map((row) => row.userId)).toEqual(['u2']);
    expect(cachedProfile(queryClient)).toMatchObject({
      isMutingPosts: false,
      isMutingStories: false,
    });
    expect(keysOf(invalidate)).toEqual(
      expect.arrayContaining([
        JSON.stringify(['feed']),
        JSON.stringify(['storyFeed']),
        JSON.stringify(PROFILE_KEY),
        JSON.stringify(MUTES_KEY),
      ])
    );
  });

  it('restores the snapshot when the delete fails', async () => {
    safety.unmute.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));
    const { queryClient, wrapper } = setup();
    seed(queryClient, {
      profile: [true, false],
      rows: [muteFixture('u1', 'an.pham', true, false)],
    });
    const { result } = renderHook(() => useUnmute(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ userId: 'u1', was: { mutePosts: true, muteStories: false } })
        .catch(() => undefined);
    });

    expect(cachedRows(queryClient)).toHaveLength(1);
    expect(cachedProfile(queryClient)?.isMutingPosts).toBe(true);
  });
});
