import type { NotificationItemResponse } from '@/types/domain';
/**
 * Whether {@link NotificationActions} (NotificationActions.tsx) renders anything for this
 * item. A pure function in its own module, not exported alongside NotificationActions itself,
 * so this file stays Fast-Refresh friendly (a file mixing component and non-component exports
 * loses Fast Refresh for that component).
 * @param {object} item
 * @returns {boolean}
 */
export function hasNotificationAction(
  item: Pick<NotificationItemResponse, 'type' | 'category' | 'relationship' | 'moderation'>
) {
  if (item.type === 'follow' && item.relationship?.isFollowing === false) return true;
  // A tag request and a collaboration invitation are decided in the row, and a failed schedule
  // links to its draft.
  if (
    item.type === 'post_tag_request' ||
    item.type === 'post_collaboration_invite' ||
    item.type === 'scheduled_post_failed'
  ) {
    return true;
  }
  return Boolean(
    item.category === 'system' && item.moderation?.appealable && item.moderation?.appealActionId
  );
}
