import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { publicClient } from '@/api/axiosClient';
import { STALE_TIME } from '@/config/constants';
import * as supportApi from '../services/supportApi';
import { isRateLimited } from '../utils/supportErrors';

/**
 * Server state for the help centre.
 *
 * The anonymous queries never retry a rate-limited call, for the reason the
 * panel gives: a burst retried becomes a longer burst. They also do not retry a
 * spent single-use token, which is a terminal answer rather than a transient
 * failure.
 */

const supportKeys = {
  ownTickets: ['support', 'tickets', 'own'],
  ticket: (ticketId) => ['support', 'tickets', ticketId],
  categories: ['support', 'categories'],
  publicCategories: ['support', 'categories', 'public'],
  verificationCategories: ['support', 'verification', 'categories'],
  verificationState: ['support', 'verification', 'me'],
};

const noRetryOnRateLimit = (failureCount, error) => {
  if (isRateLimited(error)) {
    return false;
  }
  return failureCount < 1;
};

/** The caller's own tickets, newest first. */
export const useOwnTickets = () =>
  useQuery({
    queryKey: supportKeys.ownTickets,
    queryFn: () => supportApi.listOwnTickets({ limit: 20 }),
    staleTime: STALE_TIME.SHORT,
    retry: noRetryOnRateLimit,
  });

/** One of the caller's own tickets. */
export const useOwnTicket = (ticketId) =>
  useQuery({
    queryKey: supportKeys.ticket(ticketId),
    queryFn: () => supportApi.getOwnTicket(ticketId),
    enabled: Boolean(ticketId),
    retry: noRetryOnRateLimit,
  });

/**
 * The support categories, from the vocabulary endpoint.
 *
 * Not a hardcoded list: adding or disabling a category is a backend change and
 * the selector follows it. Appeal categories are filtered out here rather than
 * server-side, because the same vocabulary serves the staff console, which does
 * need them.
 */
export const useSupportCategories = () =>
  useQuery({
    queryKey: supportKeys.categories,
    queryFn: supportApi.listSupportCategories,
    staleTime: STALE_TIME.LONG,
    retry: noRetryOnRateLimit,
    select: (rows) => (rows ?? []).filter((row) => row.isEnabled && !row.isAppeal),
  });

/**
 * The categories the anonymous public form may offer.
 *
 * Its own endpoint rather than the config vocabulary, which requires a session
 * the submitter on this path does not have.
 */
export const usePublicSupportCategories = () =>
  useQuery({
    queryKey: supportKeys.publicCategories,
    queryFn: async () => {
      const response = await publicClient.get('/support/public/categories');
      return response?.data?.data ?? [];
    },
    staleTime: STALE_TIME.LONG,
    retry: noRetryOnRateLimit,
  });

/** The eight verification categories, with their icon keys. */
export const useVerificationCategories = () =>
  useQuery({
    queryKey: supportKeys.verificationCategories,
    queryFn: supportApi.listVerificationCategories,
    staleTime: STALE_TIME.LONG,
    retry: noRetryOnRateLimit,
  });

/** The caller's verification state: an active grant, an open request, or neither. */
export const useVerificationState = () =>
  useQuery({
    queryKey: supportKeys.verificationState,
    queryFn: supportApi.getVerificationState,
    staleTime: STALE_TIME.SHORT,
    retry: noRetryOnRateLimit,
  });

/** Opens a ticket as the signed-in account. */
export const useCreateTicket = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supportApi.createTicket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.ownTickets });
    },
  });
};

/** Submits a verification request, which also creates its ticket. */
export const useCreateVerificationRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supportApi.createVerificationRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.ownTickets });
      queryClient.invalidateQueries({ queryKey: supportKeys.verificationState });
    },
  });
};

/**
 * Redeems a signed appeal link.
 *
 * No cache invalidation, deliberately. This runs for a signed-out account with
 * no query cache to update, and touching an authenticated key here would be the
 * first step towards the auth-store dependency this path must not have.
 */
export const useCreateAppeal = () =>
  useMutation({
    mutationFn: supportApi.createAppeal,
    retry: false,
  });

/**
 * Checks an appeal link before the form is shown, without redeeming it.
 *
 * A query rather than a mutation, because it is a read and the screen runs it on
 * mount. It never retries: a spent or unknown token is a terminal answer, and
 * retrying a rate-limited call only lengthens the burst.
 *
 * @param {string} token the token from the link, or empty to skip the call
 * @returns {Object} the TanStack query for the link's validity
 */
export const useValidateAppealLink = (token) =>
  useQuery({
    queryKey: ['support', 'appeal', 'validate', token],
    queryFn: () => supportApi.validateAppealLink(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: STALE_TIME.SHORT ?? 0,
    refetchOnWindowFocus: false,
  });

/**
 * Reads one appeal with a status token, for an appellant holding no session.
 *
 * A query rather than a mutation: it is a read, the screen runs it on mount,
 * and it never spends the token. It does not retry a terminal answer - an
 * unknown or expired token is not a transient failure - nor a rate-limited one.
 *
 * @param {string} token the token from the status link, or empty to skip the call
 * @returns {Object} the TanStack query for the appeal
 */
export const useAppealStatus = (token) =>
  useQuery({
    queryKey: ['support', 'appeal', 'status', token],
    queryFn: () => supportApi.readAppealStatus(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: STALE_TIME.SHORT ?? 0,
    refetchOnWindowFocus: false,
  });

/**
 * Asks for a replacement appeal link.
 *
 * No cache invalidation and no auth-store access, for the same reason
 * `useCreateAppeal` has none: this runs for an account that cannot hold a
 * session.
 */
export const useResendAppealLink = () =>
  useMutation({
    mutationFn: supportApi.resendAppealLink,
    retry: false,
  });

/**
 * Opens an appeal from a session, against a decision the caller owns.
 *
 * The signed-link counterpart to this is `useCreateAppeal`. This one runs for
 * somebody who never lost access, so it uses the authenticated client and
 * refreshes the ticket list the new appeal now appears in.
 */
export const useCreateInProductAppeal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supportApi.createInProductAppeal,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.ownTickets });
    },
  });
};

/** Submits the anonymous public form. */
export const useCreatePublicTicket = () =>
  useMutation({
    mutationFn: supportApi.createPublicTicket,
    retry: false,
  });

/** Confirms the address a public submission named. */
export const useConfirmPublicTicket = () =>
  useMutation({
    mutationFn: supportApi.confirmPublicTicket,
    retry: false,
  });
