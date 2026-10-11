import type { SuggestedUserResponse } from '@/types/domain';
import { describe, it, expect } from 'vitest';
import { toRow } from '@/features/luvax/hooks/useSuggestions';

const item = (overrides: Partial<SuggestedUserResponse> = {}) => ({
  bannerUrl: null,
  followerCount: 0,
  sources: null,
  user: {
    verifiedCategory: null,
    id: 'u1',
    username: 'nadia',
    displayName: 'Nadia',
    avatarUrl: null,
    isVerified: false,
  },
  viewerState: {
    isFollowedBy: false,
    isBlocking: false,
    hasReported: false,
    isFollowing: false,
    isFollowRequested: false,
  },
  ...overrides,
});

describe('toRow', () => {
  it('carries the banner url through', () => {
    expect(toRow(item({ bannerUrl: 'https://cdn.example/b.jpg' })).bannerUrl).toBe(
      'https://cdn.example/b.jpg'
    );
  });

  it('carries an absent banner as null, not undefined', () => {
    const legacy = item();
    // Deliberately emulate a legacy payload without weakening the current wire DTO.
    Reflect.deleteProperty(legacy, 'bannerUrl');
    expect(legacy).not.toHaveProperty('bannerUrl');
    expect(toRow(legacy).bannerUrl).toBeNull();
  });

  it('carries the follower count through', () => {
    expect(toRow(item({ followerCount: 1240 })).followerCount).toBe(1240);
  });

  it('falls back to zero when the payload predates the follower count', () => {
    const legacy = item();
    Reflect.deleteProperty(legacy, 'followerCount');
    expect(legacy).not.toHaveProperty('followerCount');
    expect(toRow(legacy).followerCount).toBe(0);
  });

  it('keeps a pending request distinct from a follow', () => {
    const row = toRow(
      item({
        viewerState: {
          isFollowedBy: false,
          isBlocking: false,
          hasReported: false,
          isFollowing: false,
          isFollowRequested: true,
        },
      })
    );
    expect(row.isFollowing).toBe(false);
    expect(row.isFollowRequested).toBe(true);
  });
});
