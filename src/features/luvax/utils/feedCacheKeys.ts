/**
 * The two cached recommendation lists, keyed `['recommendedFeed', excludeFollowed]`: For You
 * (`false`) and the discovery list behind Explore (`true`). Anything that changes what the
 * recommender may show invalidates both.
 */
export const RECOMMENDED_FEED_KEYS = [
  ['recommendedFeed', false],
  ['recommendedFeed', true],
];
