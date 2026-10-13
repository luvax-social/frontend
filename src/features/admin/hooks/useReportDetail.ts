import { useQuery } from '@tanstack/react-query';

import { STALE_TIME } from '@/config/constants';

import { adminApi } from '../api/adminApi';
import { panelQueryRetry } from '../lib/pagination';

/**
 * The report itself, for first paint. A moderator receives 404 once the report
 * is resolved or dismissed, which the detail screen renders as a calm
 * not-found; the retry policy does not retry that.
 */
export function useReportDetail(reportId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['admin', 'report', reportId],
    queryFn: () => adminApi.getReport(reportId!),
    enabled: Boolean(reportId),
    staleTime: STALE_TIME.SHORT,
    retry: panelQueryRetry,
  });

  return {
    report: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * The reported entity, loaded independently of the report so its region can
 * render on its own without blocking the report itself.
 */
export function useReportTarget(reportId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['admin', 'report-target', reportId],
    queryFn: () => adminApi.getReportTarget(reportId!),
    enabled: Boolean(reportId),
    staleTime: STALE_TIME.SHORT,
    retry: panelQueryRetry,
  });

  return {
    target: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
