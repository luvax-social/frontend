import type {
  AdminActionRequest,
  AdminSuspendUserRequest,
  AdminRoleChangeRequest,
} from '@/types/admin';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api/adminApi';
import { accountDetailKey } from './useAccountDetail';

/**
 * The lifecycle mutations performed against an account: ban, unban, suspend,
 * unsuspend, role change, and force logout.
 *
 * After any action succeeds the account detail is refetched before the caller
 * resolves, because what is legal changed: capabilities and status both live on
 * the detail, and no action response carries them. Awaiting the refetch inside
 * `onSuccess` means the controls re-render against fresh capabilities rather than
 * the pre-action ones. The account list and the action log are invalidated too,
 * so a row's status and the audit trail reflect the action without a reload.
 *
 * No mutation auto-retries, so a 429 never becomes a burst.
 *
 * @param {string} userId the account these mutations act on
 */
export function useAccountActions(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  const afterAction = async () => {
    // Await the detail refetch so capabilities are fresh before the controls
    // re-render; invalidate the list and log by prefix so any mounted variant
    // reflects the new state.
    await queryClient.invalidateQueries({ queryKey: accountDetailKey(userId!) });
    queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'account-search'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'actions'] });
  };

  const ban = useMutation({
    mutationFn: ({ reason }: AdminActionRequest) => adminApi.banUser(userId!, { reason }),
    onSuccess: afterAction,
  });
  const unban = useMutation({
    mutationFn: ({ reason }: AdminActionRequest) => adminApi.unbanUser(userId!, { reason }),
    onSuccess: afterAction,
  });
  const suspend = useMutation({
    mutationFn: ({ reason, durationDays }: AdminSuspendUserRequest) =>
      adminApi.suspendUser(userId!, { reason, durationDays }),
    onSuccess: afterAction,
  });
  const unsuspend = useMutation({
    mutationFn: ({ reason }: AdminActionRequest) => adminApi.unsuspendUser(userId!, { reason }),
    onSuccess: afterAction,
  });
  const changeRole = useMutation({
    mutationFn: ({ role, reason }: AdminRoleChangeRequest) =>
      adminApi.changeUserRole(userId!, { role, reason }),
    onSuccess: afterAction,
  });
  const forceLogout = useMutation({
    mutationFn: ({ reason }: AdminActionRequest) => adminApi.forceLogout(userId!, { reason }),
    onSuccess: afterAction,
  });

  /**
   * End one session and leave the account's others alone.
   *
   * The server answers 200 whether or not the session was already revoked, so a
   * double click cannot produce an error. `metadata.alreadyRevoked` tells the
   * two apart, which is the only way the panel can avoid reporting that it just
   * ended a live session when the second click ended nothing.
   */
  const revokeSession = useMutation({
    mutationFn: ({ sessionId, reason }: AdminActionRequest & { sessionId: string }) =>
      adminApi.revokeSession(userId!, sessionId, { reason }),
    onSuccess: afterAction,
  });

  return { ban, unban, suspend, unsuspend, changeRole, forceLogout, revokeSession };
}
