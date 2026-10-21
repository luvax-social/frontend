import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import {
  isPendingHiddenWord,
  useAddHiddenWord,
  useMyHiddenWords,
  useRemoveHiddenWord,
} from '@/features/luvax/hooks/useHiddenWords';
import * as userService from '@/services/user.service';
import type { ApiResponse } from '@/types/api';
import type { HiddenWordEntryResponse, HiddenWordListResponse } from '@/types/domain';

import { apiError, envelope } from './settingsFixtures';
import { hiddenWordEntry, hiddenWordList } from './safetyFixtures';

vi.mock('@/services/user.service');

const service = vi.mocked(userService);
const KEY = ['users', 'me', 'hiddenWords'];

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

const phrasesInCache = (queryClient: QueryClient) =>
  queryClient
    .getQueryData<ApiResponse<HiddenWordListResponse>>(KEY)
    ?.data.entries.map((entry) => entry.phrase);

const load = async (phrases: string[]) => {
  service.getMyHiddenWords.mockResolvedValue(envelope(hiddenWordList(phrases)));
  const context = setup();
  // Reading data inside the hook callback makes the observer re-render when the cache changes.
  const query = renderHook(() => useMyHiddenWords().data, { wrapper: context.wrapper });
  await waitFor(() => expect(query.result.current).toBeDefined());
  return { ...context, query };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useMyHiddenWords', () => {
  it('exposes the unwrapped list under the users/me/hiddenWords key', async () => {
    const { query, queryClient } = await load(['spam link', 'idiot']);

    expect(query.result.current?.entries.map((entry) => entry.phrase)).toEqual([
      'spam link',
      'idiot',
    ]);
    expect(query.result.current?.limit).toBe(200);
    expect(queryClient.getQueryData(KEY)).toBeDefined();
  });
});

describe('useAddHiddenWord', () => {
  it('shows a pending row at once and swaps in the server row on success', async () => {
    let finish: (value: ApiResponse<HiddenWordEntryResponse>) => void = () => {};
    service.addHiddenWord.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { queryClient, wrapper, query } = await load(['idiot']);

    const { result } = renderHook(() => useAddHiddenWord(), { wrapper });
    act(() => {
      result.current.mutate('Đồ ngu!');
    });

    await waitFor(() => expect(phrasesInCache(queryClient)).toEqual(['Đồ ngu!', 'idiot']));
    await waitFor(() => {
      const pending = query.result.current?.entries[0];
      expect(pending && isPendingHiddenWord(pending)).toBe(true);
    });
    expect(service.addHiddenWord).toHaveBeenCalledWith('Đồ ngu!');

    await act(async () => {
      finish(envelope(hiddenWordEntry('server-id', 'Đồ ngu!')));
    });

    await waitFor(() => {
      const entries = query.result.current?.entries ?? [];
      expect(entries.map((entry) => entry.id)).toEqual(['server-id', 'w1']);
    });
  });

  it('restores the onMutate snapshot on HIDDEN_WORD_DUPLICATE', async () => {
    service.addHiddenWord.mockRejectedValue(apiError('HIDDEN_WORD_DUPLICATE', 409));
    const { queryClient, wrapper } = await load(['idiot']);

    const { result } = renderHook(() => useAddHiddenWord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('do ngu').catch(() => undefined);
    });

    expect(phrasesInCache(queryClient)).toEqual(['idiot']);
  });
});

describe('useRemoveHiddenWord', () => {
  it('drops the entry before the request settles and sends its id', async () => {
    service.removeHiddenWord.mockReturnValue(new Promise(() => {}));
    const { queryClient, wrapper } = await load(['idiot', 'loser']);

    const { result } = renderHook(() => useRemoveHiddenWord(), { wrapper });
    act(() => {
      result.current.mutate('w1');
    });

    await waitFor(() => expect(phrasesInCache(queryClient)).toEqual(['loser']));
    expect(service.removeHiddenWord).toHaveBeenCalledWith('w1');
  });

  it('puts the entry back when the delete fails', async () => {
    service.removeHiddenWord.mockRejectedValue(apiError('INTERNAL_SERVER_ERROR', 500));
    const { queryClient, wrapper } = await load(['idiot', 'loser']);

    const { result } = renderHook(() => useRemoveHiddenWord(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('w1').catch(() => undefined);
    });

    expect(phrasesInCache(queryClient)).toEqual(['idiot', 'loser']);
  });
});
