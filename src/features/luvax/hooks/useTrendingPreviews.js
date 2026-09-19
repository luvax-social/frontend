import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import * as hashtagService from '@/services/hashtag.service';
import { STALE_TIME } from '@/config/constants';

/**
 * How many trending hashtags to pull. The endpoint caps at 10; the card shows three of them.
 */
const POOL_SIZE = 10;

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
 * @param {number} [show] - How many hashtags the card renders, taken from a deeper pool.
 * @param {string} [scope] - `for-you` or `platform`.
 * @returns {{data: Array<Object>, isLoading: boolean, isError: boolean}} Rows, empty until loaded.
 */
export const useTrendingPreviews = (show = 3, scope = 'for-you') => {
  // Asking for the top three every time is what made the card feel like it suggested the same
  // handful of busy tags forever. The endpoint is asked for a deeper pool and the card shows a
  // window into it, so a tag ranked seventh gets shown as readily as the one ranked first.
  const { data, isLoading, isError } = useQuery({
    queryKey: trendingPreviewKeys.list(POOL_SIZE, scope),
    queryFn: ({ signal }) => hashtagService.getTrendingPreviews(POOL_SIZE, scope, signal),
    staleTime: STALE_TIME.MEDIUM,
  });

  // A lazy initialiser, so the offset is drawn once when the hook mounts rather than on every
  // render: the card must not reshuffle under the reader while they are looking at it, and a new
  // visit should still land on a different window.
  const [offset] = useState(() => Math.floor(Math.random() * POOL_SIZE));

  const pool = data?.data ?? [];
  const rows = useMemo(() => {
    if (pool.length <= show) return pool;
    // Wraps, so a window starting near the end of the pool still returns a full card.
    return Array.from({ length: show }, (_, i) => pool[(offset + i) % pool.length]);
  }, [pool, show, offset]);

  return { data: rows, isLoading, isError };
};
