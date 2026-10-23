import type { AdminUpdatePlaceRequest } from '@/types/admin';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/adminApi';

/**
 * The place registry mutation: move a place to active, banned or deleted.
 *
 * The response is the audit action. Success refreshes the registry lists and searches and the
 * action log, because every change writes an audit row, and the report queue, because a report the
 * action resolved changes state in the same transaction. Nothing auto-retries.
 */
export function usePlaceActions() {
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: ({ placeId, ...body }: AdminUpdatePlaceRequest & { placeId: string }) =>
      adminApi.updatePlace(placeId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'places'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'place-search'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'actions'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'report'] });
      queryClient.invalidateQueries({ queryKey: ['place'] });
    },
  });

  return { update };
}
