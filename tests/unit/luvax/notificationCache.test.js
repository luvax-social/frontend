import { describe, expect, it } from 'vitest';
import {
  compareActivity,
  itemMatchesFilter,
  markRead,
  markReadUpTo,
  markUnread,
  removeItems,
  upsertItem,
} from '@/features/luvax/notifications/notificationCache';

const item = (overrides = {}) => ({
  id: 'n1',
  type: 'like_post',
  category: 'like',
  actors: [{ id: 'u1', username: 'anna', isVerified: false }],
  actorCount: 1,
  isRead: false,
  readAt: null,
  isNew: true,
  activityAt: '2026-09-23T10:00:00.000000Z',
  createdAt: '2026-09-23T10:00:00.000000Z',
  target: { kind: 'post', postId: 'p1', available: true },
  preview: null,
  moderation: null,
  relationship: null,
  ...overrides,
});

describe('compareActivity', () => {
  it('orders newest first by activityAt then id', () => {
    const a = item({ id: 'a', activityAt: '2026-09-23T10:00:01.000000Z' });
    const b = item({ id: 'b', activityAt: '2026-09-23T10:00:00.000000Z' });
    expect(compareActivity(a, b)).toBeLessThan(0);
    expect(compareActivity(b, a)).toBeGreaterThan(0);
  });

  it('breaks a tie on id, descending', () => {
    const a = item({ id: 'b', activityAt: '2026-09-23T10:00:00.000000Z' });
    const b = item({ id: 'a', activityAt: '2026-09-23T10:00:00.000000Z' });
    expect(compareActivity(a, b)).toBeLessThan(0);
  });
});

describe('upsertItem', () => {
  it('inserts a new item at its sorted position', () => {
    const items = [item({ id: 'old', activityAt: '2026-09-23T09:00:00.000000Z' })];
    const next = upsertItem(items, item({ id: 'new' }));
    expect(next.map((i) => i.id)).toEqual(['new', 'old']);
  });

  it('replaces an existing item by id rather than duplicating it', () => {
    const items = [item({ id: 'n1', actorCount: 1 })];
    const next = upsertItem(items, item({ id: 'n1', actorCount: 2 }));
    expect(next).toHaveLength(1);
    expect(next[0].actorCount).toBe(2);
  });

  it('drops an older copy of the same id when the new one moved position', () => {
    const items = [
      item({ id: 'n1', activityAt: '2026-09-23T08:00:00.000000Z' }),
      item({ id: 'n2', activityAt: '2026-09-23T09:00:00.000000Z' }),
    ];
    const bumped = item({ id: 'n1', activityAt: '2026-09-23T10:00:00.000000Z' });
    const next = upsertItem(items, bumped);
    expect(next.map((i) => i.id)).toEqual(['n1', 'n2']);
    expect(next.filter((i) => i.id === 'n1')).toHaveLength(1);
  });
});

describe('removeItems', () => {
  it('drops every listed id from every cached filter list it appears in', () => {
    const items = [item({ id: 'n1' }), item({ id: 'n2' })];
    expect(removeItems(items, ['n1']).map((i) => i.id)).toEqual(['n2']);
  });

  it('is a no-op for an id not present', () => {
    const items = [item({ id: 'n1' })];
    expect(removeItems(items, ['missing'])).toHaveLength(1);
  });
});

describe('markRead / markUnread', () => {
  it('sets readAt on the listed ids and leaves others untouched', () => {
    const items = [item({ id: 'n1', isRead: false }), item({ id: 'n2', isRead: false })];
    const next = markRead(items, ['n1'], '2026-09-23T10:05:00.000000Z');
    expect(next[0]).toMatchObject({ isRead: true, readAt: '2026-09-23T10:05:00.000000Z' });
    expect(next[1]).toMatchObject({ isRead: false, readAt: null });
  });

  it('markUnread clears readAt', () => {
    const items = [item({ id: 'n1', isRead: true, readAt: '2026-09-23T10:05:00.000000Z' })];
    const next = markUnread(items, ['n1']);
    expect(next[0]).toMatchObject({ isRead: false, readAt: null });
  });
});

describe('markReadUpTo', () => {
  it('marks every row at or below the tuple bound as read, from an {activityAt,id} upTo payload', () => {
    const items = [
      item({ id: 'newer', activityAt: '2026-09-23T11:00:00.000000Z' }),
      item({ id: 'bound', activityAt: '2026-09-23T10:00:00.000000Z' }),
      item({ id: 'older', activityAt: '2026-09-23T09:00:00.000000Z' }),
    ];
    const next = markReadUpTo(
      items,
      { activityAt: '2026-09-23T10:00:00.000000Z', id: 'bound' },
      '2026-09-23T12:00:00.000000Z'
    );
    expect(next.find((i) => i.id === 'newer').isRead).toBe(false);
    expect(next.find((i) => i.id === 'bound').isRead).toBe(true);
    expect(next.find((i) => i.id === 'older').isRead).toBe(true);
  });

  it('clears readAt (marks unread) when readAt is omitted, per the live read-state contract', () => {
    const items = [
      item({ id: 'n1', activityAt: '2026-09-23T09:00:00.000000Z', isRead: true, readAt: 'x' }),
    ];
    const next = markReadUpTo(
      items,
      { activityAt: '2026-09-23T10:00:00.000000Z', id: 'z' },
      undefined
    );
    expect(next[0]).toMatchObject({ isRead: false, readAt: null });
  });
});

describe('itemMatchesFilter', () => {
  it('all matches everything', () => {
    expect(itemMatchesFilter(item(), 'all')).toBe(true);
  });
  it('unread matches only unread rows', () => {
    expect(itemMatchesFilter(item({ isRead: false }), 'unread')).toBe(true);
    expect(itemMatchesFilter(item({ isRead: true }), 'unread')).toBe(false);
  });
  it('category filters match on the category field', () => {
    expect(itemMatchesFilter(item({ category: 'comment' }), 'comments')).toBe(true);
    expect(itemMatchesFilter(item({ category: 'mention' }), 'comments')).toBe(false);
    expect(itemMatchesFilter(item({ category: 'mention' }), 'mentions')).toBe(true);
    expect(itemMatchesFilter(item({ category: 'follow' }), 'follows')).toBe(true);
    expect(itemMatchesFilter(item({ category: 'system' }), 'system')).toBe(true);
  });
  it('verified matches only when the newest actor (actors[0]) is verified', () => {
    expect(itemMatchesFilter(item({ actors: [{ id: 'u1', isVerified: true }] }), 'verified')).toBe(
      true
    );
    expect(itemMatchesFilter(item({ actors: [{ id: 'u1', isVerified: false }] }), 'verified')).toBe(
      false
    );
    expect(itemMatchesFilter(item({ actors: [] }), 'verified')).toBe(false);
  });
});
