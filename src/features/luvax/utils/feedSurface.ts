/**
 * Where a post is being shown, as far as the viewer's feedback controls care.
 *
 * `following` and `for-you` are the two Home tabs, `explore` is the discovery grid and `other` is
 * everywhere else: profiles, hashtags, search, saved posts and a post opened from a link.
 * Distinct from the impression `surface` prop, which names the screen for analytics.
 */
export type FeedSurface = 'following' | 'for-you' | 'explore' | 'other';

/** Show fewer steers the recommendation lists only, so it is offered only beside them. */
export const offersShowFewer = (surface: FeedSurface | undefined) =>
  surface === 'for-you' || surface === 'explore';

/** Reads the surface a post detail was opened from out of the router state it was opened with. */
export const surfaceFromState = (state: unknown): FeedSurface => {
  const value = (state as { feedSurface?: unknown } | null | undefined)?.feedSurface;
  return value === 'following' || value === 'for-you' || value === 'explore' ? value : 'other';
};
