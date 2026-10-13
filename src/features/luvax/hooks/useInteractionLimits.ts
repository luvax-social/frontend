import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as userService from '@/services/user.service';
import type { InteractionLimitResponse, UpdateInteractionLimitRequest } from '@/types/domain';
import { unwrapApiResponse } from '@/utils/unwrapApiResponse';

const interactionLimitsKey = ['users', 'me', 'interactionLimits'];

/**
 * The caller's interaction limit and whether it is in force right now.
 *
 * Query key `['users', 'me', 'interactionLimits']`. The cache holds the response envelope and the
 * hook returns its `data`. `useSetInteractionLimit` writes the server's answer into it and
 * `useClearInteractionLimit` invalidates it.
 */
export const useMyInteractionLimit = () =>
  useQuery({
    queryKey: interactionLimitsKey,
    queryFn: () => userService.getMyInteractionLimit(),
    select: (envelope) => unwrapApiResponse<InteractionLimitResponse>(envelope),
  });

/**
 * Turns the limit on for a preset number of days.
 *
 * Not optimistic: the server computes the end time from the duration, and a client clock must not
 * decide when protection stops, so the cache takes the response and nothing before it.
 */
export const useSetInteractionLimit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateInteractionLimitRequest) =>
      userService.setMyInteractionLimit(request),
    onSuccess: (response) => queryClient.setQueryData(interactionLimitsKey, response),
  });
};

/**
 * Turns the limit off before it expires.
 *
 * Not optimistic: the mutation stays pending until the refetch that follows the 204 has returned
 * the server's own state, so the screen never shows the limit as off ahead of the server.
 */
export const useClearInteractionLimit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => userService.clearMyInteractionLimit(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: interactionLimitsKey }),
  });
};
