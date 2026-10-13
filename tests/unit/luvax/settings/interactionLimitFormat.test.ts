import { afterEach, describe, expect, it } from 'vitest';

import { formatLimitEnd } from '@/features/luvax/utils/interactionLimitFormat';

const originalZone = process.env.TZ;

// Recent ICU releases put a narrow no-break space before AM and PM.
const plain = (text: string) => text.replace(/ /g, ' ');

afterEach(() => {
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
});

describe('formatLimitEnd', () => {
  it('writes the end in the timezone of the viewer, not in UTC', () => {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    expect(plain(formatLimitEnd('2026-10-17T14:40:00Z', 'en-US'))).toBe('Sat, Oct 17, 9:40 PM');

    process.env.TZ = 'America/Los_Angeles';
    expect(plain(formatLimitEnd('2026-10-17T14:40:00Z', 'en-US'))).toBe('Sat, Oct 17, 7:40 AM');
  });

  it('moves to the next local day when the offset crosses midnight', () => {
    process.env.TZ = 'Pacific/Auckland';
    expect(plain(formatLimitEnd('2026-10-17T14:40:00Z', 'en-US'))).toBe('Sun, Oct 18, 3:40 AM');
  });

  it('returns an empty string for a missing or unreadable value', () => {
    expect(formatLimitEnd(null)).toBe('');
    expect(formatLimitEnd('not a date')).toBe('');
  });
});
