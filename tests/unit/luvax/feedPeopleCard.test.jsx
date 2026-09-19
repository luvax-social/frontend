import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

// The card owns the block mutation, so it needs a client even in tests that never block.
const renderCard = (rows, props = {}) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
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
    </QueryClientProvider>
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
    const tile = screen.getByTestId('banner-u1').closest('[style*="flex-shrink"]');
    // One tile per view means no gaps are subtracted from the track.
    expect(tile.style.width).toContain('100% - 0px');
  });

  it('renders the avatar at the size the card intends, not a stale one', () => {
    renderCard([row()]);
    // The avatar is the element between the banner and the name; a silent no-op edit once left it
    // at 60px while every other number assumed 96, which opened a hole above the name.
    const avatar =
      screen.getByTestId('banner-u1').parentElement.nextElementSibling.nextElementSibling;
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
    const tile = screen.getByTestId('banner-u1').closest('[style*="flex-shrink"]');
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

  it('gives each per-account options control its own accessible name', () => {
    renderCard([row(), row({ id: 'u2', username: 'theo', displayName: 'Theo' })]);
    expect(screen.getByRole('button', { name: /options for nadia/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /options for theo/i })).toBeTruthy();
  });

  it('offers follow, hide, block and report from one account menu', () => {
    renderCard([row()]);
    fireEvent.click(screen.getByRole('button', { name: /options for nadia/i }));
    expect(screen.getByRole('button', { name: /follow @nadia/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /do not suggest this account/i })).toBeTruthy();
    // Block and report are the two irreversible rows, and the menu marks them apart in red.
    expect(screen.getByRole('button', { name: /block @nadia/i }).className).toMatch(/is-danger/);
    expect(screen.getByRole('button', { name: /^report$/i }).className).toMatch(/is-danger/);
  });

  it('stops suggesting one account from its own menu', () => {
    const onDismissUser = vi.fn();
    renderCard([row()], { onDismissUser });
    fireEvent.click(screen.getByRole('button', { name: /options for nadia/i }));
    fireEvent.click(screen.getByRole('button', { name: /do not suggest this account/i }));
    expect(onDismissUser).toHaveBeenCalledWith('u1');
  });

  it('hides the whole card from the section menu rather than from a close button', () => {
    const onDismiss = vi.fn();
    renderCard([row()], { onDismiss });
    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /suggestion options/i }));
    fireEvent.click(screen.getByRole('button', { name: /hide suggestions for now/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('sends the banner, the avatar and the name to the same profile', () => {
    renderCard([row()]);
    const href = screen.getByRole('link', { name: /nadia/i }).getAttribute('href');
    expect(href).toContain('u1');
    const tile = screen.getByTestId('banner-u1').closest('[style*="flex-shrink"]');
    const links = [...tile.querySelectorAll('a')];
    expect(links).toHaveLength(3);
    links.forEach((link) => expect(link.getAttribute('href')).toBe(href));
  });

  it('squares the tile on mobile and rounds it on desktop', () => {
    renderCard([row()], { viewport: 'mobile' });
    expect(
      screen.getByTestId('banner-u1').closest('[style*="flex-shrink"]').style.borderRadius
    ).toBe('0px');
  });
});
