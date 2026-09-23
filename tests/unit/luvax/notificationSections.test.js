import { describe, expect, it } from 'vitest';
import { SECTION_ORDER, bucketFor, sectionFor } from '@/features/luvax/notifications/notificationSections';

const NOW = new Date('2026-09-23T12:00:00.000Z');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600_000).toISOString();
const daysAgo = (d) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe('bucketFor', () => {
  it('under 24 hours is today', () => {
    expect(bucketFor(hoursAgo(23), NOW)).toBe('today');
  });
  it('exactly 24 hours is no longer today', () => {
    expect(bucketFor(hoursAgo(24), NOW)).not.toBe('today');
  });
  it('under 7 days is this week', () => {
    expect(bucketFor(daysAgo(6), NOW)).toBe('this week');
  });
  it('exactly 7 days is no longer this week', () => {
    expect(bucketFor(daysAgo(7), NOW)).not.toBe('this week');
  });
  it('under 30 days is this month', () => {
    expect(bucketFor(daysAgo(29), NOW)).toBe('this month');
  });
  it('30 days or more is earlier', () => {
    expect(bucketFor(daysAgo(30), NOW)).toBe('earlier');
  });
});

describe('sectionFor', () => {
  it('an isNew row is always "new", regardless of age', () => {
    expect(sectionFor({ isNew: true, activityAt: daysAgo(40) }, NOW)).toBe('new');
  });
  it('a non-new row falls into its rolling bucket', () => {
    expect(sectionFor({ isNew: false, activityAt: hoursAgo(1) }, NOW)).toBe('today');
  });
});

it('SECTION_ORDER lists new first and earlier last', () => {
  expect(SECTION_ORDER).toEqual(['new', 'today', 'this week', 'this month', 'earlier']);
});
