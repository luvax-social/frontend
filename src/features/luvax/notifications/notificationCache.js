/**
 * Pure reducers over an array of NotificationItem (P1 API contract section 4).
 *
 * These never touch a TanStack Query cache directly - useNotifications.js applies them
 * across every cached ['notifications','list',filter] query with setQueryData. Keeping
 * them pure is what makes the live-event and optimistic-update paths (which both funnel
 * through here) testable without mounting a QueryClient.
 */

/**
 * Descending comparator on the (activityAt, id) tuple the feed sorts by.
 * @param {{activityAt: string, id: string}} a
 * @param {{activityAt: string, id: string}} b
 * @returns {number}
 */
export function compareActivity(a, b) {
  if (a.activityAt !== b.activityAt) {
    return a.activityAt > b.activityAt ? -1 : 1;
  }
  if (a.id === b.id) return 0;
  return a.id > b.id ? -1 : 1;
}

/**
 * Inserts or replaces an item by id at its sorted position, dropping any older
 * copy of the same id first so a bump never leaves a stale duplicate behind.
 * @param {Array<object>} items
 * @param {object} nextItem
 * @returns {Array<object>}
 */
export function upsertItem(items, nextItem) {
  const withoutOld = items.filter((existing) => existing.id !== nextItem.id);
  const insertAt = withoutOld.findIndex((existing) => compareActivity(nextItem, existing) < 0);
  const index = insertAt === -1 ? withoutOld.length : insertAt;
  return [...withoutOld.slice(0, index), nextItem, ...withoutOld.slice(index)];
}

/**
 * Drops every listed id.
 * @param {Array<object>} items
 * @param {Array<string>} ids
 * @returns {Array<object>}
 */
export function removeItems(items, ids) {
  const idSet = new Set(ids);
  return items.filter((item) => !idSet.has(item.id));
}

/**
 * @param {Array<object>} items
 * @param {Array<string>} ids
 * @param {string} readAt
 * @returns {Array<object>}
 */
export function markRead(items, ids, readAt) {
  const idSet = new Set(ids);
  return items.map((item) => (idSet.has(item.id) ? { ...item, isRead: true, readAt } : item));
}

/**
 * @param {Array<object>} items
 * @param {Array<string>} ids
 * @returns {Array<object>}
 */
export function markUnread(items, ids) {
  const idSet = new Set(ids);
  return items.map((item) => (idSet.has(item.id) ? { ...item, isRead: false, readAt: null } : item));
}

/**
 * Applies a mark-all-read bound: every row at or below the `(activityAt, id)` tuple is
 * marked read. Mirrors the live `read-state` envelope shape that carries `upTo` instead
 * of `ids` (P1 section 4); omitting `readAt` means the rows are marked unread instead,
 * matching "read-state without readAt means unread" in the same contract.
 * @param {Array<object>} items
 * @param {{activityAt: string, id: string}} upTo
 * @param {string|undefined} readAt
 * @returns {Array<object>}
 */
export function markReadUpTo(items, upTo, readAt) {
  return items.map((item) => {
    if (compareActivity(item, upTo) < 0) return item;
    return readAt ? { ...item, isRead: true, readAt } : { ...item, isRead: false, readAt: null };
  });
}

/**
 * Whether an item belongs under a given chip, using only fields the server already sent
 * on the item - not an independent filtering decision, just routing one pushed item into
 * the caches whose predicate it already satisfies.
 * @param {object} item
 * @param {'all'|'unread'|'comments'|'mentions'|'follows'|'system'|'verified'} filter
 * @returns {boolean}
 */
export function itemMatchesFilter(item, filter) {
  switch (filter) {
    case 'all':
      return true;
    case 'unread':
      return !item.isRead;
    case 'comments':
      return item.category === 'comment';
    case 'mentions':
      return item.category === 'mention';
    case 'follows':
      return item.category === 'follow';
    case 'system':
      return item.category === 'system';
    case 'verified':
      return Boolean(item.actors?.[0]?.isVerified);
    default:
      return false;
  }
}
