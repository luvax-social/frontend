import { describe, it, expect, vi } from 'vitest';
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

describe('FeedPeopleCard', () => {
  it('never renders a scroll control; further accounts come from later cards', () => {
    renderCard([row(), row({ id: 'u2' })]);
    expect(screen.queryByRole('button', { name: /more suggestions/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /previous suggestions/i })).toBeNull();
  });

  it('renders exactly the accounts it is handed', () => {
    renderCard([row(), row({ id: 'u2', username: 'theo', displayName: 'Theo' })]);
    expect(screen.getByText('Nadia')).toBeTruthy();
    expect(screen.getByText('Theo')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^follow$/i })).toHaveLength(2);
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

  it('shows one tile per view on mobile', () => {
    renderCard([row(), row({ id: 'u2' })], { viewport: 'mobile' });
    const tile = screen.getByTestId('banner-u1').parentElement;
    // One tile per view means no gaps are subtracted from the track.
    expect(tile.style.width).toContain('100% - 0px');
  });

  it('renders the avatar at the size the card intends, not a stale one', () => {
    renderCard([row()]);
    // The avatar is the element between the banner and the name; a silent no-op edit once left it
    // at 60px while every other number assumed 96, which opened a hole above the name.
    const avatar = screen.getByTestId('banner-u1').nextElementSibling.nextElementSibling;
    expect(avatar.style.width).toBe('96px');
    expect(avatar.style.height).toBe('96px');
  });

  it('starts the name clear of the avatar rather than below a gap', () => {
    renderCard([row()]);
    const text = screen.getByText('@nadia').parentElement;
    // avatarTop 38 + avatarSize 96 - bannerH 88 + 10 = 56
    expect(text.style.paddingTop).toBe('56px');
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
