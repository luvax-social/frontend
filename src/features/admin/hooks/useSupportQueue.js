import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import { supportAdminApi } from '../api/supportAdminApi';
import { listQueryKey, panelQueryRetry } from '../lib/pagination';

const PAGE_SIZE = 20;
const MAX_LIMIT = 100;

/**
 * The staff support queue.
 *
 * This endpoint is not cursor-paginated: it answers a plain list bounded by
 * `limit`, with a server-side ceiling of 100. `LoadMore` is driven by asking
 * for a larger window rather than by carrying a cursor, and the same
 * `hasNextPage` / `fetchNextPage` shape is exposed so the console's list looks
 * like every other one in the panel.
 *
 * `hasNextPage` is inferred from the window being full, which is the only
 * signal available here. A final page that happens to be exactly full shows one
 * more "load more" that returns nothing new; that is the honest cost of a
 * limit-only endpoint and is preferable to hiding rows that do exist.
 */
export const useSupportQueue = ({ status }) => {
  const role = useAuthStore((state) => state.role);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const query = useQuery({
    queryKey: listQueryKey('support-tickets', role, { status, limit }),
    queryFn: () => supportAdminApi.listTickets({ status: status || undefined, limit }),
    retry: panelQueryRetry,
    // A stale queue is actively misleading here: a ticket another reviewer
    // claimed a moment ago must not still read as available.
    staleTime: 0,
  });

  const rows = query.data ?? [];
  const hasNextPage = rows.length >= limit && limit < MAX_LIMIT;

  const fetchNextPage = useCallback(() => {
    setLimit((current) => Math.min(current + PAGE_SIZE, MAX_LIMIT));
  }, []);

  return {
    rows,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    hasNextPage,
    isFetchingNextPage: query.isFetching && !query.isLoading,
    fetchNextPage,
  };
};

/** One ticket, read fresh so a claim taken elsewhere is visible immediately. */
export const useSupportTicket = (ticketId) =>
  useQuery({
    queryKey: ['admin', 'support-ticket', ticketId],
    queryFn: () => supportAdminApi.getTicket(ticketId),
    enabled: Boolean(ticketId),
    retry: panelQueryRetry,
    staleTime: 0,
  });

/** The structured verification request behind a verification ticket. */
export const useVerificationRequest = (ticketId, enabled) =>
  useQuery({
    queryKey: ['admin', 'verification-request', ticketId],
    queryFn: () => supportAdminApi.getVerificationRequest(ticketId),
    enabled: Boolean(ticketId) && enabled,
    retry: panelQueryRetry,
  });

/**
 * The console's mutations.
 *
 * Every one invalidates both the open ticket and the queue, because each
 * changes `status`, which is the field the queue filters on. The queue screen
 * additionally follows the ticket when a claim moves it out of the current
 * filter, so the reviewer is not left looking at an empty list.
 */
export const useSupportTicketActions = (ticketId) => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'support-ticket', ticketId] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'support-tickets'] });
  };

  return {
    claim: useMutation({
      mutationFn: () => supportAdminApi.claimTicket(ticketId),
      onSettled: invalidate,
    }),
    respond: useMutation({
      mutationFn: (payload) => supportAdminApi.respondToTicket(ticketId, payload),
      onSettled: invalidate,
    }),
    escalate: useMutation({
      mutationFn: (payload) => supportAdminApi.escalateTicket(ticketId, payload),
      onSettled: invalidate,
    }),
    approveVerification: useMutation({
      mutationFn: (payload) => supportAdminApi.approveVerification(ticketId, payload),
      onSettled: invalidate,
    }),
    rejectVerification: useMutation({
      mutationFn: (payload) => supportAdminApi.rejectVerification(ticketId, payload),
      onSettled: invalidate,
    }),
  };
};
