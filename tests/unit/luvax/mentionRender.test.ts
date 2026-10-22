import { describe, expect, it } from 'vitest';

import { splitMentions } from '@/features/luvax/utils/mentionRender';
import type { PostMentionResponse } from '@/types/domain';

const mention = (handle: string, username = handle): PostMentionResponse => ({
  handle,
  userId: `id-${username}`,
  username,
});

describe('splitMentions', () => {
  it('returns no segments for empty text', () => {
    expect(splitMentions(null, [mention('an.pham')])).toEqual([]);
    expect(splitMentions('', [mention('an.pham')])).toEqual([]);
  });

  it('keeps the whole text plain when nothing is stored', () => {
    expect(splitMentions('hi @an.pham', [])).toEqual([{ text: 'hi @an.pham' }]);
    expect(splitMentions('hi @an.pham', undefined)).toEqual([{ text: 'hi @an.pham' }]);
  });

  it('links a stored handle that contains a dot', () => {
    const stored = mention('an.pham');

    expect(splitMentions('Morning with @an.pham and friends', [stored])).toEqual([
      { text: 'Morning with ' },
      { text: '@an.pham', mention: stored },
      { text: ' and friends' },
    ]);
  });

  it('leaves the final dot of a sentence as text', () => {
    const stored = mention('jane.doe');

    expect(splitMentions('thanks @jane.doe.', [stored])).toEqual([
      { text: 'thanks ' },
      { text: '@jane.doe', mention: stored },
      { text: '.' },
    ]);
  });

  it('matches case-insensitively and links to the current username', () => {
    const stored = mention('Linh.Ng', 'linh.ng');

    const segments = splitMentions('with @LINH.NG today', [stored]);

    expect(segments[1]).toEqual({ text: '@LINH.NG', mention: stored });
  });

  it('never links an @name the server did not store', () => {
    const stored = mention('an.pham');

    expect(splitMentions('@stranger and @an.pham', [stored])).toEqual([
      { text: '@stranger and ' },
      { text: '@an.pham', mention: stored },
    ]);
  });

  it('does not read the @ of an email address as a mention', () => {
    expect(splitMentions('mail me at a@an.pham', [mention('an.pham')])).toEqual([
      { text: 'mail me at a@an.pham' },
    ]);
  });

  it('concatenates back to the input', () => {
    const text = '@a and @b.c, then @a again.';
    const segments = splitMentions(text, [mention('a'), mention('b.c')]);

    expect(segments.map((segment) => segment.text).join('')).toBe(text);
  });
});
