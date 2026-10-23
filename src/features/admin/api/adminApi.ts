import type { AxiosResponse } from 'axios';
import type { ApiResponse, CursorPage } from '@/types/api';
import type { ReportResponse, VocabularyResponse, UserEventResponse } from '@/types/domain';
import type {
  AdminReportTargetResponse,
  AdminUserLookupResponse,
  EscalatedReportCountResponse,
  AdminActionResponse,
  AdminPostRestoreResponse,
  AdminViolationResponse,
  AdminWarnUserResponse,
  AdminPostSummaryResponse,
  AdminCommentSummaryResponse,
  AdminActionSummaryResponse,
  AdminUserListItemResponse,
  AdminUserDetailResponse,
  CurrentSessionResponse,
  HashtagAdminResponse,
  AdminStatsCurrentResponse,
  AdminStatsTimeseriesResponse,
  AdminWarnUserRequest,
  AdminActionRequest,
  AdminSuspendUserRequest,
  AdminRoleChangeRequest,
  AdminCreateHashtagRequest,
  AdminUpdateHashtagRequest,
  AdminDeleteHashtagRequest,
  AdminUpdatePlaceRequest,
} from '@/types/admin';
import type { PlaceAdminResponse } from '@/types/domain';
import { axiosClient } from '@/api/axiosClient';

import { buildBody, pickParams } from '@/utils/requestContract';

/**
 * Panel API surface.
 *
 * Every call goes through the shared authenticated `axiosClient`, which attaches
 * the bearer token and runs the single-flight 401 refresh; the panel adds no
 * second Axios instance and no second refresh path. Each function unwraps the
 * `ApiResponse` envelope and returns `data`, sends only an endpoint's declared
 * query keys, and builds request bodies field by field.
 */

const unwrap = <T>(response: AxiosResponse<ApiResponse<T>>): T => response.data.data;

// Declared query parameters per endpoint. Anything outside these lists is
// stripped before the request, which the admin endpoints enforce with 400 and
// which is applied to the report endpoints too as a defensive habit.
const REPORTS_QUERY_KEYS = ['status', 'reportType', 'cursor', 'limit'];
// Per-account content and the escalations list take only keyset paging.
const CURSOR_QUERY_KEYS = ['cursor', 'limit'];
// Violations additionally declare includeRevoked, default false.
// See uptake-contract-verification.md 4.2.
const VIOLATIONS_QUERY_KEYS = ['cursor', 'limit', 'includeRevoked'];
// The action log now declares six. `targetUserId` and the half-open `from`/`to`
// window were added by the backend uptake and compose with moderator scoping
// rather than bypassing it. See uptake-contract-verification.md 4.3.
const ACTIONS_QUERY_KEYS = [
  'adminId',
  'actionType',
  'targetUserId',
  'from',
  'to',
  'cursor',
  'limit',
];
// The account list declares status and role; search declares only q. Both take
// keyset paging. See accounts-contract-verification.md 3.2.
const USERS_QUERY_KEYS = ['status', 'role', 'cursor', 'limit'];
const USER_SEARCH_QUERY_KEYS = ['q', 'cursor', 'limit'];
// The hashtag registry list declares status; search declares q and status.
// See accounts-contract-verification.md 3.4.
const HASHTAGS_QUERY_KEYS = ['status', 'cursor', 'limit'];
const HASHTAG_SEARCH_QUERY_KEYS = ['q', 'status', 'cursor', 'limit'];
// The places registry declares the same parameters as the hashtag registry.
const PLACES_QUERY_KEYS = ['status', 'cursor', 'limit'];
const PLACE_SEARCH_QUERY_KEYS = ['q', 'status', 'cursor', 'limit'];
// The timeseries declares exactly these four. There is no cursor and no limit:
// the endpoint is not paginated, it returns the whole window in one response.
// See observability-contract-verification.md 1.4.
const STATS_TIMESERIES_QUERY_KEYS = ['metric', 'granularity', 'from', 'to'];
// The activity log declares six. `from` and `to` are mandatory and the caller
// must supply both; the server refuses a request carrying only one of them.
// See observability-contract-verification.md 2.1.
const USER_EVENTS_QUERY_KEYS = ['userId', 'from', 'to', 'eventType', 'cursor', 'limit'];

