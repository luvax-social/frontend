import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { hiddenWordsApi } from '@/features/admin/api/hiddenWords';
import { useHiddenWordActions, useHiddenWordList } from '@/features/admin/hooks/useHiddenWords';

vi.mock('@/features/admin/api/hiddenWords', () => ({
  hiddenWordsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const api = vi.mocked(hiddenWordsApi);

const word = (id: string) => ({
  id,
  phrase: id,
  normalizedPhrase: id,
  createdBy: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
});

const page = (ids: string[], hasNextPage = false, endCursor: string | null = null) => ({
  content: ids.map(word),
  pageInfo: { hasNextPage, hasPreviousPage: false, startCursor: null, endCursor },
  degraded: false,
});

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

type Actions = ReturnType<typeof useHiddenWordActions>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('useHiddenWordList', () => {
  it('keys the cache by the search term and flattens every loaded page', async () => {
    api.list.mockResolvedValueOnce(page(['a'], true, 'c1')).mockResolvedValueOnce(page(['b']));
    const { queryClient, wrapper } = setup();

    const { result } = renderHook(() => useHiddenWordList('ngu'), { wrapper });
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(['a']));
    expect(api.list).toHaveBeenCalledWith({ q: 'ngu', cursor: undefined, limit: 20 });
    expect(queryClient.getQueryData(['admin', 'hiddenWords', 'ngu'])).toBeDefined();

    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    expect(api.list).toHaveBeenLastCalledWith({ q: 'ngu', cursor: 'c1', limit: 20 });
    await waitFor(() => expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('uses an empty term for the unfiltered list', async () => {
    api.list.mockResolvedValue(page([]));
    const { queryClient, wrapper } = setup();

    const { result } = renderHook(() => useHiddenWordList(''), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(queryClient.getQueryData(['admin', 'hiddenWords', ''])).toBeDefined();
  });
});

describe('useHiddenWordActions', () => {
  const runners: [string, (actions: Actions) => Promise<unknown>][] = [
    ['create', (a) => a.create.mutateAsync({ phrase: 'a b', reason: 'abuse' })],
    ['update', (a) => a.update.mutateAsync({ id: 'w1', phrase: 'a b', reason: 'abuse' })],
    ['remove', (a) => a.remove.mutateAsync({ id: 'w1', reason: 'too broad' })],
  ];

  it.each(runners)('%s invalidates the registry lists and the action log', async (_name, run) => {
    api.create.mockResolvedValue(word('x'));
    api.update.mockResolvedValue(word('x'));
    api.remove.mockResolvedValue(undefined);
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useHiddenWordActions(), { wrapper });
    await act(async () => {
      await run(result.current);
    });

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(['admin', 'hiddenWords']);
    expect(keys).toContainEqual(['admin', 'actions']);
  });

  it('sends the phrase and the trimmed reason of each mutation to the api', async () => {
    api.create.mockResolvedValue(word('x'));
    api.update.mockResolvedValue(word('x'));
    api.remove.mockResolvedValue(undefined);
    const { wrapper } = setup();

    const { result } = renderHook(() => useHiddenWordActions(), { wrapper });
    await act(async () => {
      await result.current.create.mutateAsync({ phrase: 'a b', reason: ' why ' });
      await result.current.update.mutateAsync({ id: 'w1', phrase: 'c', reason: 'fix' });
      await result.current.remove.mutateAsync({ id: 'w1', reason: 'gone' });
    });

    expect(api.create).toHaveBeenCalledWith({ phrase: 'a b', reason: 'why' });
    expect(api.update).toHaveBeenCalledWith('w1', { phrase: 'c', reason: 'fix' });
    expect(api.remove).toHaveBeenCalledWith('w1', { reason: 'gone' });
  });

  it.each(['', '   '])('rejects a blank reason %j without calling the api', async (reason) => {
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useHiddenWordActions(), { wrapper });
    await act(async () => {
      await expect(result.current.create.mutateAsync({ phrase: 'a', reason })).rejects.toThrow(
        'a reason is required'
      );
      await expect(
        result.current.update.mutateAsync({ id: 'w1', phrase: 'a', reason })
      ).rejects.toThrow('a reason is required');
      await expect(result.current.remove.mutateAsync({ id: 'w1', reason })).rejects.toThrow(
        'a reason is required'
      );
    });

    expect(api.create).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
