import { describe, it, expect } from 'vitest';
import {
  interleaveFeed,
  CARD_TYPES,
  FIRST_SLOT,
  SLOT_STRIDE,
} from '@/features/luvax/utils/feedInterleave';

const posts = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));
const all = { people: true, hashtags: true };
const none = { people: false, hashtags: false };
const kinds = (items) =>
  items.map((item) => (item.kind === 'post' ? item.post.id : `[${item.type}]`));

describe('interleaveFeed', () => {
  it('exports the cadence the design settled on', () => {
    expect(FIRST_SLOT).toBe(3);
    expect(SLOT_STRIDE).toBe(5);
    expect(CARD_TYPES).toEqual(['people', 'hashtags']);
  });

  it('places the first card after three posts and every five thereafter', () => {
    const result = kinds(interleaveFeed(posts(14), all, []));
    expect(result.indexOf('[people]')).toBe(3);
    expect(result.indexOf('[hashtags]')).toBe(9);
  });

  it('rotates the type at each slot and then stops', () => {
    const result = kinds(interleaveFeed(posts(20), all, [])).filter((x) => x.startsWith('['));
    // Two types, two cards. Later slots stay empty rather than starting the rotation again with
    // the same content.
    expect(result).toEqual(['[people]', '[hashtags]']);
  });

  it('repeats a paged type up to its page count, and no further', () => {
    const result = kinds(interleaveFeed(posts(60), { people: 3, hashtags: false }, [])).filter(
      (x) => x.startsWith('[')
    );
    expect(result).toEqual(['[people]', '[people]', '[people]']);
  });

  it('numbers each appearance so a paged card knows which page is its own', () => {
    const items = interleaveFeed(posts(60), { people: 3, hashtags: false }, []).filter(
      (item) => item.kind === 'card'
    );
    expect(items.map((item) => item.occurrence)).toEqual([0, 1, 2]);
  });

  it('treats a page count of zero as no data', () => {
    const result = kinds(interleaveFeed(posts(9), { people: 0 }, []));
    expect(result.filter((x) => x.startsWith('['))).toHaveLength(0);
  });

  it('never repeats a once-only card type however long the feed is', () => {
    const result = kinds(interleaveFeed(posts(60), all, [])).filter((x) => x.startsWith('['));
    expect(result).toHaveLength(new Set(result).size);
  });

  it('gives the slot to the next eligible type when one has no data', () => {
    const result = kinds(interleaveFeed(posts(9), { people: false, hashtags: true }, []));
    expect(result[3]).toBe('[hashtags]');
    expect(result.filter((x) => x === '[people]')).toHaveLength(0);
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
    expect(kinds(interleaveFeed(posts(2), all, []))).toEqual(['p1', 'p2', '[people]']);
  });

  it('appends nothing to a short feed when no card has data', () => {
    expect(kinds(interleaveFeed(posts(2), none, []))).toEqual(['p1', 'p2']);
  });

  it('appends a card even when there are no posts at all', () => {
    expect(kinds(interleaveFeed([], all, []))).toEqual(['[people]']);
  });

  it('gives a dismissed type its slot to the next eligible one, in every slot', () => {
    const result = kinds(interleaveFeed(posts(20), all, ['people']));
    expect(result[3]).toBe('[hashtags]');
    // The point of keying dismissal on the type: it stays gone, rather than returning at the next
    // slot the way a slot-keyed dismissal would.
    expect(result.filter((x) => x === '[people]')).toHaveLength(0);
  });

  it('shows the one remaining type once when the other is dismissed', () => {
    const result = kinds(interleaveFeed(posts(9), all, ['people'])).filter((x) =>
      x.startsWith('[')
    );
    expect(result).toEqual(['[hashtags]']);
  });

  it('gives every card a stable key', () => {
    const items = interleaveFeed(posts(14), all, []).filter((item) => item.kind === 'card');
    expect(items.map((item) => item.key)).toEqual(['people-0', 'hashtags-0']);
    expect(new Set(items.map((item) => item.key)).size).toBe(2);
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
