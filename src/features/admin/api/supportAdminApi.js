import { axiosClient } from '@/api/axiosClient';
import { buildBody, pickParams } from '@/utils/requestContract';

/**
 * The staff-facing support endpoints.
 *
 * Every query string goes through `pickParams` and every body through
 * `buildBody`: these routes carry `@StrictQueryParameters`, so an undeclared
 * parameter is a 400 rather than something the server quietly ignores.
 */

const unwrap = (response) => response?.data?.data;

/** The exact query parameters `GET /admin/support/tickets` declares. */
const QUEUE_QUERY_KEYS = ['status', 'limit'];

export const supportAdminApi = {
  /**
   * The staff queue.
   *
   * Not cursor-paginated: this endpoint answers a plain list bounded by
   * `limit`, so the console pages by asking for a larger window rather than by
   * carrying a cursor. `pending_confirmation` is excluded server-side, so an
   * unconfirmed public submission never appears here.
   */
  listTickets: async ({ status, limit = 20 }) =>
    unwrap(
      await axiosClient.get('/admin/support/tickets', {
        params: pickParams({ status, limit }, QUEUE_QUERY_KEYS),
      })
    ),

  /** One ticket, including its internal note, which is staff-only. */
  getTicket: async (ticketId) =>
    unwrap(await axiosClient.get(`/admin/support/tickets/${ticketId}`)),

  /**
   * Takes ownership of an unassigned ticket.
   *
   * The server re-checks `assigned_to IS NULL AND status = 'open'` in the
   * update predicate, so two staff claiming at once produce one winner and one
   * `SUPPORT_TICKET_ALREADY_CLAIMED`.
   */
  claimTicket: async (ticketId) =>
    unwrap(await axiosClient.post(`/admin/support/tickets/${ticketId}/claim`)),

  /**
   * Answers a ticket, or closes it as rejected.
   *
   * `reject` is a query parameter rather than a body field, matching the
   * endpoint. The internal note is sent alongside the response and never
   * reaches the requester: it is absent from the owner-facing DTO and from the
   * mail metadata map.
   */
  respondToTicket: async (ticketId, { staffResponse, internalNote, reject = false }) =>
    unwrap(
      await axiosClient.post(
        `/admin/support/tickets/${ticketId}/respond`,
        buildBody({ staffResponse, internalNote }),
        { params: pickParams({ reject }, ['reject']) }
      )
    ),

  /** Hands a ticket up to an administrator. Open to both staff roles. */
  escalateTicket: async (ticketId, { reason }) =>
    unwrap(
      await axiosClient.patch(`/admin/support/tickets/${ticketId}/escalate`, buildBody({ reason }))
    ),

  /** The structured verification request behind a verification ticket. */
  getVerificationRequest: async (ticketId) =>
    unwrap(await axiosClient.get(`/admin/verification/requests/${ticketId}`)),

  /** Grants the badge and closes the ticket. */
  approveVerification: async (ticketId, { reason, internalNote }) =>
    unwrap(
      await axiosClient.post(
        `/admin/verification/requests/${ticketId}/approve`,
        buildBody({ reason, internalNote })
      )
    ),

  /** Refuses the request and closes the ticket. */
  rejectVerification: async (ticketId, { reason, internalNote }) =>
    unwrap(
      await axiosClient.post(
        `/admin/verification/requests/${ticketId}/reject`,
        buildBody({ reason, internalNote })
      )
    ),
};
