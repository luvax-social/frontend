import { describe, expect, it } from 'vitest';

import {
  checkSchedule,
  floorToMinute,
  formatScheduleLabel,
  fromInputs,
  quickPicks,
  SCHEDULE_MAX_DAYS,
  scheduleProblemMessage,
  toDateInput,
  toTimeInput,
} from '@/features/luvax/utils/scheduleTime';

const NOW = new Date(2026, 9, 22, 10, 30, 45, 500);

describe('floorToMinute', () => {
  it('drops seconds and milliseconds', () => {
    const floored = floorToMinute(NOW);

    expect(floored.getSeconds()).toBe(0);
    expect(floored.getMilliseconds()).toBe(0);
    expect(floored.getMinutes()).toBe(30);
  });

  it('leaves a whole minute unchanged', () => {
    const whole = new Date(2026, 9, 22, 11, 0, 0, 0);

    expect(floorToMinute(whole).getTime()).toBe(whole.getTime());
  });
});

describe('date and time inputs', () => {
  it('round-trips a local instant through the two input values', () => {
    const at = new Date(2026, 9, 24, 9, 5);

    expect(toDateInput(at)).toBe('2026-10-24');
    expect(toTimeInput(at)).toBe('09:05');
    expect(fromInputs('2026-10-24', '09:05')?.getTime()).toBe(at.getTime());
  });

  it('reads the inputs as local wall-clock time, not as UTC', () => {
    const at = fromInputs('2026-10-24', '09:00');

    expect(at?.getHours()).toBe(9);
    expect(at?.getDate()).toBe(24);
  });

  it('sends the same instant to the backend as an ISO string in UTC', () => {
    const at = fromInputs('2026-10-24', '09:00');

    expect(new Date(at!.toISOString()).getTime()).toBe(at!.getTime());
    expect(at!.toISOString().endsWith('Z')).toBe(true);
  });

  it.each([
    ['', '09:00'],
    ['2026-10-24', ''],
    ['24/10/2026', '09:00'],
    ['2026-10-24', '9am'],
    ['2026-02-31', '09:00'],
    ['2026-10-24', '25:00'],
  ])('rejects %j at %j', (date, time) => {
    expect(fromInputs(date, time)).toBeNull();
  });
});

describe('checkSchedule', () => {
  it('accepts a time well inside both limits', () => {
    expect(checkSchedule(new Date(NOW.getTime() + 3_600_000), NOW)).toBeNull();
  });

  it('accepts exactly one minute ahead after flooring', () => {
    const now = new Date(2026, 9, 22, 10, 30, 0, 0);

    expect(checkSchedule(new Date(2026, 9, 22, 10, 31, 0, 0), now)).toBeNull();
  });

  it('refuses a time less than a minute ahead and one in the past', () => {
    const now = new Date(2026, 9, 22, 10, 30, 0, 0);

    expect(checkSchedule(new Date(2026, 9, 22, 10, 30, 59, 0), now)).toBe('too-soon');
    expect(checkSchedule(new Date(2026, 9, 22, 9, 0, 0, 0), now)).toBe('too-soon');
  });

  it('refuses a time more than thirty days ahead', () => {
    const now = new Date(2026, 9, 22, 10, 30, 0, 0);
    const limit = new Date(now.getTime() + SCHEDULE_MAX_DAYS * 24 * 60 * 60_000);

    expect(checkSchedule(limit, now)).toBeNull();
    expect(checkSchedule(new Date(limit.getTime() + 60_000), now)).toBe('too-far');
  });

  it('refuses missing input', () => {
    expect(checkSchedule(null, NOW)).toBe('invalid');
    expect(checkSchedule(new Date(Number.NaN), NOW)).toBe('invalid');
  });

  it('words each problem as a sentence', () => {
    expect(scheduleProblemMessage('too-far')).toBe('Choose a time within the next 30 days.');
    expect(scheduleProblemMessage('too-soon')).toContain('a minute');
    expect(scheduleProblemMessage('invalid')).toContain('date');
  });
});

describe('quickPicks', () => {
  it('offers an hour from now floored to the minute', () => {
    const pick = quickPicks(NOW).find((entry) => entry.id === 'hour');

    expect(pick?.at.getTime()).toBe(floorToMinute(new Date(NOW.getTime() + 3_600_000)).getTime());
  });

  it('offers tonight only while it is still comfortably ahead', () => {
    expect(quickPicks(NOW).some((entry) => entry.id === 'tonight')).toBe(true);
    expect(quickPicks(new Date(2026, 9, 22, 19, 30)).some((entry) => entry.id === 'tonight')).toBe(
      false
    );
  });

  it('always offers tomorrow at 09:00 and every offer passes the check', () => {
    const picks = quickPicks(NOW);
    const tomorrow = picks.find((entry) => entry.id === 'tomorrow');

    expect(tomorrow && toTimeInput(tomorrow.at)).toBe('09:00');
    expect(tomorrow?.at.getDate()).toBe(23);
    picks.forEach((pick) => expect(checkSchedule(pick.at, NOW)).toBeNull());
  });
});

describe('formatScheduleLabel', () => {
  it('names today and tomorrow', () => {
    expect(formatScheduleLabel(new Date(2026, 9, 22, 20, 0), NOW)).toBe('today, 20:00');
    expect(formatScheduleLabel(new Date(2026, 9, 23, 9, 0), NOW)).toBe('tomorrow, 09:00');
  });

  it('writes a date for any later day', () => {
    expect(formatScheduleLabel(new Date(2026, 9, 24, 9, 0), NOW)).toBe('Sat 24 Oct, 09:00');
  });
});
