import { describe, expect, it } from 'vitest';

import { notificationCopyParts } from '@/features/luvax/notifications/notificationCopy';
import { hasNotificationAction } from '@/features/luvax/notifications/notificationActionKind';
import { scheduleFailureReason } from '@/features/luvax/notifications/scheduleFailureReason';
import { resolveNotificationTarget } from '@/features/luvax/notifications/notificationTarget';
import { notificationFixture, notificationTarget } from '../../fixtures/domain';

describe('post involvement notification copy', () => {
  it.each([
    ['post_tag', 'tagged you in a post'],
    ['post_tag_request', 'wants to tag you in a post'],
    ['post_collaboration_invite', 'invited you to be a co-author of a post'],
    ['post_collaboration_accepted', 'accepted your invitation to co-author a post'],
  ])('words %s as "%s"', (type, phrase) => {
    expect(
      notificationCopyParts({ type, category: 'mention', actors: [], actorCount: 1 }).phrase
    ).toBe(phrase);
  });

  it('treats a failed schedule as a system row with no actor', () => {
    const parts = notificationCopyParts({
      type: 'scheduled_post_failed',
      category: 'system',
      actors: [],
      actorCount: 0,
    });

    expect(parts.isSystem).toBe(true);
    expect(parts.actors).toEqual([]);
  });
});

describe('scheduleFailureReason', () => {
  it.each([
    ['banned_hashtag', 'hashtag'],
    ['place_unavailable', 'place'],
    ['media_unavailable', 'photo or video'],
  ])('explains %s in words the author can act on', (code, word) => {
    expect(scheduleFailureReason(code)).toContain(word);
  });

  it('never shows an unknown code', () => {
    expect(scheduleFailureReason('something_new')).toBe(
      'it could not be published at the scheduled time.'
    );
    expect(scheduleFailureReason(null)).not.toContain('null');
  });
});

describe('post involvement notification actions and targets', () => {
  it.each(['post_tag_request', 'post_collaboration_invite', 'scheduled_post_failed'] as const)(
    'offers an inline action for %s',
    (type) => {
      expect(hasNotificationAction({ ...notificationFixture({ type }) })).toBe(true);
    }
  );

  it('offers none for a plain tag notice', () => {
    expect(
      hasNotificationAction(notificationFixture({ type: 'post_tag', category: 'mention' }))
    ).toBe(false);
  });

  it('opens the post for a tag and the draft in the composer for a failed schedule', () => {
    const target = notificationTarget({ kind: 'post', postId: 'p1' });

    expect(resolveNotificationTarget({ type: 'post_tag', target, moderation: null }).path).toBe(
      '/app/p/p1'
    );
    expect(
      resolveNotificationTarget({ type: 'scheduled_post_failed', target, moderation: null }).path
    ).toBe('/app/compose?draft=p1');
  });

  it('does not navigate to a draft that is no longer available', () => {
    const target = notificationTarget({ kind: 'post', postId: 'p1', available: false });

    expect(
      resolveNotificationTarget({ type: 'scheduled_post_failed', target, moderation: null })
        .isNavigable
    ).toBe(false);
  });
});
