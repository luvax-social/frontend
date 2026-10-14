import { useEffect, useRef, useState } from 'react';

import { v } from '@/config/tokens';

import { useNotInterested, useShowFewer } from '../../hooks/useFeedPreferences';
import type { PostDismissal } from '../../store/useDismissedPostsStore';
import { LxBtn } from '../primitives';

const UNDO_FAILED = "We couldn't undo that just now. Try again in a moment.";

/**
 * The row that stands in for a post the viewer dismissed from the feed.
 *
 * It takes the card's place in the list, so nothing around it is reordered, and stays until the
 * next fetch leaves the post out. Undo calls the matching DELETE and clears the dismissal, which
 * brings the card back from the list data it never left. A refused undo keeps the row and says
 * so. Focus lands on undo when the row appears, because the menu item that dismissed the post
 * left the page with the card.
 */
export function DismissedPostRow({
  postId,
  dismissal,
}: {
  postId: string;
  dismissal: PostDismissal;
}) {
  const [failure, setFailure] = useState('');
  const onError = () => setFailure(UNDO_FAILED);
  const notInterested = useNotInterested({ onError });
  const showFewer = useShowFewer({ onError });
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    rowRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, []);

  const isFewer = dismissal.kind === 'show-fewer';
  const undo = () => {
    setFailure('');
    if (isFewer) showFewer.undo.mutate({ postId, authorId: dismissal.authorId });
    else notInterested.undo.mutate({ postId });
  };

  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={isFewer ? 'fewer posts from this account' : 'post hidden'}
      style={{
        background: v.surface,
        borderRadius: 12,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        border: `1px dashed ${v.borderStrong}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: v.fontBody, fontSize: 15, fontWeight: 500, color: v.ink }}>
          {isFewer ? `you'll see fewer posts from @${dismissal.authorHandle}` : 'post hidden'}
        </div>
        <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2, marginTop: 2 }}>
          {isFewer
            ? "This only changes for you and explore. You'll still see them in following."
            : "We'll show you fewer posts like this."}
        </div>
        {failure ? (
          <div
            role="alert"
            style={{ fontFamily: v.fontBody, fontSize: 12, color: v.errorText, marginTop: 4 }}
          >
            {failure}
          </div>
        ) : null}
      </div>
      <LxBtn variant="secondary" size="sm" type="button" onClick={undo}>
        undo
      </LxBtn>
    </div>
  );
}
