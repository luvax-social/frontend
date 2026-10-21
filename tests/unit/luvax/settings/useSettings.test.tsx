import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useMySettings, useUpdateMySettings } from '@/features/luvax/hooks/useSettings';
import * as userService from '@/services/user.service';
import type { ApiResponse } from '@/types/api';
import type { UpdateSettingsRequest, UserSettingsResponse } from '@/types/domain';

import { apiError, envelope, settingsFixture } from './settingsFixtures';

vi.mock('@/services/user.service');

const service = vi.mocked(userService);

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
  queryClient.getQueryData<ApiResponse<UserSettingsResponse>>(['users', 'me', 'settings'])?.data;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useMySettings', () => {
  it('reads the settings record under the users/me/settings key', async () => {
    service.getMySettings.mockResolvedValue(envelope(settingsFixture()));
    const { queryClient, wrapper } = setup();

    const { result } = renderHook(() => useMySettings(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(cached(queryClient)?.messagePermission).toBe('everyone');
  });
});

describe('useUpdateMySettings', () => {
  it('patches the cached record before the request settles', async () => {
    service.getMySettings.mockResolvedValue(envelope(settingsFixture()));
    let finish: (value: ApiResponse<UserSettingsResponse>) => void = () => {};
    service.updateMySettings.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { queryClient, wrapper } = setup();
    const query = renderHook(() => useMySettings(), { wrapper });
    await waitFor(() => expect(query.result.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useUpdateMySettings(), { wrapper });
    act(() => {
      result.current.mutate({ messagePermission: 'nobody' });
    });

    await waitFor(() => expect(cached(queryClient)?.messagePermission).toBe('nobody'));
    expect(service.updateMySettings).toHaveBeenCalledWith({ messagePermission: 'nobody' });

    await act(async () => {
      finish(envelope(settingsFixture({ messagePermission: 'nobody' })));
    });
  });

  it('restores the onMutate snapshot when the request fails', async () => {
    service.getMySettings.mockResolvedValue(envelope(settingsFixture()));
    service.updateMySettings.mockRejectedValue(apiError('MALFORMED_REQUEST_BODY', 400));
    const { queryClient, wrapper } = setup();
    const query = renderHook(() => useMySettings(), { wrapper });
    await waitFor(() => expect(query.result.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useUpdateMySettings(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ messagePermission: 'following', hiddenWordsSystemEnabled: false })
        .catch(() => undefined);
    });

    expect(cached(queryClient)?.messagePermission).toBe('everyone');
    expect(cached(queryClient)?.hiddenWordsSystemEnabled).toBe(true);
  });
});

describe('useUpdateMySettings with rapid changes', () => {
  // A server whose PATCH answers are released by hand, so the test controls the order in which
  // requests settle. `stored` is what GET returns once a PATCH has been accepted.
  const fakeServer = () => {
    let stored = settingsFixture();
    const calls: {
      patch: UpdateSettingsRequest;
      accept: () => void;
      refuse: () => void;
    }[] = [];
    service.getMySettings.mockImplementation(async () => envelope({ ...stored }));
    service.updateMySettings.mockImplementation(
      (patch) =>
        new Promise((resolve, reject) => {
          calls.push({
            patch,
            accept: () => {
              const { messagePermission } = patch;
              if (messagePermission) stored = { ...stored, messagePermission };
              resolve(envelope({ ...stored }));
            },
            refuse: () => reject(apiError('INTERNAL_SERVER_ERROR', 500)),
          });
        })
    );
    return { calls };
  };

  const mount = async () => {
    const context = setup();
    const query = renderHook(() => useMySettings().data?.data.messagePermission, {
      wrapper: context.wrapper,
    });
    await waitFor(() => expect(query.result.current).toBe('everyone'));
    const onError = vi.fn();
    const update = renderHook(() => useUpdateMySettings({ onError }), {
      wrapper: context.wrapper,
    });
    return { ...context, query, update, onError };
  };

  it('sends two quick changes one after the other, in the order they were made', async () => {
    const { calls } = fakeServer();
    const { query, update } = await mount();

    act(() => {
      update.result.current.mutate({ messagePermission: 'following' });
      update.result.current.mutate({ messagePermission: 'nobody' });
    });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].patch).toEqual({ messagePermission: 'following' });
    expect(query.result.current).toBe('nobody');

    await act(async () => calls[0].accept());
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].patch).toEqual({ messagePermission: 'nobody' });

    await act(async () => calls[1].accept());
    await waitFor(() => expect(query.result.current).toBe('nobody'));
  });

  it('ends on the server value and reports the failure when the first change fails and the second lands', async () => {
    const { calls } = fakeServer();
    const { query, update, onError } = await mount();

    act(() => {
      update.result.current.mutate({ messagePermission: 'following' });
      update.result.current.mutate({ messagePermission: 'nobody' });
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => calls[0].refuse());
    await waitFor(() => expect(calls).toHaveLength(2));
    await act(async () => calls[1].accept());

    await waitFor(() => expect(query.result.current).toBe('nobody'));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('ends on the server value and reports both failures when both changes fail', async () => {
    const { calls } = fakeServer();
    const { query, update, onError } = await mount();

    act(() => {
      update.result.current.mutate({ messagePermission: 'following' });
      update.result.current.mutate({ messagePermission: 'nobody' });
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => calls[0].refuse());
    await waitFor(() => expect(calls).toHaveLength(2));
    await act(async () => calls[1].refuse());

    await waitFor(() => expect(query.result.current).toBe('everyone'));
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('refetches once, after the last change in flight settles', async () => {
    const { calls } = fakeServer();
    const { update } = await mount();
    const fetchesBefore = service.getMySettings.mock.calls.length;

    act(() => {
      update.result.current.mutate({ messagePermission: 'following' });
      update.result.current.mutate({ messagePermission: 'nobody' });
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => calls[0].accept());
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(service.getMySettings.mock.calls.length).toBe(fetchesBefore);

    await act(async () => calls[1].accept());
    await waitFor(() => expect(service.getMySettings.mock.calls.length).toBe(fetchesBefore + 1));
  });
});
