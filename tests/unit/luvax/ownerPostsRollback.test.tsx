import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';

import { useUnarchivePost } from '@/features/luvax/hooks/useArchivedPosts';
import { useDeleteOwnedPost } from '@/features/luvax/hooks/useDrafts';
import * as postService from '@/services/post.service';

vi.mock('@/services/post.service');

const service = vi.mocked(postService);

const page = (...ids: string[]) => ({
  pages: [{ data: { content: ids.map((id) => ({ id })), pageInfo: {} } }],
  pageParams: [null],
});

const idsOf = (queryClient: QueryClient, key: string[]) =>
  (
    queryClient.getQueryData(key) as { pages: { data: { content: { id: string }[] } }[] }
  ).pages[0].data.content.map((row) => row.id);

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['drafts', 'list', 'draft'], page('d1', 'd2'));
  queryClient.setQueryData(['drafts', 'list', 'scheduled'], page('s1'));
  queryClient.setQueryData(['archive', 'posts'], page('a1', 'a2'));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

const envelope = { success: true, code: 'OK', message: 'ok', data: null, timestamp: '' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('deleting a draft', () => {
  it('removes the row from the list while the request is in flight', async () => {
    let finish: (value: typeof envelope) => void = () => undefined;
    service.deletePost.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useDeleteOwnedPost(), { wrapper });

    act(() => {
      result.current.mutate('d1');
    });

    await vi.waitFor(() => expect(idsOf(queryClient, ['drafts', 'list', 'draft'])).toEqual(['d2']));
    await act(async () => finish(envelope));
  });

  it('puts the row back when the server refuses the delete', async () => {
    service.deletePost.mockRejectedValue(new Error('refused'));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useDeleteOwnedPost(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('d1').catch(() => undefined);
    });

    expect(idsOf(queryClient, ['drafts', 'list', 'draft'])).toEqual(['d1', 'd2']);
  });
});

describe('unarchiving a post', () => {
  it('removes the tile at once and restores it when the server refuses', async () => {
    service.updatePostStatus.mockRejectedValue(new Error('refused'));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useUnarchivePost(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ postId: 'a1', target: 'published' })
        .catch(() => undefined);
    });

    expect(idsOf(queryClient, ['archive', 'posts'])).toEqual(['a1', 'a2']);
  });

  it('asks for the archived status when the undo runs', async () => {
    service.updatePostStatus.mockResolvedValue(envelope as never);
    const { wrapper } = setup();
    const { result } = renderHook(() => useUnarchivePost(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ postId: 'a1', target: 'archived' });
    });

    expect(service.updatePostStatus).toHaveBeenCalledWith('a1', 'archived');
  });
});
