import type { ReactNode } from 'react';
import type * as PostHooks from '@/features/luvax/hooks/usePosts';
import type { ApiResponse, CursorPage } from '@/types/api';
import type { CommentResponse, HiddenCommentReason, HiddenCommentResponse } from '@/types/domain';
import type { CommentCachePage } from '@/types/cache';
import type { ReportTarget } from '@/types/report';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

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

const LATE_WAIT = { timeout: 3000 };
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
    expect(keys).toContainEqual(['commentReplies']);
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

  it('shows no row message for a 404, because the refetch decides whether the row stays', async () => {
    // The server still lists the row, so a message set by the failure would stay visible.
    service.getHiddenComments.mockResolvedValue(page([hiddenComment('a')]));
    service.unhideComment.mockRejectedValue(apiError('COMMENT_NOT_FOUND', 404));
    renderPanel();
    const row = await screen.findByTestId('hidden-comment-a');

    await click(within(row).getByRole('button', { name: 'unhide' }));

    await waitFor(() => expect(service.getHiddenComments).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('moves focus to the next row, else the previous row, else the back control after an unhide', async () => {
    service.getHiddenComments
      .mockResolvedValueOnce(page([hiddenComment('a'), hiddenComment('b'), hiddenComment('c')]))
      .mockResolvedValueOnce(page([hiddenComment('a'), hiddenComment('c')]))
      .mockResolvedValueOnce(page([hiddenComment('a')]))
      .mockResolvedValue(page([]));
    service.unhideComment.mockImplementation(async (id) => unhideResponse(id));
    renderPanel();
    const unhideOf = (id: string) =>
      within(screen.getByTestId(`hidden-comment-${id}`)).getByRole('button', { name: 'unhide' });
    await screen.findByTestId('hidden-comment-a');

    unhideOf('b').focus();
    await click(unhideOf('b'));
    await waitFor(() => expect(unhideOf('c')).toHaveFocus());

    unhideOf('c').focus();
    await click(unhideOf('c'));
    await waitFor(() => expect(unhideOf('a')).toHaveFocus());

    unhideOf('a').focus();
    await click(unhideOf('a'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'back to comments' })).toHaveFocus()
    );
  });

  it('keeps focus on the unhide button of a row whose unhide failed', async () => {
    service.getHiddenComments.mockResolvedValue(
      page([hiddenComment('a'), hiddenComment('b'), hiddenComment('c')])
    );
    let refuse: (error: unknown) => void = () => {};
    service.unhideComment.mockReturnValue(new Promise((_, reject) => (refuse = reject)));
    renderPanel();
    const unhideOf = (id: string) =>
      within(screen.getByTestId(`hidden-comment-${id}`)).getByRole('button', { name: 'unhide' });
    await screen.findByTestId('hidden-comment-a');

    unhideOf('b').focus();
    await click(unhideOf('b'));
    await waitFor(() => expect(screen.queryByTestId('hidden-comment-b')).not.toBeInTheDocument());
    await act(async () => refuse(apiError('INTERNAL_SERVER_ERROR', 500)));

    await within(screen.getByTestId('hidden-comment-b')).findByRole('alert');
    await waitFor(() => expect(unhideOf('b')).toHaveFocus());
  });

  it('offers only the load more control while the first page is empty but more exist', async () => {
    service.getHiddenComments.mockResolvedValue(page([], 'cursor-1'));
    renderPanel();

    expect(await screen.findByRole('button', { name: 'load more' })).toBeInTheDocument();
    expect(screen.queryByText('No hidden comments on this post')).not.toBeInTheDocument();
    expect(screen.queryByText(/^0\+ on this post/)).not.toBeInTheDocument();
  });

  it('announces loading as a status', () => {
    service.getHiddenComments.mockReturnValue(new Promise(() => {}));
    renderPanel();

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });

  it('goes back on Escape', async () => {
    service.getHiddenComments.mockResolvedValue(page([]));
    const { onBack } = renderPanel();
    await screen.findByText('No hidden comments on this post');

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('leaves Escape to the report modal while it is open', async () => {
    service.getHiddenComments.mockResolvedValue(page([hiddenComment('a')]));
    const { onBack } = renderPanel();
    const row = await screen.findByTestId('hidden-comment-a');

    await click(within(row).getByRole('button', { name: 'report' }));
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onBack).not.toHaveBeenCalled();
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

  const asOwner = () => {
    mockedPostHooks.post = {
      data: { id: POST_ID, author: { id: 'owner', username: 'owner' }, media: [], commentCount: 0 },
    };
    useAuthStore.setState({ user: { id: 'owner', username: 'owner' } } as never);
  };

  const openPanel = async () => {
    await click(screen.getByRole('button', { name: 'post options' }));
    await click(await screen.findByRole('button', { name: 'Hidden comments' }));
    await screen.findByTestId('hidden-comment-a');
  };

  it('closes the panel on Escape before the post overlay closes', async () => {
    service.getHiddenComments.mockResolvedValue(page([hiddenComment('a')]));
    asOwner();
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={['/app', `/app/p/${POST_ID}`]} initialIndex={1}>
          <Routes>
            <Route path="/app" element={<div>feed screen</div>} />
            <Route path="/app/p/:postId" element={<PostDetailScreen overlay />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    await openPanel();

    fireEvent.keyDown(document.body, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByTestId('hidden-comment-a')).not.toBeInTheDocument());
    expect(screen.queryByText('feed screen')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'post options' })).toHaveFocus();
  });

  it('closes the panel when another post is opened', async () => {
    service.getHiddenComments.mockResolvedValue(page([hiddenComment('a')]));
    asOwner();
    function Jump() {
      const navigate = useNavigate();
      return <button onClick={() => navigate('/app/p/p2')}>jump</button>;
    }
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={[`/app/p/${POST_ID}`]}>
          <Routes>
            <Route
              path="/app/p/:postId"
              element={
                <>
                  <PostDetailScreen />
                  <Jump />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    await openPanel();

    await click(screen.getByRole('button', { name: 'jump' }));

    await waitFor(() => expect(screen.queryByTestId('hidden-comment-a')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'post options' })).toBeInTheDocument();
  });

  it('does not reopen the panel when the viewer comes back to the post it was opened on', async () => {
    service.getHiddenComments.mockResolvedValue(page([hiddenComment('a')]));
    asOwner();
    function Jump() {
      const navigate = useNavigate();
      return (
        <>
          <button onClick={() => navigate('/app/p/p2')}>to other</button>
          <button onClick={() => navigate(`/app/p/${POST_ID}`)}>to first</button>
        </>
      );
    }
    render(
      <QueryClientProvider client={makeClient()}>
        <MemoryRouter initialEntries={[`/app/p/${POST_ID}`]}>
          <Routes>
            <Route
              path="/app/p/:postId"
              element={
                <>
                  <PostDetailScreen />
                  <Jump />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    await openPanel();

    await click(screen.getByRole('button', { name: 'to other' }));
    await click(screen.getByRole('button', { name: 'to first' }));

    expect(screen.queryByTestId('hidden-comment-a')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'post options' })).toBeInTheDocument();
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
  const deliver = (...frames: ReturnType<typeof frame>[]) =>
    act(() => {
      for (const next of frames) liveHandlers.get(COMMENT_TOPIC)?.(next);
    });

  const setup = (rows: CommentResponse[] = []) => {
    const client = makeClient();
    client.setQueryData(['comments', POST_ID], {
      pages: [
        { data: { content: [commentFixture({ id: 'existing', postId: POST_ID }), ...rows] } },
      ],
      pageParams: [null],
    });
    client.setQueryData(['post', POST_ID], { data: { id: POST_ID, commentCount: 1 } });
    client.setQueryData(HIDDEN_KEY, {
      pages: [page([hiddenComment('late'), hiddenComment('other')])],
      pageParams: [null],
    });
    const spy = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useLivePostUpdates(POST_ID), { wrapper: wrapperFor(client) });
    return { client, spy };
  };

  const topLevelIds = (client: QueryClient) =>
    client
      .getQueryData<CommentCachePage>(['comments', POST_ID])
      ?.pages?.flatMap((entry) => entry.data?.content?.map((row) => row.id) ?? []);
  const commentCount = (client: QueryClient) =>
    client.getQueryData<{ data: { commentCount: number } }>(['post', POST_ID])?.data.commentCount;
  const invalidatedKeys = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.map(([filters]) => (filters as { queryKey?: unknown[] })?.queryKey);

  it('adds an unhidden comment once and leaves every count to the refetch', async () => {
    const { client, spy } = setup();

    deliver(frame('late'), frame('late'));

    expect(topLevelIds(client)).toEqual(['existing', 'late']);
    expect(commentCount(client)).toBe(1);
    await waitFor(() => expect(invalidatedKeys(spy)).toContainEqual(['post', POST_ID]), LATE_WAIT);
    expect(invalidatedKeys(spy)).toContainEqual(['comments', POST_ID]);
    expect(invalidatedKeys(spy)).toContainEqual(['commentReplies']);
  });

  it('does no reply count arithmetic for a released reply', async () => {
    const { client, spy } = setup([commentFixture({ id: 'top', postId: POST_ID, replyCount: 2 })]);
    client.setQueryData(['commentReplies', 'top'], {
      data: { content: [commentFixture({ id: 'r0', parentId: 'top', depth: 1 })] },
    });

    deliver(frame('r1', 'top'), frame('r1', 'top'));

    const rows = client.getQueryData<CommentCachePage>(['commentReplies', 'top'])?.data?.content;
    expect(rows?.map((row) => row.id)).toEqual(['r0', 'r1']);
    const top = client
      .getQueryData<CommentCachePage>(['comments', POST_ID])
      ?.pages?.[0]?.data?.content?.find((row) => row.id === 'top');
    expect(top?.replyCount).toBe(2);
    expect(commentCount(client)).toBe(1);
    await waitFor(() => expect(invalidatedKeys(spy)).toContainEqual(['post', POST_ID]), LATE_WAIT);
  });

  it('writes nothing into a replies list that was never opened', () => {
    const { client } = setup([commentFixture({ id: 'top', postId: POST_ID, replyCount: 1 })]);

    deliver(frame('r1', 'top'));

    expect(client.getQueryData(['commentReplies', 'top'])).toBeUndefined();
  });

  it('refreshes the counts for the commenter whose own hidden row is already cached', async () => {
    const { client, spy } = setup([commentFixture({ id: 'mine', postId: POST_ID })]);

    deliver(frame('mine'));

    expect(topLevelIds(client)).toEqual(['existing', 'mine']);
    expect(commentCount(client)).toBe(1);
    await waitFor(() => expect(invalidatedKeys(spy)).toContainEqual(['post', POST_ID]), LATE_WAIT);
  });

  it('collapses a burst of frames into one refresh', async () => {
    const { spy } = setup();

    deliver(...Array.from({ length: 12 }, (_, index) => frame(`burst-${index}`)));
    await waitFor(() => expect(invalidatedKeys(spy)).toContainEqual(['post', POST_ID]), LATE_WAIT);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const keys = invalidatedKeys(spy);
    expect(keys.filter((key) => key?.[0] === 'post')).toHaveLength(1);
    expect(keys.filter((key) => key?.[0] === 'comments')).toHaveLength(1);
    expect(keys.filter((key) => key?.[0] === 'commentReplies')).toHaveLength(1);
  });

  it('drops the released comment from the owner review list', () => {
    const { client } = setup();

    deliver(frame('late'));

    expect(idsInCache(client)).toEqual(['other']);
  });
});

describe('counts after the owner unhides', () => {
  const COMMENT_TOPIC = `/topic/comments.${POST_ID}.events`;
  type Server = { commentCount: number; rows: CommentResponse[]; fetchesOfPost: number };

  const frameOf = (comment: CommentResponse) => ({
    eventType: 'comment.unhidden.v1',
    data: {
      postId: POST_ID,
      commentId: comment.id,
      commentOwnerId: 'someone',
      depth: comment.depth,
      parentId: comment.parentId,
      comment,
    },
  });

  const harness = (before: Server, after: Omit<Server, 'fetchesOfPost'>) => {
    const server = before;
    service.unhideComment.mockImplementation(async (id) => {
      Object.assign(server, after);
      return unhideResponse(id);
    });
    const client = makeClient();
    const view = renderHook(
      () => {
        useLivePostUpdates(POST_ID);
        const post = useQuery({
          queryKey: ['post', POST_ID],
          queryFn: async () => {
            server.fetchesOfPost += 1;
            return { data: { id: POST_ID, commentCount: server.commentCount } };
          },
        });
        const comments = useQuery({
          queryKey: ['comments', POST_ID],
          queryFn: async () => ({ data: { content: server.rows } }),
        });
        return { post, comments, unhide: useUnhideComment(POST_ID) };
      },
      { wrapper: wrapperFor(client) }
    );
    return { server, client, view };
  };

  const replyCountOf = (view: ReturnType<typeof harness>['view'], id: string) =>
    view.result.current.comments.data?.data.content.find((row) => row.id === id)?.replyCount;

  it('keeps the refetched counts when the frames of a comment and its released replies arrive', async () => {
    const top = commentFixture({ id: 'top', postId: POST_ID, replyCount: 0 });
    const released = [
      commentFixture({ id: 'r1', postId: POST_ID, parentId: 'top', rootId: 'top', depth: 1 }),
      commentFixture({ id: 'r2', postId: POST_ID, parentId: 'top', rootId: 'top', depth: 1 }),
    ];
    const { server, view } = harness(
      { commentCount: 1, rows: [top], fetchesOfPost: 0 },
      { commentCount: 4, rows: [{ ...top, replyCount: 2 }] }
    );
    await waitFor(() => expect(view.result.current.post.data?.data.commentCount).toBe(1));

    await act(async () => view.result.current.unhide.mutate('top'));
    await waitFor(() => expect(view.result.current.post.data?.data.commentCount).toBe(4));
    await waitFor(() => expect(replyCountOf(view, 'top')).toBe(2));
    const fetchesBeforeFrames = server.fetchesOfPost;

    act(() => {
      for (const comment of [{ ...top, replyCount: 2 }, ...released]) {
        liveHandlers.get(COMMENT_TOPIC)?.(frameOf(comment));
      }
    });

    expect(view.result.current.post.data?.data.commentCount).toBe(4);
    expect(replyCountOf(view, 'top')).toBe(2);
    await waitFor(() => expect(server.fetchesOfPost).toBe(fetchesBeforeFrames + 1), LATE_WAIT);
    expect(view.result.current.post.data?.data.commentCount).toBe(4);
    expect(replyCountOf(view, 'top')).toBe(2);
  });

  it('keeps the refetched counts when the unhidden comment is itself a reply', async () => {
    const parent = commentFixture({ id: 'parent', postId: POST_ID, replyCount: 0 });
    const reply = commentFixture({
      id: 'reply',
      postId: POST_ID,
      parentId: 'parent',
      rootId: 'parent',
      depth: 1,
    });
    const { server, view } = harness(
      { commentCount: 1, rows: [parent], fetchesOfPost: 0 },
      { commentCount: 2, rows: [{ ...parent, replyCount: 1 }] }
    );
    await waitFor(() => expect(view.result.current.post.data?.data.commentCount).toBe(1));

    await act(async () => view.result.current.unhide.mutate('reply'));
    await waitFor(() => expect(view.result.current.post.data?.data.commentCount).toBe(2));
    await waitFor(() => expect(replyCountOf(view, 'parent')).toBe(1));
    const fetchesBeforeFrames = server.fetchesOfPost;

    act(() => liveHandlers.get(COMMENT_TOPIC)?.(frameOf(reply)));

    expect(view.result.current.post.data?.data.commentCount).toBe(2);
    expect(replyCountOf(view, 'parent')).toBe(1);
    await waitFor(() => expect(server.fetchesOfPost).toBe(fetchesBeforeFrames + 1), LATE_WAIT);
    expect(view.result.current.post.data?.data.commentCount).toBe(2);
    expect(replyCountOf(view, 'parent')).toBe(1);
  });
});
