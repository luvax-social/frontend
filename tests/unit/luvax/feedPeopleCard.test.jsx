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
  reason: 'followed by people you follow',
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
  it('renders nothing when there are no rows', () => {
    const { container } = renderCard([]);
    expect(container.firstChild).toBeNull();
  });

  it('shows the reason line', () => {
    renderCard([row()]);
    expect(screen.getByText('followed by people you follow')).toBeTruthy();
  });

  it('omits the reason line entirely when there is no reason', () => {
    renderCard([row({ reason: null })]);
    expect(screen.queryByTestId('reason-u1')).toBeNull();
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
