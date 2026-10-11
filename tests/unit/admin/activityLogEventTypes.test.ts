import { describe, it, expect } from 'vitest';

import { WRITTEN_EVENT_TYPES } from '@/features/admin/hooks/useUserEvents';

describe('activity log event type filter', () => {
  it('offers every type the application writes, in any build', () => {
    expect(WRITTEN_EVENT_TYPES.map((type) => type.key)).toEqual([
      'session_start',
      'search',
      'profile_view',
      'post_like',
      'post_save',
      'post_view',
      'post_comment',
      'comment_like',
      'post_share',
    ]);
  });

  it('gives every offered type a label and a hint', () => {
    for (const type of WRITTEN_EVENT_TYPES) {
      expect(type.label).toBeTruthy();
      expect(type.hint).toBeTruthy();
    }
  });
});
