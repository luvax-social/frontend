import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { STALE_TIME } from '@/config/constants';
import { placeService } from '@/services/place.service';
import { getNextCursor } from '@/utils/helpers';

export const placeKeys = {
  all: ['place'],
  search: (q: string) => [...placeKeys.all, 'search', q],
  detail: (placeId: string | null | undefined) => [...placeKeys.all, 'detail', placeId],
  posts: (placeId: string | null | undefined) => [...placeKeys.all, 'posts', placeId],
};

/**
 * Searches the places registry as the person types.
 *
 * Query key `['place', 'search', q]`. A search shorter than two characters is not sent, because the
 * backend rejects a name that short and a one-letter search would match almost everything.
 */
export const usePlaceSearch = (q: string) => {
  const term = q.trim();
  return useQuery({
    queryKey: placeKeys.search(term),
    queryFn: ({ signal }) => placeService.searchPlaces({ q: term, limit: 6, signal }),
    enabled: term.length >= 2,
    staleTime: STALE_TIME.SHORT,
    refetchOnWindowFocus: false,
  });
};

/**
 * Reads one place for the location page header.
 *
 * Query key `['place', 'detail', placeId]`. A banned or deleted place answers 404, which the screen
 * shows as the unavailable state, so it is not retried.
 */
export const usePlace = (placeId: string | null | undefined) =>
  useQuery({
    queryKey: placeKeys.detail(placeId),
    queryFn: ({ signal }) => placeService.getPlace(placeId!, signal),
    enabled: Boolean(placeId),
    retry: false,
    staleTime: STALE_TIME.SHORT,
  });

/**
 * The published posts at one place, newest publication first.
 *
 * Query key `['place', 'posts', placeId]`; it sits under the same `place` prefix the post
 * invalidation helper clears, so publishing or removing a post refreshes the page.
 */
export const usePlacePosts = (placeId: string | null | undefined) =>
  useInfiniteQuery({
    queryKey: placeKeys.posts(placeId),
    queryFn: ({ pageParam = null, signal }) =>
      placeService.getPlacePosts(placeId!, { cursor: pageParam, limit: 12, signal }),
    getNextPageParam: getNextCursor,
    initialPageParam: null,
    enabled: Boolean(placeId),
    retry: false,
  });
