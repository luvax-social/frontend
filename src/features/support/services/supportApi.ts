import type { AxiosResponse } from 'axios';
import type { ApiResponse } from '@/types/api';
import type { VocabularyResponse } from '@/types/domain';
import type {
  CreateSupportTicketRequest,
  SupportTicketResponse,
  SignedAppealRequest,
  AppealSubmittedResponse,
  InProductAppealRequest,
  ResendAppealLinkRequest,
  AppealLinkResponse,
  PublicSupportTicketRequest,
  VerificationCategoryResponse,
  VerificationStateResponse,
  CreateVerificationRequest,
} from '@/types/support';
import { axiosClient, publicClient } from '@/api/axiosClient';
import { buildBody, pickParams } from '@/utils/requestContract';

/**
 * The support module's wire layer.
 *
 * Two clients, deliberately. The three anonymous paths use `publicClient`: an
 * appeal link is followed by an account that is banned, so it holds no session
 * and `axiosClient` would try to refresh one it never had. Everything else uses
 * `axiosClient`.
 *
 * Every request body is assembled field by field through `buildBody`, and every
 * query string through `pickParams`, because the backend rejects an undeclared
 * body field or query parameter with 400. Spreading form state into a request
 * fails here.
 */

/**
 * The wire form of a support category.
 *
 * The vocabulary endpoint returns lowercase keys (`appeal_ban`) while the
 * request DTOs bind a Java enum, which Jackson reads by its uppercase constant
 * name and rejects case-insensitively. Sending the key as it arrives answers
 * `MALFORMED_REQUEST_BODY`, so the seam is crossed here rather than at each
 * call site.
 *
 * @param {string} categoryKey a key from the vocabulary endpoint
 * @returns {string} the enum constant name the API binds
 */
export const toCategoryEnum = (categoryKey: string | null | undefined) =>
  String(categoryKey ?? '').toUpperCase();

/** The inverse, for matching a response's enum back to a vocabulary row. */
export const toCategoryKey = (categoryEnum: string | null | undefined) =>
  String(categoryEnum ?? '').toLowerCase();

const unwrap = <T>(response: AxiosResponse<ApiResponse<T>>) => response?.data?.data;

/** Creates a ticket as the signed-in account. */
export const createTicket = async ({
  category,
  subject,
  body,
}: Omit<CreateSupportTicketRequest, 'category'> & { category: string }) =>
  unwrap(
    await axiosClient.post<ApiResponse<SupportTicketResponse>>(
      '/support/tickets',
      buildBody({
        category: toCategoryEnum(category),
        subject,
        body,
      })
    )
  );

/** The caller's own tickets, newest first. */
export const listOwnTickets = async ({ limit = 20 }: { limit?: number } = {}) =>
  unwrap(
    await axiosClient.get<ApiResponse<SupportTicketResponse[]>>('/support/tickets', {
      params: pickParams({ limit }, ['limit']),
    })
  );

/** One of the caller's own tickets. Never carries an internal note. */
export const getOwnTicket = async (ticketId: string) =>
  unwrap(await axiosClient.get<ApiResponse<SupportTicketResponse>>(`/support/tickets/${ticketId}`));

/**
 * Redeems the single-use token from a moderation notice.
 *
 * Anonymous by design. The account this is submitted for is banned or
 * suspended, so it cannot reach an authenticated endpoint at all, and the
 * backend mints no session in return: this call authorises exactly one write
 * and hands back nothing that could be used as a credential.
 *
 * The category is taken from the token server-side, never from here, so a
 * submitter cannot appeal something the token did not authorise.
 */
export const createAppeal = async ({ token, subject, body }: SignedAppealRequest) =>
  unwrap(
    await publicClient.post<ApiResponse<AppealSubmittedResponse>>(
      '/support/appeal',
      buildBody({ token, subject, body })
    )
  );

/**
 * Opens an appeal from a session, against a decision the caller owns.
 *
 * The authenticated counterpart to `createAppeal`. A signed link exists because
 * its holder has no session; somebody who has one should not have to wait for
 * an email to reach the same ticket, and must not be stranded when that email
 * never arrives.
 *
 * `adminActionId` is not a credential. The server re-reads the audit row and
 * compares its target against the caller, and answers a row belonging to
 * someone else exactly as it answers one that does not exist. The category is
 * derived server-side from the decision, never sent from here.
 */
export const createInProductAppeal = async ({
  adminActionId,
  subject,
  body,
}: InProductAppealRequest) =>
  unwrap(
    await axiosClient.post<ApiResponse<SupportTicketResponse>>(
      '/support/appeals',
      buildBody({ adminActionId, subject, body })
    )
  );

/**
 * Reads one appeal with the status token handed back when it was filed.
 *
 * Anonymous, read-only, and it never spends the token, so the link can be
 * followed as often as the appellant likes across the life of the appeal.
 *
 * Answers the same shape `getOwnTicket` does. That record has no field for the
 * staff-only note, the assignee or the escalation reason, so there is nothing
 * here to filter out on the client.
 */
