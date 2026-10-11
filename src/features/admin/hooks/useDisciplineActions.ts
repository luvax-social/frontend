import type { AdminWarnUserRequest, AdminActionRequest } from '@/types/admin';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/adminApi';

/**
 * The disciplinary mutations performed against an account: issuing a warning,
 * and (administrator only) revoking a warning or a strike.
 *
 * Every mutation invalidates the account's violation history on success, so the
 * new warning appears and a revoked record leaves the list without a reload. A
 * revoked record is removed by the backend rather than marked, so the refetch is
 * what makes the revocation visible; the revocation itself is preserved in the
 * action log (see discipline-contract-verification.md 4.1.5).
 *
 * Mutations do not auto-retry, so a 429 never becomes a burst.
 *
 * @param {string} userId the account these mutations act on, for cache invalidation
 */
export function useDisciplineActions(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  const invalidateHistory = () => {
    // Invalidated by prefix so both role variants of the account's history and
    // the account's own action log refetch, regardless of which is mounted.
    queryClient.invalidateQueries({ queryKey: ['admin', 'violations'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'actions'] });
  };

  const warn = useMutation({
    mutationFn: ({ reasonKey, note }: AdminWarnUserRequest) =>
      adminApi.warnUser(userId!, { reasonKey, note }),
    onSuccess: invalidateHistory,
  });

  const revokeWarning = useMutation({
    mutationFn: ({ warningId, reason }: AdminActionRequest & { warningId: string }) =>
      adminApi.revokeWarning(warningId, { reason }),
    onSuccess: invalidateHistory,
  });

  const revokeStrike = useMutation({
    mutationFn: ({ strikeId, reason }: AdminActionRequest & { strikeId: string }) =>
      adminApi.revokeStrike(strikeId, { reason }),
    onSuccess: invalidateHistory,
  });

  return { warn, revokeWarning, revokeStrike };
}
