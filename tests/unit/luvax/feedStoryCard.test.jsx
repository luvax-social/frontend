import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mutate = vi.fn();

vi.mock('@/features/luvax/hooks/useOverlayNavigate', () => ({
  useOverlayNavigate: () => vi.fn(),
}));
vi.mock('@/features/luvax/hooks/useStories', () => ({
  useLikeStory: () => ({ mutate }),
}));
vi.mock('@/services/message.service', () => ({
  messageService: { createDirect: vi.fn(), sendMessage: vi.fn() },
}));

const { FeedStoryCard } = await import('@/features/luvax/components/feed/FeedStoryCard');

const entry = (id, storyCount, overrides = {}) => ({
  userId: id,
  username: id,
  userDisplayName: id,
  userAvatarUrl: null,
  hasUnseen: true,
  stories: Array.from({ length: storyCount }, (_, i) => ({
    id: `${id}-s${i}`,
    storyType: 'image',
    createdAt: '2026-09-19T10:00:00Z',
    liked: false,
    media: { cdnUrl: `https://cdn.example/${id}-${i}.jpg` },
  })),
  ...overrides,
});

const renderCard = (value, onDismiss = vi.fn()) =>
  render(
    <MemoryRouter>
      <FeedStoryCard entry={value} viewport="desktop" onDismiss={onDismiss} />
    </MemoryRouter>
  );

describe('FeedStoryCard', () => {
  it('renders one author, not a rail of many', () => {
    renderCard(entry('nadia', 2));
    expect(screen.getByRole('region', { name: /story by nadia/i })).toBeTruthy();
  });

  it('draws one progress segment per story that author has', () => {
    renderCard(entry('nadia', 3));
    expect(screen.getByTestId('story-segments-nadia').children).toHaveLength(3);
  });

  it('renders nothing when the author has no stories', () => {
    const { container } = renderCard(entry('ghost', 0));
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when handed no entry at all', () => {
    const { container } = renderCard(undefined);
    expect(container.firstChild).toBeNull();
  });

  it('no longer shows the expiry pill', () => {
    renderCard(entry('nadia', 1));
    expect(screen.queryByText('24h')).toBeNull();
  });

  it('carries the post affordances inline: like, reply and send', () => {
    renderCard(entry('nadia', 1));
    expect(screen.getByRole('button', { name: /like story/i })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /reply to nadia/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /send reply/i })).toBeTruthy();
  });

  it('offers a report control, which the full viewer never had', () => {
    renderCard(entry('nadia', 1));
    expect(screen.getByRole('button', { name: /report story by nadia/i })).toBeTruthy();
  });

  it('opens the story when the media is activated', () => {
    renderCard(entry('nadia', 1));
    expect(screen.getByRole('button', { name: /open nadia's story/i })).toBeTruthy();
  });

  it('likes the story it is currently showing', () => {
    mutate.mockClear();
    renderCard(entry('nadia', 1));
    screen.getByRole('button', { name: /like story/i }).click();
    expect(mutate).toHaveBeenCalledWith({ storyId: 'nadia-s0', liked: false });
  });

  it('disables send until something is typed', () => {
    renderCard(entry('nadia', 1));
    expect(screen.getByRole('button', { name: /send reply/i }).disabled).toBe(true);
  });

  it('gives the dismiss control an accessible name', () => {
    renderCard(entry('nadia', 1));
    expect(screen.getByRole('button', { name: /dismiss story suggestions/i })).toBeTruthy();
  });
});
