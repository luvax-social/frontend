import { describe, it, expect } from 'vitest';
import {
  interleaveFeed,
  CARD_TYPES,
  FIRST_SLOT,
  SLOT_STRIDE,
} from '@/features/luvax/utils/feedInterleave';

const posts = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));
const all = { stories: true, people: true, hashtags: true };
const none = { stories: false, people: false, hashtags: false };
const kinds = (items) =>
  items.map((item) => (item.kind === 'post' ? item.post.id : `[${item.type}]`));

describe('interleaveFeed', () => {
  it('exports the cadence the design settled on', () => {
    expect(FIRST_SLOT).toBe(3);
    expect(SLOT_STRIDE).toBe(5);
    expect(CARD_TYPES).toEqual(['stories', 'people', 'hashtags']);
  });

  it('places the first card after three posts and every five thereafter', () => {
    const result = kinds(interleaveFeed(posts(14), all, []));
    expect(result.indexOf('[stories]')).toBe(3);
    expect(result.indexOf('[people]')).toBe(9);
    expect(result.indexOf('[hashtags]')).toBe(15);
  });

  it('rotates the type at each slot', () => {
    const result = kinds(interleaveFeed(posts(20), all, [])).filter((x) => x.startsWith('['));
    expect(result).toEqual(['[stories]', '[people]', '[hashtags]', '[stories]']);
  });

  it('gives the slot to the next eligible type when one has no data', () => {
    const result = kinds(
      interleaveFeed(posts(9), { stories: false, people: true, hashtags: true }, [])
    );
    expect(result[3]).toBe('[people]');
    expect(result.filter((x) => x === '[stories]')).toHaveLength(0);
  });

  it('does not advance the rotation past a type it skipped', () => {
    const result = kinds(
      interleaveFeed(posts(14), { stories: false, people: true, hashtags: true }, [])
    ).filter((x) => x.startsWith('['));
    expect(result).toEqual(['[people]', '[hashtags]', '[people]']);
  });

  it('leaves the slot empty rather than inserting a card with no data', () => {
    const result = kinds(interleaveFeed(posts(9), none, []));
    expect(result).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']);
  });

  it('never places two cards adjacent', () => {
    const items = interleaveFeed(posts(30), all, []);
    items.forEach((item, i) => {
      if (i > 0 && item.kind === 'card') {
        expect(items[i - 1].kind).toBe('post');
      }
    });
  });

  it('appends one card when the feed is shorter than the first slot', () => {
    expect(kinds(interleaveFeed(posts(2), all, []))).toEqual(['p1', 'p2', '[stories]']);
  });

  it('appends nothing to a short feed when no card has data', () => {
    expect(kinds(interleaveFeed(posts(2), none, []))).toEqual(['p1', 'p2']);
  });

  it('appends a card even when there are no posts at all', () => {
    expect(kinds(interleaveFeed([], all, []))).toEqual(['[stories]']);
  });

  it('gives a dismissed type its slot to the next eligible one, in every slot', () => {
    const result = kinds(interleaveFeed(posts(20), all, ['stories']));
    expect(result[3]).toBe('[people]');
    // The point of keying dismissal on the type: it stays gone, rather than returning at the next
    // slot the way a slot-keyed dismissal would.
    expect(result.filter((x) => x === '[stories]')).toHaveLength(0);
  });

  it('keeps rendering the one remaining type when the others are dismissed', () => {
    const result = kinds(interleaveFeed(posts(9), all, ['stories', 'people'])).filter((x) =>
      x.startsWith('[')
    );
    expect(result).toEqual(['[hashtags]', '[hashtags]']);
  });

  it('gives every card a stable key', () => {
    const items = interleaveFeed(posts(14), all, []).filter((item) => item.kind === 'card');
    expect(items.map((item) => item.key)).toEqual(['stories-0', 'people-1', 'hashtags-2']);
    expect(new Set(items.map((item) => item.key)).size).toBe(3);
  });

  it('does not care where API page boundaries fell', () => {
    const one = posts(12);
    const fromOnePage = kinds(interleaveFeed(one, all, []));
    const fromThreePages = kinds(
      interleaveFeed([...one.slice(0, 5), ...one.slice(5, 8), ...one.slice(8)], all, [])
    );
    expect(fromOnePage).toEqual(fromThreePages);
  });

  it('treats a missing availability entry as no data', () => {
    expect(kinds(interleaveFeed(posts(4), {}, []))).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('defaults its arguments so a first render before any query resolves is safe', () => {
    expect(interleaveFeed()).toEqual([]);
  });
});
