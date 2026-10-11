import { useQuery } from '@tanstack/react-query';

import { STALE_TIME } from '@/config/constants';

import { adminApi } from '../api/adminApi';
import { panelQueryRetry } from '../lib/pagination';
import { toIso } from '../lib/statistics';

/**
 * The stored snapshot.
 *
 * A five-minute `staleTime` and no polling. The collection job writes one bucket
 * every 30 minutes, so re-reading this faster than that returns the same numbers
 * and spends budget for nothing. Refreshing is left to an explicit control, so a
 * reviewer who wants to know whether a new bucket has landed can ask.
 *
 * `computedAt` being null is a state, not a failure: it means no bucket has ever
 * been collected. The caller renders that as its own thing and never as zeros.
 */
export function useCurrentStats() {
  const query = useQuery({
    queryKey: ['admin', 'stats', 'current'],
    queryFn: () => adminApi.getCurrentStats(),
    retry: panelQueryRetry,
    staleTime: STALE_TIME.MEDIUM,
  });

  const data = query.data ?? null;

  return {
    snapshot: data,
    /** True only when the server said nothing has ever been collected. */
    neverCollected: Boolean(data) && !data?.computedAt,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

/**
 * One metric's series over a committed window.
 *
 * The query key carries the committed range, so a request is issued when the
 * range is applied and never while it is being edited. `granularity` is sent
 * only when the caller has chosen one that the window actually supports; the
 * caller prevents the unsupported combination in its control, so the server's
 * refusal is never reached.
 *
 * The response restates the granularity the server used, which the caller reads
 * for the axis label rather than assuming its own request was honoured.
 */
export function useStatsTimeseries({
  metric,
  granularity,
  fromMs,
  toMs,
  enabled = true,
}: {
  metric: string;
  granularity?: string | null;
  fromMs: number;
  toMs: number;
  enabled?: boolean;
}) {
  const from = toIso(fromMs);
  const to = toIso(toMs);

  const query = useQuery({
    queryKey: ['admin', 'stats', 'timeseries', metric, granularity ?? 'auto', from, to],
    queryFn: () => adminApi.getStatsTimeseries({ metric, granularity, from, to }),
    enabled,
    retry: panelQueryRetry,
    staleTime: STALE_TIME.MEDIUM,
  });

  const data = query.data ?? null;

  return {
    series: data,
    points: data?.points ?? [],
    /** The granularity the server actually used, which may differ from the request. */
    resolvedGranularity: data?.granularity ?? granularity ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