export const adminApi = {
  /** The one-hour-cached vocabulary lists (report reasons, moderation actions). */
  async getVocabularies() {
    const res = await axiosClient.get<ApiResponse<VocabularyResponse>>('/config/vocabularies');
    return unwrap(res);
  },

  /**
   * One page of the report queue. Also the escalated queue when `status` is
   * `escalated`. The result set differs by role: a moderator sees only pending
   * and reviewing reports.
   */
  async getReports({
    status,
    reportType,
    cursor,
    limit,
  }: {
    status?: string | null;
    reportType?: string | null;
    cursor?: string | null;
    limit?: number;
  } = {}) {
    const params = pickParams({ status, reportType, cursor, limit }, REPORTS_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<CursorPage<ReportResponse>>>('/reports', {
      params,
    });
    return unwrap(res);
  },

  /** A single report. Returns 404 for a moderator once the report is closed. */
  async getReport(reportId: string) {
    const res = await axiosClient.get<ApiResponse<ReportResponse>>(`/reports/${reportId}`);
    return unwrap(res);
  },

  /** The reported entity itself. One payload shape serves all five entity types. */
  async getReportTarget(reportId: string) {
    const res = await axiosClient.get<ApiResponse<AdminReportTargetResponse>>(
      `/admin/reports/${reportId}/target`
    );
    return unwrap(res);
  },

  /**
   * Resolves up to a hundred account ids to display names in one request. A
   * moderator may call this, which is what makes the report queue renderable
   * without administrator access.
   *
   * Two wire details are pinned here rather than left to Axios:
   *
   * - The array must serialise to repeated bare `ids=` keys. Axios's default is
   *   `ids[]=`, which this endpoint rejects with 400, so `indexes: null` is not
   *   a style preference — without it every call fails.
   * - `pickParams` is not used. It exists to drop undeclared *filter* keys, and
   *   `ids` is the endpoint's one declared, required parameter, passed as the
   *   array the caller assembled.
   *
   * Returns one entry per requested id, in request order, each
   * `{ userId, found, user }` with `found: false` and a null `user` for an
   * unknown or deleted id. Callers index by `userId`; see `lib/userSummaries`.
   */
  async getUserSummaries(ids: readonly string[]) {
    const res = await axiosClient.get<ApiResponse<AdminUserLookupResponse[]>>(
      '/admin/user-summaries',
      {
        params: { ids },
        paramsSerializer: { indexes: null },
      }
    );
    return unwrap(res);
  },

  /** The escalated report counter. Administrator only; a moderator receives 403. */
  async getEscalatedCount() {
    const res = await axiosClient.get<ApiResponse<EscalatedReportCountResponse>>(
      '/admin/reports/escalated/count'
    );
    return unwrap(res)?.count ?? 0;
  },

  /**
   * The single pending-to-reviewing transition. The request schema accepts all
   * five statuses but only this transition happens; no resolution note is sent,
   * because the recorded note is the reason on resolve and dismiss.
   */
  async markReviewing(reportId: string) {
    const res = await axiosClient.patch<ApiResponse<ReportResponse>>(
      `/reports/${reportId}/status`,
      buildBody({ status: 'reviewing' })
    );
    return unwrap(res);
  },

  async resolveReport(reportId: string, reason: string) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/reports/${reportId}/resolve`,
      buildBody({ reason })
    );
    return unwrap(res);
  },

  async dismissReport(reportId: string, reason: string) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/reports/${reportId}/dismiss`,
      buildBody({ reason })
    );
    return unwrap(res);
  },

  async escalateReport(reportId: string, reason: string) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/reports/${reportId}/escalate`,
      buildBody({ reason })
    );
    return unwrap(res);
  },

  /** Remove a post. Returns an AdminActionResponse directly. */
  async removePost(postId: string, reason: string, reportId?: string | null) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/posts/${postId}/remove`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /**
   * Restore a post. Returns a wrapper `{ action, remainingBannedHashtags }`,
   * unlike every other action endpoint.
   *
   * `remainingBannedHashtags` is the post's **present state** — the banned tags
   * its caption still carries after the restore — not the set this call
   * changed. Restoring the same post twice returns the same names both times,
   * which is correct and must not read as a bug. Verified in
   * `uptake-contract-verification.md` §3.
   */
  async restorePost(postId: string, reason: string, reportId?: string | null) {
    const res = await axiosClient.patch<ApiResponse<AdminPostRestoreResponse>>(
      `/admin/posts/${postId}/restore`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /** Remove a comment. Returns an AdminActionResponse directly. */
  async removeComment(commentId: string, reason: string, reportId?: string | null) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/comments/${commentId}/remove`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /**
   * Restore a comment. Returns an AdminActionResponse directly, with no
   * dropped-hashtag wrapper, because comments carry no hashtags.
   */
  async restoreComment(commentId: string, reason: string, reportId?: string | null) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/comments/${commentId}/restore`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /**
   * Remove a story. Returns an AdminActionResponse directly. A moderator may
   * call this. 409 means the story is already removed.
   */
  async removeStory(storyId: string, reason: string, reportId?: string | null) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/stories/${storyId}/remove`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /**
   * Restore a story. Returns an AdminActionResponse directly.
   *
   * A success here lifts the removal and nothing else. Expiry keeps deciding
   * visibility: a story that expired while removed comes back to a live row no
   * feed shows, and the response is an ordinary success that says nothing about
   * it. Once a story is both removed and expired the cleanup job deletes it and
   * this answers 404. See `uptake-contract-verification.md` §1.1.
   */
  async restoreStory(storyId: string, reason: string, reportId?: string | null) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/stories/${storyId}/restore`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /**
   * Remove a message. Returns an AdminActionResponse directly. Withholds the
   * text, media, and any shared post or story from both participants; the
   * reviewer's own view of the target still carries the text, marked removed.
   */
  async removeMessage(messageId: string, reason: string, reportId?: string | null) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/messages/${messageId}/remove`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /**
   * Restore a message. Returns an AdminActionResponse directly.
   *
   * This lifts moderation's removal only. A sender's own deletion is a separate
   * column and survives untouched, so restoring a message the sender had
   * already deleted succeeds while leaving it invisible to both participants.
   * See `uptake-contract-verification.md` §1.2.
   */
  async restoreMessage(messageId: string, reason: string, reportId?: string | null) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/messages/${messageId}/restore`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /**
   * Remove a message reaction. Returns an AdminActionResponse directly.
   *
   * `PATCH /admin/message-reactions/{reactionId}/remove`. The id is the reaction's own, which is
   * what a report of a reaction names. A removal needs a reason and tells the reactor.
   */
  async removeMessageReaction(reactionId: string, reason: string, reportId?: string | null) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/message-reactions/${reactionId}/remove`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /**
   * Restore a removed message reaction, with its original emoji and time.
   *
   * `PATCH /admin/message-reactions/{reactionId}/restore`. Returns an AdminActionResponse.
   */
  async restoreMessageReaction(reactionId: string, reason: string, reportId?: string | null) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/message-reactions/${reactionId}/restore`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /**
   * One page of an account's violation history. The result set differs by role:
   * a moderator sees warnings only, an administrator sees warnings and strikes.
   * Rows are a discriminated union on `kind`.
   *
   * `includeRevoked` adds revoked warnings and strikes, each carrying
   * `revokedAt` and `revokedBy`. The cursor is scoped on the flag as well as on
   * the role, so a cursor from one setting is rejected by the other with
   * INVALID_CURSOR — toggling restarts pagination rather than replaying.
   */
  async getViolations({
    userId,
    cursor,
    limit,
    includeRevoked,
  }: {
    userId?: string | null;
    cursor?: string | null;
    limit?: number;
    includeRevoked?: boolean;
  } = {}) {
    const params = pickParams({ cursor, limit, includeRevoked }, VIOLATIONS_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<CursorPage<AdminViolationResponse>>>(
      `/admin/violations/for-user/${userId}`,
      { params }
    );
    return unwrap(res);
  },

  /**
   * Issue a warning against an account. The body is exactly `reasonKey` (a key
   * from the report-reason vocabulary) and `note` (required, non-blank, ≤2000).
   * A third active warning auto-issues a strike, reflected in the response's
   * `strikeIssued`, `strike`, and `resultingStatus`.
   */
  async warnUser(userId: string, { reasonKey, note }: AdminWarnUserRequest) {
    const res = await axiosClient.post<ApiResponse<AdminWarnUserResponse>>(
      `/admin/warnings/for-user/${userId}`,
      buildBody({ reasonKey, note })
    );
    return unwrap(res);
  },

  /** Revoke a warning. Administrator only; a moderator receives 403. */
  async revokeWarning(warningId: string, { reason, reportId }: AdminActionRequest) {
    const res = await axiosClient.delete<ApiResponse<AdminActionResponse>>(
      `/admin/warnings/${warningId}`,
      {
        data: buildBody({ reason, reportId }),
      }
    );
    return unwrap(res);
  },

  /** Revoke a strike. Administrator only; a moderator receives 403. */
  async revokeStrike(strikeId: string, { reason, reportId }: AdminActionRequest) {
    const res = await axiosClient.delete<ApiResponse<AdminActionResponse>>(
      `/admin/strikes/${strikeId}`,
      {
        data: buildBody({ reason, reportId }),
      }
    );
    return unwrap(res);
  },

  /** One page of an account's posts. Both roles may call. */
  async getUserPosts({
    userId,
    cursor,
    limit,
  }: { userId?: string | null; cursor?: string | null; limit?: number } = {}) {
    const params = pickParams({ cursor, limit }, CURSOR_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<CursorPage<AdminPostSummaryResponse>>>(
      `/admin/content/for-user/${userId}/posts`,
      { params }
    );
    return unwrap(res);
  },

  /** One page of an account's comments. Both roles may call. */
  async getUserComments({
    userId,
    cursor,
    limit,
  }: { userId?: string | null; cursor?: string | null; limit?: number } = {}) {
    const params = pickParams({ cursor, limit }, CURSOR_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<CursorPage<AdminCommentSummaryResponse>>>(
      `/admin/content/for-user/${userId}/comments`,
      { params }
    );
    return unwrap(res);
  },

  /**
   * One page of the moderation action log. A moderator sees only its own
   * actions; an administrator sees all. Rows never carry `metadata`. The only
   * declared filters are `adminId` and `actionType`.
   */
  async getActions({
    adminId,
    actionType,
    targetUserId,
    from,
    to,
    cursor,
    limit,
  }: {
    adminId?: string | null;
    actionType?: string | null;
    targetUserId?: string | null;
    from?: string | null;
    to?: string | null;
    cursor?: string | null;
    limit?: number;
  } = {}) {
    const params = pickParams(
      { adminId, actionType, targetUserId, from, to, cursor, limit },
      ACTIONS_QUERY_KEYS
    );
    const res = await axiosClient.get<ApiResponse<CursorPage<AdminActionSummaryResponse>>>(
      '/admin/actions',
      { params }
    );
    return unwrap(res);
  },

  /**
   * A single action, the only place `metadata` exists. A moderator receives 404
   * for an action it did not perform.
   */
  async getAction(actionId: string) {
    const res = await axiosClient.get<ApiResponse<AdminActionResponse>>(
      `/admin/actions/${actionId}`
    );
    return unwrap(res);
  },

  /**
   * One page of the account list. Administrator only; a moderator receives 403.
   * Declares two filters, `status` and `role`; both are optional and serialised
   * only when set. Rows are `AdminUserListItemResponse`, carrying role and status
   * so a row is renderable and triage-able without a second fetch.
   */
  async getUsers({
    status,
    role,
    cursor,
    limit,
  }: {
    status?: string | null;
    role?: string | null;
    cursor?: string | null;
    limit?: number;
  } = {}) {
    const params = pickParams({ status, role, cursor, limit }, USERS_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<CursorPage<AdminUserListItemResponse>>>(
      '/admin/users',
      { params }
    );
    return unwrap(res);
  },

  /**
   * One page of an account search. Administrator only. `q` is required and must
   * be at least two characters; the server answers a shorter or blank query with
   * 400, so the caller gates on length before firing. Returns the same row shape
   * as the list. Rate limited (prod 40/min); a 429 carries `Retry-After`.
   */
  async searchUsers({
    q,
    cursor,
    limit,
  }: { q?: string | null; cursor?: string | null; limit?: number } = {}) {
    const params = pickParams({ q, cursor, limit }, USER_SEARCH_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<CursorPage<AdminUserListItemResponse>>>(
      '/admin/users/search',
      { params }
    );
    return unwrap(res);
  },

  /**
   * A single account's detail. Administrator only; a moderator receives 403. The
   * `capabilities` object is a field of this payload rather than a separate
   * endpoint, so it is refetched with the detail after every action; no action
   * response carries capabilities.
   */
  async getUserDetail(userId: string) {
    const res = await axiosClient.get<ApiResponse<AdminUserDetailResponse>>(
      `/admin/users/${userId}`
    );
    return unwrap(res);
  },

  /** Ban an account. Body is `reason` (required) and an optional `reportId`. */
  async banUser(userId: string, { reason, reportId }: AdminActionRequest) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/users/${userId}/ban`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /** Lift a ban. Body is `reason` (required) and an optional `reportId`. */
  async unbanUser(userId: string, { reason, reportId }: AdminActionRequest) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/users/${userId}/unban`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /**
   * Suspend an account. Body is `reason` (required), an optional `reportId`, and
   * `durationDays` (1..3650, unit days). The server stores a resulting
   * `suspendedUntil`; the client shows `now + durationDays` in local time before
   * confirming rather than sending an end time.
   */
  async suspendUser(userId: string, { reason, reportId, durationDays }: AdminSuspendUserRequest) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/users/${userId}/suspend`,
      buildBody({ reason, reportId, durationDays })
    );
    return unwrap(res);
  },

  /** Lift a suspension. Body is `reason` (required) and an optional `reportId`. */
  async unsuspendUser(userId: string, { reason, reportId }: AdminActionRequest) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/users/${userId}/unsuspend`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /**
   * Change an account's role. Body is `role` (required, from the target's
   * `assignableRoles`) and `reason` (required). Promotion to administrator is
   * irreversible: an existing administrator can never be demoted through the API.
   */
  async changeUserRole(userId: string, { role, reason }: AdminRoleChangeRequest) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/users/${userId}/role`,
      buildBody({ role, reason })
    );
    return unwrap(res);
  },

  /**
   * End every session for an account. Revokes all refresh tokens and advances the
   * token epoch, so both the refresh path and every already-issued access token
   * die immediately. Body is `reason` (required) and an optional `reportId`.
   */
  async forceLogout(userId: string, { reason, reportId }: AdminActionRequest) {
    const res = await axiosClient.post<ApiResponse<AdminActionResponse>>(
      `/admin/users/${userId}/force-logout`,
      buildBody({ reason, reportId })
    );
    return unwrap(res);
  },

  /**
   * End one session and leave the account's others alone. Administrator only;
   * a moderator receives 403.
   *
   * Revoking an already-revoked session answers 200, not an error, so a double
   * click is safe. The audit row's `metadata.alreadyRevoked` says which of the
   * two happened, which is how the panel avoids reporting that it ended a live
   * session when it ended nothing. A session id belonging to another account
   * answers 404. A revoked session cannot be un-revoked.
   */
  async revokeSession(userId: string, sessionId: string, { reason, reportId }: AdminActionRequest) {
    const res = await axiosClient.delete<ApiResponse<AdminActionResponse>>(
      `/admin/users/${userId}/sessions/${sessionId}`,
      {
        data: buildBody({ reason, reportId }),
      }
    );
    return unwrap(res);
  },

  /**
   * Which session the caller is using, so its own row in an account's session
   * list can be marked.
   *
   * Answers `{ sessionId: null }` — a 200, not an error — whenever the request
   * carried no usable refresh token, which includes a token a later login has
   * rotated. Null means "cannot be determined", never "no session", and no row
   * is marked in that case. There is no per-row marker in the session payload
   * and none may be invented; correlating this id is the only mechanism.
   */
  async getCurrentSession(refreshToken: string | null) {
    const res = await axiosClient.post<ApiResponse<CurrentSessionResponse>>(
      '/auth/session',
      buildBody({ refreshToken })
    );
    return unwrap(res);
  },

  /**
   * The reports this caller escalated. Declares `cursor` and `limit` only —
   * there is deliberately no status filter, so a report an administrator has
   * since closed still appears, which is the outcome the escalation was for.
   * An administrator calling it gets its own escalations, not everyone's.
   */
  async getMyEscalations({ cursor, limit }: { cursor?: string | null; limit?: number } = {}) {
    const params = pickParams({ cursor, limit }, CURSOR_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<CursorPage<ReportResponse>>>(
      '/reports/escalated/mine',
      { params }
    );
    return unwrap(res);
  },

  /**
   * One page of the hashtag registry. Administrator only; a moderator receives
   * 403. Declares a `status` filter (`active`/`banned`/`deleted`). Rows are
   * `HashtagAdminResponse`.
   */
  async getHashtags({
    status,
    cursor,
    limit,
  }: { status?: string | null; cursor?: string | null; limit?: number } = {}) {
    const params = pickParams({ status, cursor, limit }, HASHTAGS_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<CursorPage<HashtagAdminResponse>>>(
      '/admin/hashtags',
      { params }
    );
    return unwrap(res);
  },

  /**
   * One page of a hashtag search. Administrator only. `q` is required (minimum
   * one character; blank is 400) and an optional `status` narrows it. Same row
   * shape as the list. Rate limited on its own bucket (prod 40/min).
   */
  async searchHashtags({
    q,
    status,
    cursor,
    limit,
  }: { q?: string | null; status?: string | null; cursor?: string | null; limit?: number } = {}) {
    const params = pickParams({ q, status, cursor, limit }, HASHTAG_SEARCH_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<CursorPage<HashtagAdminResponse>>>(
      '/admin/hashtags/search',
      { params }
    );
    return unwrap(res);
  },

  /**
   * Create a hashtag. Body is `name`, `status`, and `note`, all required. The
   * response is the audit `AdminActionResponse`, not the hashtag; the new
   * hashtag's id is carried in `targetEntityId`. A duplicate name returns 409
   * HASHTAG_ALREADY_EXISTS.
   */
  async createHashtag({ name, status, note }: AdminCreateHashtagRequest) {
    const res = await axiosClient.post<ApiResponse<AdminActionResponse>>(
      '/admin/hashtags',
      buildBody({ name, status, note })
    );
    return unwrap(res);
  },

  /**
   * Transition a hashtag's status. Body is `status` and `note`, both required.
   * Returns an `AdminActionResponse`. Banning a hashtag drops it from any post
   * restored later; unbanning returns it to `active`.
   */
  async updateHashtag(hashtagId: string, { status, note }: AdminUpdateHashtagRequest) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/hashtags/${hashtagId}`,
      buildBody({ status, note })
    );
    return unwrap(res);
  },

  /**
   * Delete a hashtag. Body is `reason` (required). This marks the record
   * `deleted` rather than removing it; it stays queryable under the `deleted`
   * status filter. Returns an `AdminActionResponse`.
   */
  async deleteHashtag(hashtagId: string, { reason }: AdminDeleteHashtagRequest) {
    const res = await axiosClient.delete<ApiResponse<AdminActionResponse>>(
      `/admin/hashtags/${hashtagId}`,
      {
        data: buildBody({ reason }),
      }
    );
    return unwrap(res);
  },

  /**
   * One page of the places registry. Administrator only. Declares a `status` filter
   * (`active`/`banned`/`deleted`); rows are `PlaceAdminResponse` and span every status.
   */
  async getPlaces({
    status,
    cursor,
    limit,
  }: { status?: string | null; cursor?: string | null; limit?: number } = {}) {
    const params = pickParams({ status, cursor, limit }, PLACES_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<CursorPage<PlaceAdminResponse>>>(
      '/admin/places',
      { params }
    );
    return unwrap(res);
  },

  /**
   * One page of a place search. Administrator only. `q` is required and an optional `status`
   * narrows it.
   */
  async searchPlaces({
    q,
    status,
    cursor,
    limit,
  }: { q?: string | null; status?: string | null; cursor?: string | null; limit?: number } = {}) {
    const params = pickParams({ q, status, cursor, limit }, PLACE_SEARCH_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<CursorPage<PlaceAdminResponse>>>(
      '/admin/places/search',
      { params }
    );
    return unwrap(res);
  },

  /**
   * Move a place to `active`, `banned` or `deleted`. Body is `status`, a `note` that bans and
   * deletions require, and an optional `reportId` the action resolves. Returns the audit
   * `AdminActionResponse`. Unbanning brings a deleted place back as well, so the registry needs no
   * separate restore.
   */
  async updatePlace(placeId: string, { status, note, reportId }: AdminUpdatePlaceRequest) {
    const res = await axiosClient.patch<ApiResponse<AdminActionResponse>>(
      `/admin/places/${placeId}`,
      buildBody({ status, note, reportId })
    );
    return unwrap(res);
  },

  /**
   * The newest stored statistics snapshot. Administrator only; a moderator
   * receives 403. Takes no parameters at all.
   *
   * `computedAt` is null when nothing has ever been collected, which is a
   * first-class state and not an error: the collection job writes one bucket
   * every 30 minutes and never backfills, so a freshly started or freshly reset
   * deployment genuinely has nothing to show. The figures are read from the last
   * completed bucket, so they are a snapshot up to 30 minutes old, never live.
   */
  async getCurrentStats() {
    const res =
      await axiosClient.get<ApiResponse<AdminStatsCurrentResponse>>('/admin/stats/current');
    return unwrap(res);
  },

  /**
   * One metric's stored series over a window. Administrator only.
   *
   * Every parameter is optional to the server, but omitting both bounds means
   * the last 24 hours and supplying exactly one is refused, so the caller always
   * sends both or neither. `granularity` is omitted rather than guessed when the
   * caller has no preference, because the server resolves the only one that has
   * rows behind it.
   *
   * The response restates `metric`, `granularity`, `from`, and `to` as the
   * server resolved them. Read the axis label off the response, never off the
   * request: the server may answer at a different granularity from the one that
   * was asked for.
   */
  async getStatsTimeseries({
    metric,
    granularity,
    from,
    to,
  }: {
    metric?: string | null;
    granularity?: string | null;
    from?: string | null;
    to?: string | null;
  } = {}) {
    const params = pickParams({ metric, granularity, from, to }, STATS_TIMESERIES_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<AdminStatsTimeseriesResponse>>(
      '/admin/stats/timeseries',
      { params }
    );
    return unwrap(res);
  },

  /**
   * One cursor page of behavioural events. Administrator only.
   *
   * `from` and `to` are both mandatory — the table is partitioned by time and an
   * unbounded read would scan every partition ever created — and the window may
   * span at most 30 days, inclusive. `userId` is optional; omitting it reads
   * across every account. Rate limited (prod 20/min), the tightest budget in the
   * panel, so the caller fires on commit and never on change.
   */
  async getUserEvents({
    userId,
    from,
    to,
    eventType,
    cursor,
    limit,
  }: {
    userId?: string | null;
    from?: string | null;
    to?: string | null;
    eventType?: string | null;
    cursor?: string | null;
    limit?: number;
  } = {}) {
    const params = pickParams(
      { userId, from, to, eventType, cursor, limit },
      USER_EVENTS_QUERY_KEYS
    );
    const res = await axiosClient.get<ApiResponse<CursorPage<UserEventResponse>>>(
      '/admin/user-events',
      { params }
    );
    return unwrap(res);
  },
};
