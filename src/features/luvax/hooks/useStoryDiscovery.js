import { useQuery } from '@tanstack/react-query';

import { storyService } from '@/services/story.service';
import { STALE_TIME } from '@/config/constants';

export const storyDiscoveryKeys = {
  all: ['storyDiscovery'],
  list: (limit) => [...storyDiscoveryKeys.all, limit],
};

/**
 * Stories from suggested accounts the viewer does not follow.
 *
 * Query key `['storyDiscovery', limit]`, deliberately separate from the `storyFeed` key rather than
 * an extension of it. That key holds the viewer's own followed accounts and is invalidated by story
 * create, delete and like mutations; folding strangers into it would have those mutations refetch
 * discovery too, for no gain.
 *
 * SHORT staleness, matching `useStoryFeed`: stories expire in 24 hours and a stale entry is a tile
 * that opens onto nothing.
 *
 * @param {number} [limit] - How many authors to request.
 * @returns {{entries: Array<Object>, isLoading: boolean, isError: boolean}} Tray entries, empty
 *   until loaded.
 */
export const useStoryDiscovery = (limit = 8) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: storyDiscoveryKeys.list(limit),
    queryFn: ({ signal }) => storyService.getStoryDiscovery(limit, signal),
    staleTime: STALE_TIME.SHORT,
  });
  return { entries: data?.data ?? [], isLoading, isError };
};
