import { describe, expect, it } from 'vitest';

import { mediaAltLabel } from '@/utils/mediaAlt';

describe('mediaAltLabel', () => {
  it('returns the authored alt text when there is some', () => {
    expect(
      mediaAltLabel({ altText: 'A boat at dawn', mediaType: 'image' }, 0, 1, { username: 'an' })
    ).toBe('A boat at dawn');
  });

  it('trims the authored text and ignores a blank one', () => {
    expect(mediaAltLabel({ altText: '  ', mediaType: 'image' }, 0, 1, { username: 'an' })).toBe(
      'Photo by @an'
    );
  });

  it('labels a single photo and a single video by kind and author', () => {
    expect(mediaAltLabel({ mediaType: 'image' }, 0, 1, { username: 'an' })).toBe('Photo by @an');
    expect(mediaAltLabel({ mediaType: 'video' }, 0, 1, { username: 'an' })).toBe('Video by @an');
  });

  it('adds the position when the post holds several items', () => {
    expect(mediaAltLabel({ mediaType: 'image' }, 1, 4, { username: 'an' })).toBe(
      'Photo 2 of 4 by @an'
    );
    expect(mediaAltLabel({ mediaType: 'video' }, 3, 4, { username: 'an' })).toBe(
      'Video 4 of 4 by @an'
    );
  });

  it('drops the author when there is no username', () => {
    expect(mediaAltLabel({ mediaType: 'image' }, 0, 2, { username: null })).toBe('Photo 1 of 2');
    expect(mediaAltLabel({ mediaType: 'image' }, 0, 1, null)).toBe('Photo');
  });

  it('never returns an empty string', () => {
    expect(mediaAltLabel(null, 0, 1)).toBe('Photo');
    expect(mediaAltLabel(undefined, 0, 1, undefined)).toBe('Photo');
  });
});
