import type { ReactNode } from 'react';
import { isValidElement, useEffect, useRef } from 'react';

import { LxIcon } from '@/components/ui/lx-icon';
import { v } from '@/config/tokens';

/**
 * Derived pattern: the panel's master and detail layout. The design export
 * covers no working surface of this kind, so the two regions are built from the
 * existing surface, border and spacing tokens.
 *
 * The list holds the left region and the selected record fills the right. Both
 * regions scroll on their own, so a long detail never scrolls the list away.
 * Because the list is one component instance that stays mounted while the
 * selection changes, selecting another record swaps only the right region: the
 * list keeps its scroll offset and every page it has already loaded, and it
 * issues no further request.
 *
 * At a narrow width the split is not a split. The stylesheet hides whichever
 * region is not in play, so the list is the whole screen until a record is
 * opened and the detail is the whole screen afterwards, with a way back. That
 * is a layout change rather than a horizontally scrolling pair of panes.
 */
export function SplitView({
  list,
  detail,
  hasSelection,
  onClose,
  backLabel = 'back to the list',
  emptyTitle = 'nothing selected',
  emptyHint = 'pick a record from the list to see it here.',
  emptyIcon = 'explore',
}: {
  list: ReactNode;
  detail: ReactNode;
  hasSelection: boolean;
  onClose: () => void;
  backLabel?: string;
  emptyTitle?: string;
  emptyHint?: string;
  emptyIcon?: string;
}) {
  const detailRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  // When the open record changes, focus moves to the detail region and it is
  // scrolled back to its own top. Without this, opening a second record from
  // the list would leave focus on the row and the detail scrolled to wherever
  // the previous one was left.
  const detailKey = isValidElement(detail) ? detail.key : undefined;
  useEffect(() => {
    if (!hasSelection) return;
    if (detailRef.current) detailRef.current.scrollTop = 0;
    if (headingRef.current) headingRef.current.focus();
  }, [hasSelection, detailKey]);

  return (
    <div className={`lx-admin-split${hasSelection ? ' has-selection' : ''}`}>
      <div className="lx-admin-split-list">{list}</div>

      <div className="lx-admin-split-detail" ref={detailRef}>
        {hasSelection ? (
          <>
            <button type="button" className="lx-admin-back" onClick={onClose}>
              <LxIcon name="chevronLeft" size={14} color={v.ink2} />
              {backLabel}
            </button>
            {/* Takes focus when the open record changes; not a tab stop of its own. */}
            <div ref={headingRef} tabIndex={-1} style={{ outline: 'none' }}>
              {detail}
            </div>
          </>
        ) : (
          <div className="lx-admin-detail-empty">
            <LxIcon name={emptyIcon} size={22} color={v.ink2} />
            <h2>{emptyTitle}</h2>
            <p>{emptyHint}</p>
          </div>
        )}
      </div>
    </div>
  );
}
