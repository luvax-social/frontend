import { describe, expect, it } from 'vitest';
import { notificationCopyParts } from '@/features/luvax/notifications/notificationCopy';

const actor = (id) => ({ id, username: id, isVerified: false });

describe('notificationCopyParts', () => {
  it('builds the phrase for a like_post row with one actor', () => {
    const parts = notificationCopyParts({
      type: 'like_post',
      category: 'like',
      actors: [actor('anna')],
      actorCount: 1,
    });
    expect(parts).toMatchObject({ isSystem: false, phrase: 'liked your post', othersCount: 0 });
    expect(parts.actors).toHaveLength(1);
  });

  it('computes othersCount from actorCount minus the visible actors', () => {
    const parts = notificationCopyParts({
      type: 'like_post',
      category: 'like',
      actors: [actor('anna'), actor('ben')],
      actorCount: 14,
    });
    expect(parts.othersCount).toBe(12);
  });

  it('never returns a negative othersCount even if actorCount is stale-low', () => {
    const parts = notificationCopyParts({
      type: 'follow',
      category: 'follow',
      actors: [actor('anna')],
      actorCount: 0,
    });
    expect(parts.othersCount).toBe(0);
  });

  it.each([
    ['like_post', 'liked your post'],
    ['like_comment', 'liked your comment'],
    ['comment_post', 'commented on your post'],
    ['reply_comment', 'replied to your comment'],
    ['follow', 'started following you'],
    ['mention_post', 'mentioned you in a post'],
    ['mention_comment', 'mentioned you in a comment'],
    ['story_view', 'viewed your story'],
  ])('phrase for %s is %s', (type, expected) => {
    expect(
      notificationCopyParts({ type, category: 'x', actors: [actor('a')], actorCount: 1 }).phrase
    ).toBe(expected);
  });

  it.each([
    ['warning', 'issued a warning on your account'],
    ['post_removed', 'removed your post'],
    ['comment_removed', 'removed your comment'],
    ['story_removed', 'removed your story'],
    ['message_removed', 'removed your message'],
    ['report_post_removed', 'removed content you reported'],
    ['post_restored', 'restored your post'],
    ['report_dismissed', 'reviewed your report and took no action'],
    ['support_ticket_update', 'responded to your support ticket'],
  ])('system phrase for %s is %s, with no actor', (type, expected) => {
    const parts = notificationCopyParts({ type, category: 'system', actors: [], actorCount: 0 });
    expect(parts).toMatchObject({ isSystem: true, phrase: expected, othersCount: 0 });
    expect(parts.actors).toEqual([]);
  });

  it('a system row ignores any actor the server still attaches (defence in depth for D6)', () => {
    // Category alone decides isSystem; a stray actor on a support/warning row must never surface,
    // matching the backend contract that these carry no actor at all (P1 section 4, deviation D6).
    const parts = notificationCopyParts({
      type: 'support_ticket_update',
      category: 'system',
      actors: [actor('staff-member')],
      actorCount: 1,
    });
    expect(parts.isSystem).toBe(true);
    expect(parts.actors).toEqual([]);
  });
});
