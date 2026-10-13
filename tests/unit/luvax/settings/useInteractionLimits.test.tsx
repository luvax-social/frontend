import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import {
  useClearInteractionLimit,
  useMyInteractionLimit,
  useSetInteractionLimit,
} from '@/features/luvax/hooks/useInteractionLimits';
import * as userService from '@/services/user.service';
import type { ApiResponse } from '@/types/api';
import type { InteractionLimitResponse, UpdateInteractionLimitRequest } from '@/types/domain';

import { apiError, envelope } from './settingsFixtures';
import { limitFixture } from './safetyFixtures';

vi.mock('@/services/user.service');

const service = vi.mocked(userService);
const KEY = ['users', 'me', 'interactionLimits'];

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

const cached = (queryClient: QueryClient) =>
  queryClient.getQueryData<ApiResponse<InteractionLimitResponse>>(KEY)?.data;

const active = limitFixture({
  limitNonFollowers: true,
  expiresAt: '2026-10-17T14:40:00Z',
  active: true,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useMyInteractionLimit', () => {
  it('exposes the unwrapped limit under the users/me/interactionLimits key', async () => {
    service.getMyInteractionLimit.mockResolvedValue(envelope(active));
    const { queryClient, wrapper } = setup();

    const { result } = renderHook(() => useMyInteractionLimit(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.expiresAt).toBe('2026-10-17T14:40:00Z');
    expect(cached(queryClient)?.active).toBe(true);
  });
});

describe('useSetInteractionLimit', () => {
  it('leaves the cache alone until the server answers with its own end time', async () => {
    service.getMyInteractionLimit.mockResolvedValue(envelope(limitFixture()));
    let finish: (value: ApiResponse<InteractionLimitResponse>) => void = () => {};
    service.setMyInteractionLimit.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { queryClient, wrapper } = setup();
    const query = renderHook(() => useMyInteractionLimit(), { wrapper });
    await waitFor(() => expect(query.result.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useSetInteractionLimit(), { wrapper });
    const request: UpdateInteractionLimitRequest = {
      limitNonFollowers: true,
      limitRecentFollowers: false,
      durationDays: 7,
    };
    act(() => {
      result.current.mutate(request);
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));

    expect(cached(queryClient)?.active).toBe(false);
    expect(service.setMyInteractionLimit).toHaveBeenCalledWith(request);

    await act(async () => {
      finish(envelope(active));
    });
    await waitFor(() => expect(cached(queryClient)).toEqual(active));
  });

  it('keeps the previous limit when the server refuses', async () => {
    service.getMyInteractionLimit.mockResolvedValue(envelope(limitFixture()));
    service.setMyInteractionLimit.mockRejectedValue(apiError('VALIDATION_ERROR', 400));
    const { queryClient, wrapper } = setup();
    const query = renderHook(() => useMyInteractionLimit(), { wrapper });
    await waitFor(() => expect(query.result.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useSetInteractionLimit(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ limitNonFollowers: false, limitRecentFollowers: false, durationDays: 7 })
        .catch(() => undefined);
    });

    expect(cached(queryClient)?.active).toBe(false);
  });
});

describe('useClearInteractionLimit', () => {
  it('refetches the limit after the server confirms it is off', async () => {
    service.getMyInteractionLimit
      .mockResolvedValueOnce(envelope(active))
      .mockResolvedValue(envelope(limitFixture()));
    service.clearMyInteractionLimit.mockResolvedValue(undefined);
    const { queryClient, wrapper } = setup();
    const query = renderHook(() => useMyInteractionLimit(), { wrapper });
    await waitFor(() => expect(query.result.current.data?.active).toBe(true));

    const { result } = renderHook(() => useClearInteractionLimit(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(cached(queryClient)?.active).toBe(false));
    expect(service.clearMyInteractionLimit).toHaveBeenCalledTimes(1);
  });
});
