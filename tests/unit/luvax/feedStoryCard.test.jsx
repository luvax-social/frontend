import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { FeedStoryCard } from '@/features/luvax/components/feed/FeedStoryCard';

vi.mock('@/features/luvax/hooks/useOverlayNavigate', () => ({
  useOverlayNavigate: () => vi.fn(),
}));

const entry = (id, storyCount, unseen = true) => ({
  userId: id,
  username: id,
  userDisplayName: id,
  userAvatarUrl: null,
  hasUnseen: unseen,
  stories: Array.from({ length: storyCount }, (_, i) => ({
    id: `${id}-s${i}`,
    media: { cdnUrl: `https://cdn.example/${id}-${i}.jpg` },
  })),
});

const renderCard = (entries, onDismiss = vi.fn()) =>
  render(
    <MemoryRouter>
      <FeedStoryCard entries={entries} viewport="desktop" onDismiss={onDismiss} />
    </MemoryRouter>
  );

describe('FeedStoryCard', () => {
  it('draws one progress segment per story in the tray', () => {
    renderCard([entry('nadia', 3)]);
    expect(screen.getByTestId('story-segments-nadia').children).toHaveLength(3);
  });

  it('marks the card as a story region for assistive technology', () => {
    renderCard([entry('nadia', 1)]);
    expect(screen.getByRole('region', { name: /stories/i })).toBeTruthy();
  });

  it('states the expiry window', () => {
    renderCard([entry('nadia', 1)]);
    expect(screen.getByText('24h')).toBeTruthy();
  });

  it('renders nothing at all when there are no entries', () => {
    const { container } = renderCard([]);
    expect(container.firstChild).toBeNull();
  });

  it('gives the dismiss control an accessible name', () => {
    renderCard([entry('nadia', 1)]);
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeTruthy();
  });

  it('names each tile after its author and story count', () => {
    renderCard([entry('nadia', 2), entry('theo', 1)]);
    expect(screen.getByRole('link', { name: /nadia, 2 stories/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /theo, 1 stories/i })).toBeTruthy();
  });

  it('skips an entry carrying no stories rather than crashing', () => {
    const empty = { ...entry('ghost', 0), stories: [] };
    renderCard([empty, entry('nadia', 1)]);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
