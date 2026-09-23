import { routeTo } from '@/config/constants';
import { appealPath } from '@/utils/appealEntry';

/**
 * Where tapping a notification row goes, per the locked deep-link decisions (P2 prompt
 * item 5 / P0 section 9.8). Returns { path: null, isNavigable: false } for an unavailable
 * target or a target kind this table does not recognise, so the caller can render the row
 * as non-clickable rather than guess.
 * @param {object} item a NotificationItem (P1 section 4)
 * @returns {{path: ?string, isNavigable: boolean}}
 */
export function resolveNotificationTarget(item) {
  const target = item.target;
  if (!target || target.available === false) {
    return { path: null, isNavigable: false };
  }

  if (target.kind === 'comment' && target.postId && target.commentId) {
    return {
      path: `${routeTo.postDetail(target.postId)}?comment=${target.commentId}`,
      isNavigable: true,
    };
  }
  if (target.kind === 'post' && target.postId) {
    return { path: routeTo.postDetail(target.postId), isNavigable: true };
  }
  if (target.kind === 'story' && target.storyId) {
    return { path: routeTo.storyView(target.storyId), isNavigable: true };
  }
  if (target.kind === 'user' && target.userId) {
    return { path: routeTo.userProfile(target.userId), isNavigable: true };
  }
  if (
    target.kind === 'moderation' &&
    item.moderation?.appealable &&
    item.moderation?.appealActionId
  ) {
    return { path: appealPath(item.moderation.appealActionId), isNavigable: true };
  }
  if (target.kind === 'support_ticket' && target.ticketId) {
    return { path: routeTo.supportTicket(target.ticketId), isNavigable: true };
  }

  return { path: null, isNavigable: false };
}
