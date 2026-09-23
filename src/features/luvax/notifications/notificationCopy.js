/**
 * The verb fragment after the actor list, keyed by NotificationType (not category - two
 * types can share a category but need different wording, e.g. like_post vs like_comment).
 */
const TYPE_PHRASE = {
  like_post: 'liked your post',
  like_comment: 'liked your comment',
  comment_post: 'commented on your post',
  reply_comment: 'replied to your comment',
  follow: 'started following you',
  mention_post: 'mentioned you in a post',
  mention_comment: 'mentioned you in a comment',
  story_view: 'viewed your story',
};

/**
 * System-category phrases. These rows carry no actor (P1 section 4 deviation D6: the
 * backend stops sending the responder as an actor for these types), so the phrase reads
 * against the implied "Luvax" subject the row renders instead of a name.
 */
const SYSTEM_PHRASE = {
  warning: 'issued a warning on your account',
  post_removed: 'removed your post',
  comment_removed: 'removed your comment',
  story_removed: 'removed your story',
  message_removed: 'removed your message',
  report_post_removed: 'removed content you reported',
  post_restored: 'restored your post',
  report_dismissed: 'reviewed your report and took no action',
  support_ticket_update: 'responded to your support ticket',
};

/**
 * Splits a NotificationItem into the parts a row needs to render its sentence, without
 * deciding layout: the caller places verified badges after each actor name and appends
 * the trailing period.
 * @param {{type: string, category: string, actors?: Array<object>, actorCount?: number}} item
 * @returns {{isSystem: boolean, actors: Array<object>, othersCount: number, phrase: string}}
 */
export function notificationCopyParts(item) {
  const isSystem = item.category === 'system';
  const actors = isSystem ? [] : (item.actors ?? []);
  const othersCount = isSystem ? 0 : Math.max(0, (item.actorCount ?? actors.length) - actors.length);
  const phrase = isSystem
    ? (SYSTEM_PHRASE[item.type] ?? 'took an action on your account')
    : (TYPE_PHRASE[item.type] ?? 'interacted with you');
  return { isSystem, actors, othersCount, phrase };
}
