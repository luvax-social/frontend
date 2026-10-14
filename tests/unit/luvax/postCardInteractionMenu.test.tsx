import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { PostCard } from '@/features/luvax/components/PostCard';
import { useDismissedPostsStore } from '@/features/luvax/store/useDismissedPostsStore';
import { useMuteDialogStore } from '@/features/luvax/store/useMuteDialogStore';
import * as feedbackService from '@/services/postFeedback.service';
import * as safetyService from '@/services/safety.service';
import { useAuthStore } from '@/store/useAuthStore';
import { postFixture, userSummary } from '../../fixtures/domain';

vi.mock('@/services/postFeedback.service');
vi.mock('@/services/safety.service');
vi.mock('@/services/user.service');
vi.mock('@/services/social.service');
vi.mock('@/hooks/useImpressionTracking', () => ({
  useImpressionTracking: () => ({ ref: vi.fn() }),
}));

const feedback = vi.mocked(feedbackService);
const safety = vi.mocked(safetyService);

const post = postFixture({
  id: 'post-1',
  caption: 'hello',
  author: userSummary({ id: 'author-1', username: 'linh.ng' }),
  media: [],
});

type Surface = 'following' | 'for-you' | 'explore' | 'other';

const renderCard = (props: { feedSurface?: Surface; owned?: boolean } = {}) => {
  useAuthStore.setState({
    user: { id: props.owned ? 'author-1' : 'viewer' } as never,
    isAuthenticated: true,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PostCard post={post} surface="feed" feedSurface={props.feedSurface} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: 'post options' }));
};

const item = (name: string) => screen.queryByRole('button', { name });

beforeEach(() => {
  vi.resetAllMocks();
  useDismissedPostsStore.setState({ byPostId: {} });
  useMuteDialogStore.setState({ target: null });
});

describe('post menu: not interested and show fewer', () => {
  it('offers not interested and show fewer above the author actions on a post from another account', () => {
    renderCard({ feedSurface: 'for-you' });

    const labels = screen.getAllByRole('button').map((button) => button.textContent);
    const notInterested = labels.indexOf('Not interested');
    const showFewer = labels.indexOf('Show fewer from @linh.ng');
    const viewProfile = labels.indexOf("View author's profile");
    expect(notInterested).toBeGreaterThan(-1);
    expect(showFewer).toBe(notInterested + 1);
    expect(viewProfile).toBeGreaterThan(showFewer);
    expect(labels.indexOf('Mute @linh.ng')).toBe(showFewer + 1);
  });

  it('offers neither on the viewer’s own post', () => {
    renderCard({ feedSurface: 'for-you', owned: true });

    expect(item('Not interested')).toBeNull();
    expect(item('Show fewer from @linh.ng')).toBeNull();
    expect(item('Mute @linh.ng')).toBeNull();
  });

  it.each<[Surface, boolean]>([
    ['for-you', true],
    ['explore', true],
    ['following', false],
    ['other', false],
  ])('show fewer on the %s surface is present: %s', (feedSurface, present) => {
    renderCard({ feedSurface });

    expect(item('Not interested')).not.toBeNull();
    expect(Boolean(item('Show fewer from @linh.ng'))).toBe(present);
  });

  it('treats a missing surface as one where show fewer does not apply', () => {
    renderCard();

    expect(item('Show fewer from @linh.ng')).toBeNull();
  });

  it('hides the post and sends the signal when not interested is chosen', async () => {
    feedback.markNotInterested.mockResolvedValue(undefined);
    renderCard({ feedSurface: 'following' });

    fireEvent.click(screen.getByRole('button', { name: 'Not interested' }));

    await waitFor(() => expect(feedback.markNotInterested).toHaveBeenCalledWith('post-1'));
    expect(useDismissedPostsStore.getState().byPostId['post-1']).toEqual({
      kind: 'not-interested',
      authorId: 'author-1',
      authorHandle: 'linh.ng',
    });
  });

  it('asks for fewer posts from the author when show fewer is chosen', async () => {
    safety.showFewer.mockResolvedValue(undefined);
    renderCard({ feedSurface: 'for-you' });

    fireEvent.click(screen.getByRole('button', { name: 'Show fewer from @linh.ng' }));

    await waitFor(() => expect(safety.showFewer).toHaveBeenCalledWith('author-1'));
    expect(useDismissedPostsStore.getState().byPostId['post-1']?.kind).toBe('show-fewer');
  });

  it('opens the mute dialog for the author and hands it the menu button to return to', () => {
    renderCard({ feedSurface: 'following' });

    fireEvent.click(screen.getByRole('button', { name: 'Mute @linh.ng' }));

    const target = useMuteDialogStore.getState().target;
    expect(target?.user).toMatchObject({ id: 'author-1', username: 'linh.ng' });
    expect(target?.returnFocusTo).toBe(screen.getByRole('button', { name: 'post options' }));
  });
});
