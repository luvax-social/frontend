import { ROUTES } from '@/config/constants';

/**
 * The address that opens an in-product appeal against one moderation decision.
 *
 * One builder rather than a template string at each call site, because there
 * are two call sites - a warning on the settings screen and a content-removal
 * notification - and they must agree on both the route and the parameter name.
 * The support screen reads `appeal` from the query string; a second spelling
 * would silently render the ordinary ticket form instead.
 *
 * The identifier is not a credential. The server re-reads the audit row and
 * compares its target against the caller, so a value edited in the address bar
 * answers exactly as an unknown one does.
 *
 * @param {string} adminActionId the audit row the decision was recorded under
 * @returns {string} the support address, or the plain support address when there is no decision
 */
export const appealPath = (adminActionId) =>
  adminActionId
    ? `${ROUTES.SETTINGS_SUPPORT}?appeal=${encodeURIComponent(adminActionId)}`
    : ROUTES.SETTINGS_SUPPORT;

/**
 * The enforcement notices that carry an appeal, keyed by notification type.
 *
 * Each of these points at the audit row rather than at the removed content,
 * which is gone and has no surface to open. That identifier is what
 * {@link appealPath} needs.
 *
 * `post_removed` is included even though it predates the other three: it is the
 * same kind of notice and gains the same route.
 */
export const CONTENT_REMOVAL_TYPES = new Set([
  'post_removed',
  'comment_removed',
  'story_removed',
  'message_removed',
]);

/**
 * The audit row a notification lets the recipient appeal, when it has one.
 *
 * Requires the entity to actually be an audit row. A `post_removed`
 * notification written before this work points at the post instead, and
 * offering an appeal against a post id would open an appeal against nothing.
 *
 * @param {Object} notification the notification row
 * @returns {string|null} the audit row identifier, or null when there is none to appeal
 */
export const appealableActionId = (notification) =>
  CONTENT_REMOVAL_TYPES.has(notification?.type) && notification?.entityType === 'admin_action'
    ? (notification.entityId ?? null)
    : null;
