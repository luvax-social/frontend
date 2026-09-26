/**
 * Whether {@link NotificationActions} (NotificationActions.jsx) renders anything for this
 * item. A pure function in its own module, not exported alongside NotificationActions itself,
 * so this file stays Fast-Refresh friendly (a file mixing component and non-component exports
 * loses Fast Refresh for that component).
 * @param {object} item
 * @returns {boolean}
 */
export function hasNotificationAction(item) {
  if (item.type === 'follow' && item.relationship?.isFollowing === false) return true;
  return Boolean(
    item.category === 'system' && item.moderation?.appealable && item.moderation?.appealActionId
  );
}
