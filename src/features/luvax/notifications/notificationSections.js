const DAY_MS = 24 * 60 * 60 * 1000;

export const SECTION_ORDER = ['new', 'today', 'this week', 'this month', 'earlier'];

/**
 * The rolling-window bucket for a row's own age, ignoring server-provided isNew.
 *
 * No timezone is stored anywhere in the account (P0 section 1.6), so this is a rolling
 * window against the client clock rather than a calendar-day comparison.
 * @param {string} activityAt
 * @param {Date} [now]
 * @returns {'today'|'this week'|'this month'|'earlier'}
 */
export function bucketFor(activityAt, now = new Date()) {
  const ageMs = now.getTime() - new Date(activityAt).getTime();
  if (ageMs < DAY_MS) return 'today';
  if (ageMs < 7 * DAY_MS) return 'this week';
  if (ageMs < 30 * DAY_MS) return 'this month';
  return 'earlier';
}

/**
 * The section a row renders under: "new" for anything above the server's `previous`
 * watermark (isNew), otherwise its rolling time bucket.
 * @param {{isNew?: boolean, activityAt: string}} item
 * @param {Date} [now]
 * @returns {'new'|'today'|'this week'|'this month'|'earlier'}
 */
export function sectionFor(item, now = new Date()) {
  return item.isNew ? 'new' : bucketFor(item.activityAt, now);
}
