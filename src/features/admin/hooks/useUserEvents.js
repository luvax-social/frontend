import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/useAuthStore';
import { STALE_TIME } from '@/config/constants';

import { adminApi } from '../api/adminApi';
import { getNextPageParam, listQueryKey, panelQueryRetry } from '../lib/pagination';
import { toIso } from '../lib/statistics';

const PAGE_LIMIT = 20;

/**
 * The event types the application writes unconditionally, in every deployment.
 *
 * Read from the backend source, not from the OpenAPI enumeration. The
 * `event_type` database enum declares twenty values; `UserEventRecorder` writes
 * exactly these three. Generating this list from the enumeration would offer
 * seventeen filters that can never return a row, and an administrator who tried
 * one would conclude the log was broken.
 */
const UNCONDITIONAL_EVENT_TYPES = [
  {
    key: 'session_start',
    label: 'session start',
    hint: 'written when a sign-in issues a session',
  },
  {
    key: 'search',
    label: 'search',
    hint: 'written on either search surface; carries the term and the surface',
  },
  {
    key: 'profile_view',
    label: 'profile view',
    hint: "written when one account views another's profile; viewing one's own records nothing",
  },
];

/**
 * Six more types, written by the recommendation feedback consumer for each
 * engagement event it receives.
 *
 * The consumer runs wherever the service it feeds runs, and the production
 * profile enables it, so all six write rows in production as well as in
 * development. Verified by producing each one against a production-shaped stack
 * (production profile, real Gorse, ClickHouse behind the outbox) and reading the
 * log back, not inferred from configuration.
 */
const ENGAGEMENT_EVENT_TYPES = [
  {
    key: 'post_like',
    label: 'post like',
    hint: 'written when an account likes a post',
  },
  {
    key: 'post_save',
    label: 'post save',
    hint: 'written when an account saves a post',
  },
  {
    key: 'post_view',
    label: 'post view',
    hint: 'written when a post view is registered',
  },
  {
    key: 'post_comment',
    label: 'post comment',
    hint: 'written when an account comments on a post',
  },
  {
    key: 'comment_like',
    label: 'comment like',
    hint: 'written when an account likes a comment',
  },
  {
    key: 'post_share',
    label: 'post share',
    hint: 'written when an account shares a post in a message',
  },
];

/**
 * The event types worth offering as a filter: every type the application writes.
 *
 * The `event_type` enumeration declares twenty values and most have no writer,
 * so offering all of them would offer filters that can never match.
 */
export const WRITTEN_EVENT_TYPES = [...UNCONDITIONAL_EVENT_TYPES, ...ENGAGEMENT_EVENT_TYPES];

/**
 * One account's behavioural events, or every account's when `userId` is omitted.
 *
 * The query is disabled until a range has been committed, which is what makes
 * the screen's "no request until both bounds are set" rule true at the network
 * level rather than only in the interface: both bounds are mandatory and the
 * server answers a request missing either with 400, so the panel does not
 * compose one.
 *
 * The query key carries the range and the filters, so applying a new range or
 * changing the event type starts a fresh cursor sequence rather than replaying
 * one scoped to the previous query.
 */
export function useUserEvents({ userId, range, eventType }) {
  const role = useAuthStore((state) => state.role);
  const enabled = Boolean(range?.fromMs && range?.toMs);

  const from = enabled ? toIso(range.fromMs) : undefined;
  const to = enabled ? toIso(range.toMs) : undefined;

  const query = useInfiniteQuery({
    queryKey: listQueryKey('user-events', role, {
      userId: userId ?? null,
      from: from ?? null,
      to: to ?? null,
      eventType: eventType || null,
    }),
    queryFn: ({ pageParam }) =>
      adminApi.getUserEvents({
        userId: userId || undefined,
        from,
        to,
        eventType: eventType || undefined,
        cursor: pageParam,
        limit: PAGE_LIMIT,
      }),
    initialPageParam: undefined,
    getNextPageParam,
    enabled,
    retry: panelQueryRetry,
    staleTime: STALE_TIME.SHORT,
  });

  const rows = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page?.content ?? []),
    [query.data]
  );

  return {
    rows,
    enabled,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: Boolean(query.hasNextPage),
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
  };
}
