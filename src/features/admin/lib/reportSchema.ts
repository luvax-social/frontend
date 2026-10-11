/**
 * Fixed lifecycle enumerations for reports.
 *
 * These are not vocabulary values. A human does not configure them and they
 * carry no display metadata from the server, so they come from the API schema
 * rather than from `GET /api/v1/config/vocabularies`. Both sets are the
 * PostgreSQL enum types the backend declares:
 * - report status: the `report_status` enum (migration V64 added `escalated`)
 * - report type: the `report_type` enum
 *
 * The labels below are the panel's own display strings for these fixed states,
 * needed because the vocabulary endpoint does not serve them. Reason values, by
 * contrast, always come from the vocabulary and are never hardcoded.
 */

/** `report_status` enum, in lifecycle order. */
export const REPORT_STATUSES = ['pending', 'reviewing', 'resolved', 'dismissed', 'escalated'];

/**
 * The status filter values worth offering a moderator.
 *
 * `GET /api/v1/reports` returns a role-scoped result set: a moderator's list is
 * always empty for `resolved`, `dismissed`, and `escalated` (see
 * report-contract-verification.md item 4). Offering a filter option that is
 * provably incapable of returning a row is not an honest empty state, it is
 * noise, and `escalated` is the worst instance because a moderator who just
 * escalated a report will look for it there first and always find nothing.
 * The administrator's filter offers the full REPORT_STATUSES set, since an
 * administrator's list is not scoped.
 */
export const MODERATOR_REPORT_STATUSES = ['pending', 'reviewing'];

/** `report_type` enum. */
export const REPORT_TYPES = ['post', 'comment', 'user', 'story', 'message'];

export const REPORT_STATUS_LABELS = {
  pending: 'pending',
  reviewing: 'reviewing',
  resolved: 'resolved',
  dismissed: 'dismissed',
  escalated: 'escalated',
};

export const REPORT_TYPE_LABELS = {
  post: 'post',
  comment: 'comment',
  user: 'user',
  story: 'story',
  message: 'message',
};

/**
 * The target types the panel can remove and restore.
 *
 * Stories and messages joined posts and comments when the backend added
 * `PATCH /admin/stories/{id}/remove|restore` and the same pair for messages.
 * Before those existed the panel rendered a reported story or message
 * read-only and said so; that copy is gone, because it is no longer true.
 *
 * `user` is the one report type with no content to take down — the actions
 * against an account are ban, suspend, and warn, which live on the account
 * screen and are not content moderation.
 */
export const ACTIONABLE_TARGET_TYPES = new Set(['post', 'comment', 'story', 'message']);