export const readAppealStatus = async (token: string) =>
  unwrap(
    await publicClient.get<ApiResponse<SupportTicketResponse>>('/support/appeal/status', {
      params: { token },
    })
  );

/**
 * Asks for a replacement appeal link to be mailed.
 *
 * For the reader whose moderation notice bounced, was filtered, or was deleted.
 * Before this, that email was the only place the link contesting a specific
 * decision existed.
 *
 * The answer is identical whether or not the address matches an account, so
 * nothing in the response can be used to decide what to show. The caller must
 * render the same confirmation either way.
 */
export const resendAppealLink = async ({ contactEmail, turnstileToken }: ResendAppealLinkRequest) =>
  unwrap(
    await publicClient.post<ApiResponse<null>>(
      '/support/appeal/resend',
      buildBody({ contactEmail, turnstileToken })
    )
  );

/**
 * Asks whether an appeal link is still redeemable, without redeeming it.
 *
 * Read-only, and that is the whole point: the landing screen calls this on
 * mount, so anything that consumed the token would spend the link merely by
 * opening the page. Redemption stays with `createAppeal`, which is the one call
 * that spends it.
 *
 * Answers the appeal category and nothing else.
 */
export const validateAppealLink = async (token: string) =>
  unwrap(
    await publicClient.get<ApiResponse<AppealLinkResponse>>('/support/appeal/validate', {
      params: { token },
    })
  );

/** Submits the anonymous public form. Turnstile is verified before anything is written. */
export const createPublicTicket = async ({
  contactEmail,
  category,
  subject,
  body,
  turnstileToken,
}: Omit<PublicSupportTicketRequest, 'category'> & { category: string }) =>
  unwrap(
    await publicClient.post<ApiResponse<null>>(
      '/support/public/tickets',
      buildBody({
        contactEmail,
        category: toCategoryEnum(category),
        subject,
        body,
        turnstileToken,
      })
    )
  );

/**
 * Confirms the address a public submission named, making the ticket visible to
 * staff.
 *
 * The token goes in the query string, not the body: this endpoint declares
 * `@RequestParam("token")` while the appeal endpoint next to it takes a body.
 * Sending a body here answers `MISSING_REQUIRED_PARAMETER`.
 */
export const confirmPublicTicket = async (token: string) =>
  unwrap(
    await publicClient.post<ApiResponse<null>>('/support/public/confirm', null, {
      params: pickParams({ token }, ['token']),
    })
  );

/** The eight verification categories, with the icon key a client maps to a glyph. */
export const listVerificationCategories = async () =>
  unwrap(
    await axiosClient.get<ApiResponse<VerificationCategoryResponse[]>>(
      '/support/verification/categories'
    )
  );

/** The caller's own verification state: an active grant, an open request, or neither. */
export const getVerificationState = async () =>
  unwrap(await axiosClient.get<ApiResponse<VerificationStateResponse>>('/support/verification/me'));

/**
 * Submits a verification request.
 *
 * Written out field by field rather than spread. That alone was not enough: it
 * named two fields, `evidenceAward` and `evidenceOther`, that
 * `CreateVerificationRequest` does not declare, and every submission answered
 * 400 `MALFORMED_REQUEST_BODY` because the endpoint refuses an undeclared body
 * field. Listing the fields explicitly makes the wire shape visible; only a test
 * that pins the exact key set makes it correct, which is what
 * `supportRequestContract.test.js` now asserts.
 */
export const createVerificationRequest = async (values: CreateVerificationRequest) =>
  unwrap(
    await axiosClient.post<ApiResponse<VerificationStateResponse>>(
      '/support/verification/requests',
      buildBody({
        categoryKey: values.categoryKey,
        claimedName: values.claimedName,
        evidenceWebsite: values.evidenceWebsite,
        evidenceOtherProfile: values.evidenceOtherProfile,
        evidenceEmailDomain: values.evidenceEmailDomain,
        evidencePublishedWork: values.evidencePublishedWork,
        evidencePress: values.evidencePress,
        evidenceOfficialListing: values.evidenceOfficialListing,
        evidenceNote: values.evidenceNote,
      })
    )
  );

/**
 * The support category vocabulary.
 *
 * Read from the shared config endpoint rather than hardcoded, so adding a
 * category is a backend change and the selector follows. Carries `isAppeal`,
 * `allowsPublicForm` and `isEnabled`, which decide which categories each of the
 * three entry paths may offer.
 */
export const listSupportCategories = async () => {
  const vocabularies = unwrap(
    await axiosClient.get<ApiResponse<VocabularyResponse>>('/config/vocabularies')
  );
  return vocabularies?.supportCategories ?? [];
};
