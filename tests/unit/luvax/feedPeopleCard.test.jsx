import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { FeedPeopleCard } from '@/features/luvax/components/feed/FeedPeopleCard';

const row = (overrides = {}) => ({
  id: 'u1',
  username: 'nadia',
  displayName: 'Nadia',
  avatarUrl: null,
  bannerUrl: null,
  followerCount: 1240,
  verified: false,
  verifiedCategory: null,
  isFollowing: false,
  isFollowRequested: false,
  ...overrides,
});

const renderCard = (rows, props = {}) =>
  render(
    <MemoryRouter>
      <FeedPeopleCard
        rows={rows}
        onFollow={vi.fn()}
        onDismissUser={vi.fn()}
        onDismiss={vi.fn()}
        viewport="desktop"
        {...props}
      />
    </MemoryRouter>
  );

/**
 * jsdom reports every element as zero-sized, which makes the scroller look both fully scrolled and
 * not scrollable at once. Giving it a track narrower than its content is what lets the edge state,
 * and therefore the arrows, be exercised at all.
 */
const stubTrack = ({ clientWidth, scrollWidth }) => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    value: clientWidth,
    configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    value: scrollWidth,
    configurable: true,
  });
};

describe('FeedPeopleCard', () => {
  beforeEach(() => stubTrack({ clientWidth: 300, scrollWidth: 900 }));
  afterEach(() => {
    delete HTMLElement.prototype.clientWidth;
    delete HTMLElement.prototype.scrollWidth;
  });

  it('renders nothing when there are no rows', () => {
    const { container } = renderCard([]);
    expect(container.firstChild).toBeNull();
  });

  it('shows the follower count', () => {
    renderCard([row()]);
    expect(screen.getByTestId('followers-u1').textContent).toMatch(/1240 followers/);
  });

  it('no longer renders the suggestion reason', () => {
    renderCard([row()]);
    expect(screen.queryByText(/followed by people you follow/i)).toBeNull();
  });

  it('offers a forward arrow once there are more rows than fit', () => {
    renderCard([
      row(),
      row({ id: 'u2', username: 'theo' }),
      row({ id: 'u3', username: 'ines' }),
      row({ id: 'u4', username: 'mira' }),
    ]);
    expect(screen.getByRole('button', { name: /more suggestions/i })).toBeTruthy();
  });

  it('omits the arrows when everything already fits', () => {
    renderCard([row()]);
    expect(screen.queryByRole('button', { name: /more suggestions/i })).toBeNull();
  });

  it('hides the previous arrow at the start of the list, as the post carousel does', () => {
    renderCard([row(), row({ id: 'u2' }), row({ id: 'u3' }), row({ id: 'u4' })]);
    expect(screen.queryByRole('button', { name: /previous suggestions/i })).toBeNull();
  });

  it('shows one tile per view on mobile', () => {
    renderCard([row(), row({ id: 'u2' })], { viewport: 'mobile' });
    const tile = screen.getByTestId('banner-u1').parentElement;
    // One tile per view means no gaps are subtracted from the track.
    expect(tile.style.width).toContain('100% - 0px');
  });

  it('shows two tiles per view on desktop', () => {
    renderCard([row(), row({ id: 'u2' })]);
    const tile = screen.getByTestId('banner-u1').parentElement;
    // Two tiles per view subtract the single 10px gap between them.
    expect(tile.style.width).toContain('100% - 10px');
  });

  it('falls back to the accent-dim wash when the account has no banner', () => {
    renderCard([row()]);
    expect(screen.getByTestId('banner-u1').getAttribute('data-fallback')).toBe('true');
  });

  it('uses the real banner when there is one', () => {
    renderCard([row({ bannerUrl: 'https://cdn.example/b.jpg' })]);
    expect(screen.getByTestId('banner-u1').getAttribute('data-fallback')).toBe('false');
  });

  it('shows pending rather than following for an outstanding request', () => {
    renderCard([row({ isFollowRequested: true })]);
    expect(screen.getByRole('button', { name: /pending/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^following$/i })).toBeNull();
  });

  it('calls onFollow with the account id', () => {
    const onFollow = vi.fn();
    renderCard([row()], { onFollow });
    screen.getByRole('button', { name: /^follow$/i }).click();
    expect(onFollow).toHaveBeenCalledWith('u1');
  });

  it('does not call onFollow once the request is pending', () => {
    const onFollow = vi.fn();
    renderCard([row({ isFollowRequested: true })], { onFollow });
    screen.getByRole('button', { name: /pending/i }).click();
    expect(onFollow).not.toHaveBeenCalled();
  });

  it('gives each per-account dismiss control its own accessible name', () => {
    renderCard([row(), row({ id: 'u2', username: 'theo', displayName: 'Theo' })]);
    expect(screen.getByRole('button', { name: /dismiss nadia/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /dismiss theo/i })).toBeTruthy();
  });

  it('links the name to the account profile by id', () => {
    renderCard([row()]);
    expect(screen.getByRole('link', { name: /nadia/i }).getAttribute('href')).toContain('u1');
  });
});
