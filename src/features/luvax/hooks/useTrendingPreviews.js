import { useQuery } from '@tanstack/react-query';

import * as hashtagService from '@/services/hashtag.service';
import { STALE_TIME } from '@/config/constants';

export const trendingPreviewKeys = {
  all: ['trendingPreviews'],
  list: (size, scope) => [...trendingPreviewKeys.all, size, scope],
};

/**
 * Trending hashtags with one cover image each, for the in-feed trending card.
 *
 * Query key `['trendingPreviews', size, scope]`. Nothing invalidates it: `hashtag_trending` is a
 * periodic snapshot written by a scheduled job, so refetching faster than that job runs would only
 * redraw the same rows. MEDIUM staleness is chosen to match.
 *
 * @param {number} [size] - How many hashtags to request.
 * @param {string} [scope] - `for-you` or `platform`.
 * @returns {{data: Array<Object>, isLoading: boolean, isError: boolean}} Rows, empty until loaded.
 */
export const useTrendingPreviews = (size = 3, scope = 'for-you') => {
  const { data, isLoading, isError } = useQuery({
    queryKey: trendingPreviewKeys.list(size, scope),
    queryFn: ({ signal }) => hashtagService.getTrendingPreviews(size, scope, signal),
    staleTime: STALE_TIME.MEDIUM,
  });
  return { data: data?.data ?? [], isLoading, isError };
};
