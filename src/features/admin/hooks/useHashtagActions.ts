import type {
  AdminCreateHashtagRequest,
  AdminUpdateHashtagRequest,
  AdminDeleteHashtagRequest,
} from '@/types/admin';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/adminApi';

/**
 * The hashtag registry mutations: create, status transition, and delete.
 *
 * Create returns an audit action, not the hashtag; the new hashtag's identifier
 * is read from the action's `targetEntityId` (see
 * accounts-contract-verification.md 3.4). Every mutation invalidates the registry
 * lists and searches so the change appears without a reload, and the action log,
 * because each writes an admin action. None auto-retries.
 */
export function useHashtagActions() {
  const queryClient = useQueryClient();

  const afterAction = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'hashtags'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'hashtag-search'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'actions'] });
  };

  const create = useMutation({
    mutationFn: ({ name, status, note }: AdminCreateHashtagRequest) =>
      adminApi.createHashtag({ name, status, note }),
    onSuccess: afterAction,
  });
  const update = useMutation({
    mutationFn: ({ hashtagId, status, note }: AdminUpdateHashtagRequest & { hashtagId: string }) =>
      adminApi.updateHashtag(hashtagId, { status, note }),
    onSuccess: afterAction,
  });
  const remove = useMutation({
    mutationFn: ({ hashtagId, reason }: AdminDeleteHashtagRequest & { hashtagId: string }) =>
      adminApi.deleteHashtag(hashtagId, { reason }),
    onSuccess: afterAction,
  });

  return { create, update, remove };
}
