import { describe, it, expect } from 'vitest';
import { dedupeInfinitePagesById } from '@/utils/helpers';

const page = (ids: string[]) => ({ data: { content: ids.map((id) => ({ id })), pageInfo: {} } });

describe('dedupeInfinitePagesById', () => {
  it('keeps every id when nothing repeats', () => {
    const data = { pages: [page(['a', 'b']), page(['c', 'd'])], pageParams: [null, 'x'] };
    const result = dedupeInfinitePagesById(data);
    expect(result.pages[0].data.content.map((r) => r.id)).toEqual(['a', 'b']);
    expect(result.pages[1].data.content.map((r) => r.id)).toEqual(['c', 'd']);
  });

  it('drops a later occurrence and keeps the first', () => {
    const data = { pages: [page(['a', 'b']), page(['b', 'c'])], pageParams: [null, 'x'] };
    const result = dedupeInfinitePagesById(data);
    expect(result.pages[0].data.content.map((r) => r.id)).toEqual(['a', 'b']);
    expect(result.pages[1].data.content.map((r) => r.id)).toEqual(['c']);
  });

  it('preserves pageParams and page count untouched', () => {
    const data = { pages: [page(['a']), page(['a'])], pageParams: [null, 'x'] };
    const result = dedupeInfinitePagesById(data);
    expect(result.pageParams).toEqual([null, 'x']);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[1].data.content).toEqual([]);
  });

  it('handles an empty pages array', () => {
    const result = dedupeInfinitePagesById({ pages: [], pageParams: [] });
    expect(result.pages).toEqual([]);
  });
});
