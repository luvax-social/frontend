import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { FeedHashtagCard } from '@/features/luvax/components/feed/FeedHashtagCard';

const row = (name, postCount, overrides = {}) => ({
  hashtagId: `h-${name}`,
  name,
  postCount,
  pinned: false,
  previewUrl: `https://cdn.example/${name}.jpg`,
  ...overrides,
});

const renderCard = (rows) =>
  render(
    <MemoryRouter>
      <FeedHashtagCard rows={rows} onDismiss={vi.fn()} viewport="desktop" />
    </MemoryRouter>
  );

describe('FeedHashtagCard', () => {
  it('renders nothing when there are no rows', () => {
    const { container } = renderCard([]);
    expect(container.firstChild).toBeNull();
  });

  it('renders new for a null post count, never zero and never a dash', () => {
    renderCard([row('coldwater', null)]);
    expect(screen.getByText('new')).toBeTruthy();
    expect(screen.queryByText(/0 posts/i)).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('renders a real count once, not doubled', () => {
    renderCard([row('analogue', 2400)]);
    const label = screen.getByText(/posts/i).textContent;
    expect(label).toMatch(/posts/);
    expect(label).not.toMatch(/posts\s+posts/);
  });

  it('renders zero as zero, distinct from new', () => {
    renderCard([row('quiet', 0)]);
    expect(screen.getByText(/0 posts/i)).toBeTruthy();
    expect(screen.queryByText('new')).toBeNull();
  });

  it('links each row to its hashtag', () => {
    renderCard([row('analogue', 10)]);
    expect(screen.getByRole('link', { name: /analogue/i }).getAttribute('href')).toContain(
      'analogue'
    );
  });

  it('keeps a row whose top post has no media', () => {
    renderCard([row('textonly', 5, { previewUrl: null })]);
    expect(screen.getByText('#textonly')).toBeTruthy();
    expect(screen.getByTestId('preview-h-textonly').getAttribute('data-fallback')).toBe('true');
  });

  it('marks a pinned hashtag', () => {
    renderCard([row('featured', 5, { pinned: true })]);
    expect(screen.getByTitle(/pinned/i)).toBeTruthy();
  });

  it('carries a section options menu rather than a close button', () => {
    renderCard([row('analogue', 10)]);
    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /trending options/i }));
    expect(screen.getByRole('button', { name: /hide trending for now/i })).toBeTruthy();
  });

  it('renders explore as a button-shaped control, not bare text', () => {
    renderCard([row('analogue', 10)]);
    const explore = screen.getByRole('link', { name: /explore/i });
    expect(explore.style.borderRadius).toBe('999px');
    expect(explore.style.background).not.toBe('');
  });

  it('renders the thumbnail large enough to read as an image', () => {
    renderCard([row('analogue', 10)]);
    expect(screen.getByTestId('preview-h-analogue').style.width).toBe('58px');
  });
});
