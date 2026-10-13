import { v } from '@/config/tokens';
import { LxBtn } from '@/features/luvax/components/primitives';

/**
 * Derived pattern: a load-more affordance driven by `hasNextPage`. An explicit
 * button is used rather than an auto-loading sentinel, because a dense
 * moderation table reads better when the reviewer chooses to extend it. No
 * numbered pagination exists anywhere in the panel: no list endpoint returns a
 * total, so a page count cannot exist.
 *
 * Renders nothing once `hasNextPage` is false, which is the only correct
 * termination signal.
 */
export function LoadMore({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore: () => unknown;
}) {
  if (!hasNextPage) {
    return null;
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '18px 0 6px' }}>
      <LxBtn
        variant="secondary"
        size="sm"
        onClick={onLoadMore}
        disabled={isFetchingNextPage}
        style={{ color: v.ink2 }}
      >
        {isFetchingNextPage ? 'loading...' : 'load more'}
      </LxBtn>
    </div>
  );
}
