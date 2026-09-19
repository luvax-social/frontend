import { describe, it, expect } from 'vitest';
import { toRow } from '@/features/luvax/hooks/useSuggestions';

const item = (overrides = {}) => ({
  user: {
    id: 'u1',
    username: 'nadia',
    displayName: 'Nadia',
    avatarUrl: null,
    isVerified: false,
  },
  viewerState: { isFollowing: false, isFollowRequested: false },
  ...overrides,
});

describe('toRow', () => {
  it('carries the banner url through', () => {
    expect(toRow(item({ bannerUrl: 'https://cdn.example/b.jpg' })).bannerUrl).toBe(
      'https://cdn.example/b.jpg'
    );
  });

  it('carries an absent banner as null, not undefined', () => {
    expect(toRow(item()).bannerUrl).toBeNull();
  });

  it('carries the follower count through', () => {
    expect(toRow(item({ followerCount: 1240 })).followerCount).toBe(1240);
  });

  it('falls back to zero when the payload predates the follower count', () => {
    expect(toRow(item()).followerCount).toBe(0);
  });

  it('keeps a pending request distinct from a follow', () => {
    const row = toRow(item({ viewerState: { isFollowing: false, isFollowRequested: true } }));
    expect(row.isFollowing).toBe(false);
    expect(row.isFollowRequested).toBe(true);
  });
});
