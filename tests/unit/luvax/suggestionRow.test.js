import { describe, it, expect } from 'vitest';
import { toRow, reasonFor } from '@/features/luvax/hooks/useSuggestions';

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

describe('reasonFor', () => {
  it('maps each source label to its copy', () => {
    expect(reasonFor('graph')).toBe('followed by people you follow');
    expect(reasonFor('gorse')).toBe('similar to accounts you follow');
    expect(reasonFor('affinity')).toBe("posts you've engaged with");
  });

  it('prefers the strongest label when several are present', () => {
    expect(reasonFor('affinity,graph')).toBe('followed by people you follow');
    expect(reasonFor('affinity,gorse')).toBe('similar to accounts you follow');
  });

  it('tolerates whitespace around the labels', () => {
    expect(reasonFor('affinity, graph')).toBe('followed by people you follow');
  });

  it('returns null for a cold-start row so the line is omitted', () => {
    expect(reasonFor(null)).toBeNull();
    expect(reasonFor(undefined)).toBeNull();
    expect(reasonFor('')).toBeNull();
  });

  it('returns null for a label it does not recognise rather than showing it raw', () => {
    expect(reasonFor('somethingnew')).toBeNull();
  });
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

  it('resolves the reason from the source labels', () => {
    expect(toRow(item({ sources: 'graph' })).reason).toBe('followed by people you follow');
  });

  it('leaves the reason null when the row was never precomputed', () => {
    expect(toRow(item()).reason).toBeNull();
  });

  it('keeps a pending request distinct from a follow', () => {
    const row = toRow(item({ viewerState: { isFollowing: false, isFollowRequested: true } }));
    expect(row.isFollowing).toBe(false);
    expect(row.isFollowRequested).toBe(true);
  });
});
