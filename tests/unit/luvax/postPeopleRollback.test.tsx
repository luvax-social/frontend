import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';

import { useApproveTag, useEditAltText, useRemoveTag } from '@/features/luvax/hooks/usePostPeople';
import * as postService from '@/services/post.service';

vi.mock('@/services/post.service');

const service = vi.mocked(postService);

const media = (altText: string | null = null) => ({
  id: 'pm1',
  mediaAltText: undefined,
  altText,
  tags: [
    { id: 'tag1', user: { id: 'u1', username: 'an' }, x: 0.5, y: 0.5, status: 'pending' },
    { id: 'tag2', user: { id: 'u2', username: 'linh' }, x: 0.2, y: 0.2, status: 'approved' },
  ],
});

const post = (altText: string | null = null) => ({ id: 'p1', media: [media(altText)] });

const setup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(['post', 'p1'], { data: post() });
  queryClient.setQueryData(['notifications', 'tagRequests', 'list'], {
    pages: [{ data: { content: [{ tagId: 'tag1', postId: 'p1' }] } }],
    pageParams: [null],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

const cachedMedia = (queryClient: QueryClient) =>
  (queryClient.getQueryData(['post', 'p1']) as { data: ReturnType<typeof post> }).data.media[0];

const waitingRows = (queryClient: QueryClient) =>
  (
    queryClient.getQueryData(['notifications', 'tagRequests', 'list']) as {
      pages: { data: { content: unknown[] } }[];
    }
  ).pages[0].data.content;

const envelope = { success: true, code: 'OK', message: 'ok', data: null, timestamp: '' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('approving a tag', () => {
  it('shows the tag approved and drops the waiting request at once', async () => {
    let finish: (value: typeof envelope) => void = () => undefined;
    service.approveTag.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useApproveTag(), { wrapper });

    act(() => {
      result.current.mutate({ postId: 'p1', tagId: 'tag1' });
    });

    await vi.waitFor(() => expect(waitingRows(queryClient)).toHaveLength(0));
    expect(cachedMedia(queryClient).tags[0].status).toBe('approved');
    await act(async () => finish(envelope));
  });

  it('restores the tag and the request when the server refuses', async () => {
    service.approveTag.mockRejectedValue(new Error('refused'));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useApproveTag(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ postId: 'p1', tagId: 'tag1' }).catch(() => undefined);
    });

    expect(cachedMedia(queryClient).tags[0].status).toBe('pending');
    expect(waitingRows(queryClient)).toHaveLength(1);
  });
});

describe('removing a tag', () => {
  it('takes the marker off every cached copy and restores it on failure', async () => {
    service.removeTag.mockRejectedValue(new Error('refused'));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRemoveTag(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ postId: 'p1', tagId: 'tag2' }).catch(() => undefined);
    });

    expect(cachedMedia(queryClient).tags.map((tag) => tag.id)).toEqual(['tag1', 'tag2']);
  });

  it('keeps the marker removed when the server accepts', async () => {
    service.removeTag.mockResolvedValue(envelope);
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useRemoveTag(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ postId: 'p1', tagId: 'tag2' });
    });

    expect(cachedMedia(queryClient).tags.map((tag) => tag.id)).not.toContain('tag2');
  });
});

describe('editing alt text', () => {
  it('shows the new text at once and restores the old text on failure', async () => {
    service.updateAltText.mockRejectedValue(new Error('refused'));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useEditAltText(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ postId: 'p1', postMediaId: 'pm1', altText: 'A boat' })
        .catch(() => undefined);
    });

    expect(cachedMedia(queryClient).altText).toBeNull();
  });

  it('sends blank text as a clear and stores nothing', async () => {
    service.updateAltText.mockResolvedValue({ ...envelope, data: post() } as never);
    const { wrapper } = setup();
    const { result } = renderHook(() => useEditAltText(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ postId: 'p1', postMediaId: 'pm1', altText: '   ' });
    });

    expect(service.updateAltText).toHaveBeenCalledWith('p1', 'pm1', null);
  });
});
