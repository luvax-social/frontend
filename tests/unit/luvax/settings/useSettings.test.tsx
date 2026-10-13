import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useMySettings, useUpdateMySettings } from '@/features/luvax/hooks/useSettings';
import * as userService from '@/services/user.service';
import type { ApiResponse } from '@/types/api';
import type { UserSettingsResponse } from '@/types/domain';

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
