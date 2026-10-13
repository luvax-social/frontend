import { useEffect } from 'react';

/**
 * Keeps a cursor-paginated list advancing while it has nothing to show yet.
 *
 * The saved and liked endpoints can answer with fewer rows than the requested
 * limit, including none at all, while further pages still exist. This happens
 * because the like or save record outlives the post behind it, and the
 * unavailable posts are filtered out after the page boundary has already been
 * chosen. A page is therefore not a reliable signal of how much is left; only
 * `pageInfo.hasNextPage` is.
 *
 * Two failures follow from treating a short page as the end, and this hook
 * exists to prevent both.
 *
 * The first is a false statement. A screen that renders "nothing saved yet"
 * because the first page came back empty is asserting something about the
 * viewer's data that nobody has established. The rows may be on page two.
 *
 * The second is a dead list. An infinite scroll whose sentinel renders only
 * when there is at least one row never mounts that sentinel on an empty first
 * page, so nothing ever triggers the next fetch and the list stops for good.
 * Driving the fetch from the row count rather than from a viewport sentinel
 * removes that dependency.
 *
 * Consumers should render a loading state rather than an empty state while
 * `isDraining` is true, so an empty page in the middle of a list never reads
 * as the end of it.
 * @param {Object} args
 * @param {number} args.rowCount - Rows accumulated across every page so far.
 * @param {boolean} args.hasNextPage - The server's own answer, not a page-length guess.
 * @param {boolean} args.isFetchingNextPage - Guards against issuing overlapping fetches.
 * @param {Function} args.fetchNextPage - The infinite query's fetcher.
 * @param {boolean} [args.enabled] - Set false while the query is disabled or errored.
 * @returns {{isDraining: boolean}} Whether the list is still resolving its first visible row.
 */
export function useDrainEmptyPages({
  rowCount,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  enabled = true,
}: {
  rowCount: number;
  hasNextPage?: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  enabled?: boolean;
}) {
  const isDraining = Boolean(enabled && rowCount === 0 && hasNextPage);

  useEffect(() => {
    if (isDraining && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isDraining, isFetchingNextPage, fetchNextPage]);

  return { isDraining };
}
