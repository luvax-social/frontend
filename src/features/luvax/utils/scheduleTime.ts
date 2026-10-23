/** Shortest lead the backend accepts for a scheduled post. */
export const SCHEDULE_MIN_LEAD_MS = 60_000;

/** How far ahead a post can be scheduled; mirrors the `scheduled_post_horizon_days` setting. */
export const SCHEDULE_MAX_DAYS = 30;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Drops seconds and milliseconds. The backend floors `scheduledAt` to the minute, so the client
 * sends the minute it shows and the stored time matches the label.
 */
export const floorToMinute = (date: Date): Date =>
  new Date(Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS);

/** The local calendar date as `YYYY-MM-DD`, the value of a date input. */
export const toDateInput = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The local clock time as `HH:mm`, the value of a time input. */
export const toTimeInput = (date: Date): string =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/**
 * Reads a date input and a time input as one local instant.
 *
 * Built from the numeric parts rather than parsed from a string, so the result is the person's own
 * wall-clock time in their own zone, never the UTC reading of the same digits.
 *
 * @returns the instant, or null when either input is empty or not a real calendar time
 */
export function fromInputs(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const [year, month, day] = dateMatch.slice(1).map(Number);
  const [hours, minutes] = timeMatch.slice(1).map(Number);
  const result = new Date(year, month - 1, day, hours, minutes, 0, 0);
  // A date such as 31 February rolls over silently; reject it instead of moving it.
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day ||
    result.getHours() !== hours ||
    result.getMinutes() !== minutes
  ) {
    return null;
  }
  return result;
}

export type ScheduleProblem = 'invalid' | 'too-soon' | 'too-far';

/**
 * Checks a chosen time against the two limits the backend enforces.
 *
 * @param at the chosen instant, or null when the inputs did not form one
 * @param now the current instant
 * @returns null when the time is acceptable, otherwise which limit it breaks
 */
export function checkSchedule(at: Date | null, now: Date): ScheduleProblem | null {
  if (!at || Number.isNaN(at.getTime())) return 'invalid';
  const floored = floorToMinute(at).getTime();
  if (floored < now.getTime() + SCHEDULE_MIN_LEAD_MS) return 'too-soon';
  if (floored > now.getTime() + SCHEDULE_MAX_DAYS * DAY_MS) return 'too-far';
  return null;
}

/** The sentence shown in place of the helper when a time breaks a limit. */
export const scheduleProblemMessage = (problem: ScheduleProblem): string =>
  problem === 'too-far'
    ? `Choose a time within the next ${SCHEDULE_MAX_DAYS} days.`
    : problem === 'too-soon'
      ? 'Choose a time at least a minute from now.'
      : 'Choose a date and a time.';

/** The zone label shown beside the picker, such as `GMT+7`. */
export function timezoneLabel(at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
    .formatToParts(at)
    .find((entry) => entry.type === 'timeZoneName');
  return part?.value ?? 'your local time';
}

export interface QuickPick {
  id: 'hour' | 'tonight' | 'tomorrow';
  label: string;
  at: Date;
}

const atClock = (base: Date, dayOffset: number, hours: number): Date =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hours, 0, 0, 0);

/**
 * The quick choices offered under the picker: an hour from now, tonight at 20:00 when that is still
 * at least a minute away, and tomorrow at 09:00.
 */
export function quickPicks(now: Date): QuickPick[] {
  const picks: QuickPick[] = [
    {
      id: 'hour',
      label: 'in 1 hour',
      at: floorToMinute(new Date(now.getTime() + 60 * MINUTE_MS)),
    },
  ];
  const tonight = atClock(now, 0, 20);
  if (tonight.getTime() >= now.getTime() + SCHEDULE_MIN_LEAD_MS + 60 * MINUTE_MS) {
    picks.push({ id: 'tonight', label: 'tonight 20:00', at: tonight });
  }
  picks.push({ id: 'tomorrow', label: 'tomorrow 09:00', at: atClock(now, 1, 9) });
  return picks;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * A short label for a scheduled time in the person's own zone: `today, 20:00`, `tomorrow, 09:00`,
 * or `Sat 24 Oct, 09:00`.
 */
export function formatScheduleLabel(at: Date, now: Date): string {
  const clock = toTimeInput(at);
  if (sameDay(at, now)) return `today, ${clock}`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (sameDay(at, tomorrow)) return `tomorrow, ${clock}`;
  return `${WEEKDAYS[at.getDay()]} ${at.getDate()} ${MONTHS[at.getMonth()]}, ${clock}`;
}
