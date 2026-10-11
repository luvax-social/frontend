import { describe, expect, it } from 'vitest';

import {
  SELECTION_PARAM,
  getSplitSelection,
  withSelection,
} from '@/features/admin/lib/splitSelection';

const params = (init: string) => new URLSearchParams(init);
const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('getSplitSelection', () => {
  it('reports no selection when the parameter is absent', () => {
    expect(getSplitSelection(params(''), rows)).toEqual({
      selectedId: null,
      hasSelection: false,
      isStale: false,
    });
  });

  it('reports no selection when the parameter is empty', () => {
    expect(getSplitSelection(params('selected='), rows).hasSelection).toBe(false);
  });

  it('selects a record the list contains', () => {
    expect(getSplitSelection(params('selected=b'), rows)).toEqual({
      selectedId: 'b',
      hasSelection: true,
      isStale: false,
    });
  });

  it('marks a selection the loaded list does not contain as stale', () => {
    const result = getSplitSelection(params('selected=zz'), rows);
    expect(result.selectedId).toBe('zz');
    expect(result.isStale).toBe(true);
  });

  it('keeps the selection while the list has not loaded, so a shared link does not flash empty', () => {
    const result = getSplitSelection(params('selected=zz'), []);
    expect(result).toEqual({ selectedId: 'zz', hasSelection: true, isStale: false });
  });

  it('reads a plain object as well as URLSearchParams', () => {
    expect(getSplitSelection(params('selected=a'), rows).selectedId).toBe('a');
  });

  it('honours a custom key field', () => {
    const result = getSplitSelection(params('selected=7'), [{ reportId: '7' }], 'reportId');
    expect(result).toEqual({ selectedId: '7', hasSelection: true, isStale: false });
  });
});

describe('withSelection', () => {
  it('sets the selection and keeps every other parameter', () => {
    const next = withSelection(params('status=pending&reportType=post'), 'b');
    expect(next.get(SELECTION_PARAM)).toBe('b');
    expect(next.get('status')).toBe('pending');
    expect(next.get('reportType')).toBe('post');
  });

  it('drops the selection but keeps the filters when closing the detail', () => {
    const next = withSelection(params('status=pending&selected=b'), null);
    expect(next.get(SELECTION_PARAM)).toBeNull();
    expect(next.get('status')).toBe('pending');
  });

  it('replaces an existing selection rather than appending a second one', () => {
    const next = withSelection(params('selected=a'), 'c');
    expect(next.getAll(SELECTION_PARAM)).toEqual(['c']);
  });
});
