import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/useAuthStore';
import { isAdminRole } from '@/config/roles';

import { adminApi } from '../api/adminApi';
import { panelQueryRetry } from '../lib/pagination';

const POLL_MS = 60_000;

/**
 * The escalated-report counter for the navigation badge, polled every sixty
 * seconds. The query is gated on the administrator role: a moderator produces
 * zero requests to this endpoint, which returns 403 for a moderator and would
 * otherwise fire a failing request every minute.
 */
export function useEscalatedCount() {
  const role = useAuthStore((state) => state.role);
  const enabled = isAdminRole(role);

  const query = useQuery({
    queryKey: ['admin', 'escalated-count'],
    queryFn: () => adminApi.getEscalatedCount(),
    enabled,
    refetchInterval: enabled ? POLL_MS : false,
    refetchIntervalInBackground: false,
    staleTime: POLL_MS,
    retry: panelQueryRetry,
  });

  return {
    count: query.data ?? 0,
    isEnabled: enabled,
  };
}
