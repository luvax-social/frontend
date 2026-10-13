import type { ReactNode } from 'react';
import type * as PostHooks from '@/features/luvax/hooks/usePosts';
import type { ApiResponse, CursorPage } from '@/types/api';
import type { CommentResponse, HiddenCommentReason, HiddenCommentResponse } from '@/types/domain';
import type { CommentCachePage } from '@/types/cache';
import type { ReportTarget } from '@/types/report';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { postService } from '@/services/post.service';
import { useAuthStore } from '@/store/useAuthStore';
import { HiddenCommentsPanel } from '@/features/luvax/components/HiddenCommentsPanel';
import { PostDetailScreen } from '@/features/luvax/components/PostDetailScreen';
import { useHiddenComments, useUnhideComment } from '@/features/luvax/hooks/useHiddenComments';
import { useLivePostUpdates } from '@/features/luvax/hooks/useLivePostUpdates';
import { commentFixture, userSummary } from '../../fixtures/domain';
import { apiError } from './settings/settingsFixtures';

vi.mock('@/services/post.service');
vi.mock('@/services/notification.service');

const liveHandlers = new Map<string, (payload: unknown) => void>();
vi.mock('@/services/realtime/stompConnection', () => ({
  subscribeTopic: (destination: string, handler: (payload: unknown) => void) => {
    liveHandlers.set(destination, handler);
    return () => liveHandlers.delete(destination);
  },
}));

vi.mock('@/features/luvax/components/ReportModal', () => ({
  ReportModal: ({ target }: { target: ReportTarget | null }) =>
    target ? (
      <div role="dialog" aria-label={`report ${target.entityType} ${target.entityId}`} />
    ) : null,
}));

const mockedPostHooks = vi.hoisted(() => ({ post: undefined as unknown }));
vi.mock('@/features/luvax/hooks/usePosts', async (importOriginal) => {
  const actual = await importOriginal<typeof PostHooks>();
  return {
    ...actual,
    usePostDetail: () => ({ data: mockedPostHooks.post, isLoading: false, isError: false }),
    useTopLevelComments: () => ({
      data: { pages: [{ data: { content: [] } }] },
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }),
  };
});

const click = async (element: Element) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

const service = vi.mocked(postService);
const POST_ID = 'p1';
const HIDDEN_KEY = ['comments', POST_ID, 'hidden'];

const hiddenComment = (
  id: string,
  overrides: Partial<HiddenCommentResponse> = {}
): HiddenCommentResponse => {
  const { pinned: _pinned, ...base } = commentFixture({
    id,
    postId: POST_ID,
    content: `text of ${id}`,
    author: userSummary({ id: `author-${id}`, username: `user.${id}` }),
  });
  return { ...base, pinned: false, hiddenReason: 'hidden_words', ...overrides };
};

const page = (
  rows: HiddenCommentResponse[],
  endCursor: string | null = null
): ApiResponse<CursorPage<HiddenCommentResponse>> => ({
  success: true,
  code: 'OK',
  message: 'ok',
  data: {
    content: rows,
    pageInfo: {
      hasNextPage: endCursor !== null,
      hasPreviousPage: false,
      startCursor: null,
      endCursor,
    },
    degraded: false,
  },
  timestamp: '2026-10-14T00:00:00Z',
});

const unhideResponse = (id: string): ApiResponse<CommentResponse> => ({
  success: true,
  code: 'OK',
  message: 'ok',
  data: commentFixture({ id, postId: POST_ID }),
  timestamp: '2026-10-14T00:00:00Z',
});

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

const wrapperFor = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };

const idsInCache = (client: QueryClient) =>
  (client.getQueryData<CommentCachePage>(HIDDEN_KEY)?.pages ?? []).flatMap(
    (entry) => entry.data?.content?.map((row) => row.id) ?? []
  );

beforeEach(() => {
  vi.resetAllMocks();
  liveHandlers.clear();
  useAuthStore.setState({ user: null, isAuthenticated: false });
});

