/**
 * Which record a split screen has open.
 *
 * The selection lives in the address bar under `selected`, so a detail open in
 * the right region has its own URL, that URL restores the same state in a fresh
 * tab, and the browser's back button walks back through the records that were
 * opened before returning to the bare list.
 *
 * `selected` was chosen over a nested route segment because the two split
 * screens cannot both be expressed as a route parent: the account list is
 * administrator-only while the account detail is reachable by a moderator from
 * the action log, so nesting the detail under the list would take a screen away
 * from moderators. A search parameter carries the same addressability without
 * moving either screen inside the other's guard, and every path that worked
 * before still works untouched.
 *
 * A selection that names a record the list does not (or no longer) contains is
 * treated as no selection, so a stale link opens the list rather than an empty
 * detail. Nothing is selected by default: the right region explains itself
 * until a record is picked.
 */
export const SELECTION_PARAM = 'selected';

export function getSplitSelection<T extends object>(
  searchParams: Pick<URLSearchParams, 'get'> | null | undefined,
  rows: T[] = [],
  keyField: keyof T = 'id' as keyof T
) {
  const requested =
    typeof searchParams?.get === 'function' ? searchParams.get(SELECTION_PARAM) : null;

  if (!requested) {
    return { selectedId: null, hasSelection: false, isStale: false };
  }

  const known = rows.some((row) => row?.[keyField] === requested);

  // While the first page is still loading there are no rows to match against.
  // The selection is kept rather than discarded, so opening a shared link does
  // not flash the empty region before the list arrives.
  if (!known && rows.length > 0) {
    return { selectedId: requested, hasSelection: true, isStale: true };
  }

  return { selectedId: requested, hasSelection: true, isStale: false };
}

/**
 * The next search parameters once a record is opened or the detail is closed.
 * Every other parameter — the filters, above all — is carried through, so
 * opening a record never drops the view it was opened from.
 */
export function withSelection(searchParams: URLSearchParams, id: string | null | undefined) {
  const next = new URLSearchParams(searchParams);
  if (id) {
    next.set(SELECTION_PARAM, id);
  } else {
    next.delete(SELECTION_PARAM);
  }
  return next;
}
