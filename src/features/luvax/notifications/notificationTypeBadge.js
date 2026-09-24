/**
 * The small icon overlaid on the avatar's bottom-right corner, keyed by NotificationItem
 * category (not the finer type - the badge is a coarse "kind of thing happened" signal, not
 * a restatement of the sentence). `system` rows render the Luvax mark as their avatar
 * already, so they carry no badge here; NotificationAvatarStack skips the lookup for them.
 */
const CATEGORY_BADGE = {
  like: { icon: 'heart', filled: true, background: 'var(--lx-error)', color: '#fff' },
  comment: { icon: 'chat', filled: true, background: 'var(--lx-accent)', color: 'var(--lx-black)' },
  mention: { icon: 'chat', filled: true, background: 'var(--lx-accent)', color: 'var(--lx-black)' },
  follow: {
    icon: 'userPlus',
    filled: false,
    background: 'var(--lx-accent)',
    color: 'var(--lx-black)',
  },
  story: { icon: 'eye', filled: false, background: 'var(--lx-ink-2)', color: 'var(--lx-base)' },
};

/**
 * @param {string} category a NotificationItem's category
 * @returns {?{icon: string, filled: boolean, background: string, color: string}}
 */
export function notificationTypeBadge(category) {
  return CATEGORY_BADGE[category] ?? null;
}