describe('useHiddenComments', () => {
  it('pages the owner list on its cursor under the post hidden key', async () => {
    service.getHiddenComments
      .mockResolvedValueOnce(page([hiddenComment('a')], 'cursor-1'))
      .mockResolvedValueOnce(page([hiddenComment('b')]));
    const client = makeClient();

    const { result } = renderHook(() => useHiddenComments(POST_ID), {
      wrapper: wrapperFor(client),
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));

    expect(service.getHiddenComments).toHaveBeenCalledWith(POST_ID, { cursor: null, limit: 20 });
    expect(client.getQueryData(HIDDEN_KEY)).toBeDefined();
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    expect(service.getHiddenComments).toHaveBeenLastCalledWith(POST_ID, {
      cursor: 'cursor-1',
      limit: 20,
    });
    expect(idsInCache(client)).toEqual(['a', 'b']);
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it('does not fetch without a post id', () => {
    renderHook(() => useHiddenComments(undefined), { wrapper: wrapperFor(makeClient()) });

    expect(service.getHiddenComments).not.toHaveBeenCalled();
  });
});

describe('useUnhideComment', () => {
  const seed = (client: QueryClient) =>
    client.setQueryData(HIDDEN_KEY, {
      pages: [page([hiddenComment('a'), hiddenComment('b')])],
      pageParams: [null],
    });

  it('removes the row before the server answers', async () => {
    let finish: (value: ApiResponse<CommentResponse>) => void = () => {};
    service.unhideComment.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const client = makeClient();
    seed(client);
    const { result } = renderHook(() => useUnhideComment(POST_ID), {
      wrapper: wrapperFor(client),
    });

    act(() => result.current.mutate('a'));

    await waitFor(() => expect(idsInCache(client)).toEqual(['b']));
    expect(service.unhideComment).toHaveBeenCalledWith('a');
    await act(async () => finish(unhideResponse('a')));
  });

  it('rolls back to the snapshot and reports the error when the unhide fails', async () => {
    const failure = apiError('COMMENT_PARENT_STILL_HIDDEN', 409);
    service.unhideComment.mockRejectedValue(failure);
    const onError = vi.fn();
    const client = makeClient();
    seed(client);
    const before = client.getQueryData(HIDDEN_KEY);
    const { result } = renderHook(() => useUnhideComment(POST_ID, { onError }), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      result.current.mutate('a');
    });

    await waitFor(() => expect(onError).toHaveBeenCalledWith(failure, 'a'));
    expect(client.getQueryData(HIDDEN_KEY)).toEqual(before);
    expect(idsInCache(client)).toEqual(['a', 'b']);
  });

  it('invalidates the post comments, the post, the feed and the hidden list on success', async () => {
    service.unhideComment.mockResolvedValue(unhideResponse('a'));
    service.getHiddenComments.mockResolvedValue(page([hiddenComment('b')]));
    const client = makeClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const wrapper = wrapperFor(client);
    const list = renderHook(() => useHiddenComments(POST_ID), { wrapper });
    await waitFor(() => expect(list.result.current.data).toBeDefined());
    const { result } = renderHook(() => useUnhideComment(POST_ID), { wrapper });

    await act(async () => {
      result.current.mutate('a');
    });

    await waitFor(() => expect(service.getHiddenComments).toHaveBeenCalledTimes(2));
    const keys = spy.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(['comments', POST_ID]);
    expect(keys).toContainEqual(['post', POST_ID]);
    expect(keys).toContainEqual(['feed']);
  });

  it('refetches the list when the comment is no longer there to unhide', async () => {
    service.unhideComment.mockRejectedValue(apiError('COMMENT_NOT_FOUND', 404));
    service.getHiddenComments.mockResolvedValue(page([hiddenComment('b')]));
    const client = makeClient();
    const wrapper = wrapperFor(client);
    const list = renderHook(() => useHiddenComments(POST_ID), { wrapper });
    await waitFor(() => expect(list.result.current.data).toBeDefined());
    const { result } = renderHook(() => useUnhideComment(POST_ID), { wrapper });

    await act(async () => {
      result.current.mutate('a');
    });

    await waitFor(() => expect(service.getHiddenComments).toHaveBeenCalledTimes(2));
  });
});

describe('HiddenCommentsPanel', () => {
  const renderPanel = (onBack = vi.fn()) => {
    const client = makeClient();
    const view = render(<HiddenCommentsPanel postId={POST_ID} onBack={onBack} />, {
      wrapper: wrapperFor(client),
    });
    return { ...view, client, onBack };
  };

  const REASONS: [HiddenCommentReason, RegExp][] = [
    ['hidden_words', /matched your hidden words/i],
    ['limited_interaction', /from a limited account/i],
    ['hidden_parent', /reply to a hidden comment/i],
  ];

  it('lists each hidden comment with its author, text, reason and actions', async () => {
    service.getHiddenComments.mockResolvedValue(
      page(REASONS.map(([reason], index) => hiddenComment(`c${index}`, { hiddenReason: reason })))
    );
    renderPanel();

    expect(await screen.findByText('text of c0')).toBeInTheDocument();
    expect(screen.getByText('user.c1')).toBeInTheDocument();
    expect(screen.getByText('3 on this post, only you can see these')).toBeInTheDocument();
    for (const [index, [, copy]] of REASONS.entries()) {
      expect(within(screen.getByTestId(`hidden-comment-c${index}`)).getByText(copy)).toBeVisible();
    }
    expect(screen.getAllByRole('button', { name: 'unhide' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'report' })).toHaveLength(3);
    expect(screen.getByText(/appear for everyone and count toward/i)).toBeInTheDocument();
  });

  it('shows the empty state when nothing is hidden', async () => {
    service.getHiddenComments.mockResolvedValue(page([]));
    renderPanel();

    expect(await screen.findByText('No hidden comments on this post')).toBeInTheDocument();
  });

  it('removes a row once it is unhidden', async () => {
    // The refetch after a successful unhide no longer lists the released comment.
    service.getHiddenComments
      .mockResolvedValueOnce(page([hiddenComment('a'), hiddenComment('b')]))
      .mockResolvedValue(page([hiddenComment('b')]));
    service.unhideComment.mockResolvedValue(unhideResponse('a'));
    renderPanel();
    const row = await screen.findByTestId('hidden-comment-a');

    await click(within(row).getByRole('button', { name: 'unhide' }));

    await waitFor(() => expect(screen.queryByTestId('hidden-comment-a')).not.toBeInTheDocument());
    expect(service.unhideComment).toHaveBeenCalledWith('a');
    expect(screen.getByTestId('hidden-comment-b')).toBeInTheDocument();
  });

  it('refetches the list when the server says the comment is gone', async () => {
    service.getHiddenComments
      .mockResolvedValueOnce(page([hiddenComment('a')]))
      .mockResolvedValue(page([]));
    service.unhideComment.mockRejectedValue(apiError('COMMENT_NOT_FOUND', 404));
    renderPanel();
    const row = await screen.findByTestId('hidden-comment-a');

    await click(within(row).getByRole('button', { name: 'unhide' }));

    expect(await screen.findByText('No hidden comments on this post')).toBeInTheDocument();
    expect(service.getHiddenComments).toHaveBeenCalledTimes(2);
  });

  it('keeps the row and says why when its parent is still hidden', async () => {
    service.getHiddenComments.mockResolvedValue(
      page([hiddenComment('a', { hiddenReason: 'hidden_parent' })])
    );
    service.unhideComment.mockRejectedValue(apiError('COMMENT_PARENT_STILL_HIDDEN', 409));
    renderPanel();
    const row = await screen.findByTestId('hidden-comment-a');

    await click(within(row).getByRole('button', { name: 'unhide' }));

    expect(
      await within(screen.getByTestId('hidden-comment-a')).findByText(
        /unhide the comment it replies to first/i
      )
    ).toBeInTheDocument();
    expect(within(screen.getByTestId('hidden-comment-a')).getByText('text of a')).toBeVisible();
  });

  it('opens the report modal for the comment', async () => {
    service.getHiddenComments.mockResolvedValue(page([hiddenComment('a')]));
    renderPanel();
    const row = await screen.findByTestId('hidden-comment-a');

    await click(within(row).getByRole('button', { name: 'report' }));

    expect(screen.getByRole('dialog', { name: 'report comment a' })).toBeInTheDocument();
  });

  it('states that a comment is already reported instead of offering to report it again', async () => {
    service.getHiddenComments.mockResolvedValue(page([hiddenComment('a', { hasReported: true })]));
    renderPanel();
    const row = await screen.findByTestId('hidden-comment-a');

    expect(within(row).queryByRole('button', { name: 'report' })).not.toBeInTheDocument();
    expect(within(row).getByText('reported')).toBeInTheDocument();
  });

  it('loads the next page on request', async () => {
    service.getHiddenComments
      .mockResolvedValueOnce(page([hiddenComment('a')], 'cursor-1'))
      .mockResolvedValueOnce(page([hiddenComment('b')]));
    renderPanel();
    await screen.findByTestId('hidden-comment-a');

    await click(screen.getByRole('button', { name: 'load more' }));

    expect(await screen.findByTestId('hidden-comment-b')).toBeInTheDocument();
  });

  it('goes back through the back control', async () => {
    service.getHiddenComments.mockResolvedValue(page([]));
    const { onBack } = renderPanel();
    await screen.findByText('No hidden comments on this post');

    await click(screen.getByRole('button', { name: 'back to comments' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('PostDetailScreen hidden comments entry', () => {
  const renderDetail = (viewerId: string) => {
    mockedPostHooks.post = {
      data: { id: POST_ID, author: { id: 'owner', username: 'owner' }, media: [], commentCount: 0 },
    };
    useAuthStore.setState({
      user: { id: viewerId, username: viewerId },
      isAuthenticated: true,
    } as never);
    const client = makeClient();
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/app/p/${POST_ID}`]}>
          <Routes>
            <Route path="/app/p/:postId" element={<PostDetailScreen />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('offers the review panel to the owner and returns focus to the menu on back', async () => {
    service.getHiddenComments.mockResolvedValue(page([hiddenComment('a')]));
    renderDetail('owner');
    const trigger = screen.getByRole('button', { name: 'post options' });

    await click(trigger);
    await click(await screen.findByRole('button', { name: 'Hidden comments' }));

    expect(await screen.findByTestId('hidden-comment-a')).toBeInTheDocument();

    await click(screen.getByRole('button', { name: 'back to comments' }));

    await waitFor(() => expect(screen.queryByTestId('hidden-comment-a')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'post options' })).toHaveFocus();
  });

  it('does not offer it to anyone else', async () => {
    renderDetail('visitor');

    await click(screen.getByRole('button', { name: 'post options' }));

    await screen.findByRole('button', { name: 'Copy link' });
    expect(screen.queryByRole('button', { name: 'Hidden comments' })).not.toBeInTheDocument();
  });
});

describe('live unhidden comments', () => {
  const COMMENT_TOPIC = `/topic/comments.${POST_ID}.events`;
  const frame = (id: string, parentId: string | null = null) => ({
    eventType: 'comment.unhidden.v1',
    data: {
      postId: POST_ID,
      commentId: id,
      commentOwnerId: 'someone',
      depth: parentId ? 1 : 0,
      parentId,
      comment: { ...commentFixture({ id, postId: POST_ID, parentId }), content: `text of ${id}` },
    },
  });

  const setup = () => {
    const client = makeClient();
    client.setQueryData(['comments', POST_ID], {
      pages: [{ data: { content: [commentFixture({ id: 'existing', postId: POST_ID })] } }],
      pageParams: [null],
    });
    client.setQueryData(['post', POST_ID], { data: { id: POST_ID, commentCount: 1 } });
    client.setQueryData(HIDDEN_KEY, {
      pages: [page([hiddenComment('late'), hiddenComment('other')])],
      pageParams: [null],
    });
    renderHook(() => useLivePostUpdates(POST_ID), { wrapper: wrapperFor(client) });
    return client;
  };

  const topLevelIds = (client: QueryClient) =>
    client
      .getQueryData<CommentCachePage>(['comments', POST_ID])
      ?.pages?.flatMap((entry) => entry.data?.content?.map((row) => row.id) ?? []);

  it('adds an unhidden comment once, however many times its frame arrives', () => {
    const client = setup();
    const deliver = liveHandlers.get(COMMENT_TOPIC);

    act(() => {
      deliver?.(frame('late'));
      deliver?.(frame('late'));
    });

    expect(topLevelIds(client)).toEqual(['existing', 'late']);
    expect(
      client.getQueryData<{ data: { commentCount: number } }>(['post', POST_ID])?.data.commentCount
    ).toBe(2);
  });

  it('drops the released comment from the owner review list', () => {
    const client = setup();

    act(() => liveHandlers.get(COMMENT_TOPIC)?.(frame('late')));

    expect(idsInCache(client)).toEqual(['other']);
  });
});
