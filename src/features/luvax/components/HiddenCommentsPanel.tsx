import type { CSSProperties } from 'react';
import type { HiddenCommentReason, HiddenCommentResponse } from '@/types/domain';
import type { ReportTarget } from '@/types/report';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HTTP_STATUS } from '@/config/constants';
import { v } from '@/config/tokens';
import { REPORT_TYPES } from '@/services/report.service';
import { getErrorResponse } from '@/utils/errors';
import { extractPageContent, getDisplayName } from '@/utils/helpers';
import { LxAvatar, LxBtn, LxIcon } from './primitives';
import { ReportModal } from './ReportModal';
import {
  isParentStillHidden,
  useHiddenComments,
  useUnhideComment,
} from '../hooks/useHiddenComments';
import { useRelativeTime } from '../hooks/useRelativeTime';

const REASON_COPY: Record<HiddenCommentReason, string> = {
  hidden_words: 'matched your hidden words',
  limited_interaction: 'from a limited account',
  hidden_parent: 'reply to a hidden comment',
};

const PARENT_HIDDEN_COPY = 'Unhide the comment it replies to first.';
const UNHIDE_FAILED_COPY = 'That comment could not be unhidden. Try again.';

const statusStyle: CSSProperties = {
  padding: 20,
  textAlign: 'center',
  fontFamily: v.fontBody,
  fontSize: 13,
  color: v.ink3,
};

function HiddenCommentRow({
  comment,
  error,
  onUnhide,
  onReport,
}: {
  comment: HiddenCommentResponse;
  error: string | undefined;
  onUnhide: (comment: HiddenCommentResponse) => void;
  onReport: (comment: HiddenCommentResponse) => void;
}) {
  const timeAgo = useRelativeTime(comment.createdAt, { seedKey: comment.id });
  return (
    <div
      data-testid={`hidden-comment-${comment.id}`}
      data-hidden-comment-id={comment.id}
      style={{
        display: 'flex',
        gap: 12,
        padding: '14px 16px',
        borderBottom: `1px solid ${v.borderSubtle}`,
      }}
    >
      <LxAvatar size={30} src={comment.author.avatarUrl} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 13.5,
            lineHeight: 1.4,
            color: v.ink,
            overflowWrap: 'anywhere',
          }}
        >
          <span style={{ fontWeight: 600, marginRight: 6 }}>{comment.author.username}</span>
          {comment.content}
        </div>
        <div style={{ marginTop: 3, fontFamily: v.fontBody, fontSize: 12, color: v.ink3 }}>
          {`${timeAgo} - ${REASON_COPY[comment.hiddenReason]}`}
        </div>
        {error ? (
          <div
            role="alert"
            style={{ marginTop: 6, fontFamily: v.fontBody, fontSize: 12, color: v.error }}
          >
            {error}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
      >
        <LxBtn
          variant="ghost"
          size="sm"
          onClick={() => onUnhide(comment)}
          type="button"
          data-unhide-for={comment.id}
        >
          unhide
        </LxBtn>
        {comment.hasReported ? (
          // A report never reverses and a second one is refused, so the row states
          // what happened instead of offering an action that cannot succeed.
          <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink3 }}>reported</span>
        ) : (
          <button
            type="button"
            onClick={() => onReport(comment)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: v.fontBody,
              fontSize: 12,
              color: v.ink3,
            }}
          >
            report
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The post owner's review list of hidden comments, shown in place of the comment column.
 *
 * Only the owner can open it: the backend answers 404 to anyone else, and the post menu offers
 * the entry to the owner alone. The author of a hidden comment is never shown any of this.
 * `onBack` closes the panel; the caller decides where focus goes next.
 */
export function HiddenCommentsPanel({ postId, onBack }: { postId: string; onBack: () => void }) {
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const focusAfterRemoval = useRef<{ removedId: string; nextId: string | null } | null>(null);

  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useHiddenComments(postId);
  const unhide = useUnhideComment(postId, {
    onError: (error, commentId) => {
      // A failed unhide restores the row, so focus has nothing to move away from.
      if (focusAfterRemoval.current?.removedId === commentId) focusAfterRemoval.current = null;
      // A 404 refetches the list and the refetch decides whether the row stays, so a message
      // set here would flash on a row that is about to go.
      if (getErrorResponse(error)?.status === HTTP_STATUS.NOT_FOUND) return;
      const message = isParentStillHidden(error) ? PARENT_HIDDEN_COPY : UNHIDE_FAILED_COPY;
      setRowErrors((current) => ({ ...current, [commentId]: message }));
    },
  });

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  // Escape steps back out of the review list. The listener is on the window in the capture
  // phase so it runs ahead of the post overlay's own Escape handling, which would otherwise
  // close the whole post. While the report modal is open Escape belongs to the modal.
  useEffect(() => {
    if (reportTarget) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onBack();
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [onBack, reportTarget]);

  const comments = useMemo(
    () => (data?.pages ?? []).flatMap((entry) => extractPageContent(entry)),
    [data]
  );

  // Once the row that held focus has left the list, focus goes to a row that is still there.
  useEffect(() => {
    const pending = focusAfterRemoval.current;
    if (!pending || comments.some((comment) => comment.id === pending.removedId)) return;
    focusAfterRemoval.current = null;
    const next = pending.nextId
      ? panelRef.current?.querySelector<HTMLElement>(`[data-unhide-for="${pending.nextId}"]`)
      : null;
    (next ?? backRef.current)?.focus();
  }, [comments]);

  const handleUnhide = (comment: HiddenCommentResponse) => {
    setRowErrors(({ [comment.id]: _cleared, ...rest }) => rest);
    const focusInRow = Boolean(
      document.activeElement?.closest(`[data-hidden-comment-id="${comment.id}"]`)
    );
    if (focusInRow) {
      const index = comments.findIndex((row) => row.id === comment.id);
      const neighbour = comments[index + 1] ?? comments[index - 1];
      focusAfterRemoval.current = { removedId: comment.id, nextId: neighbour?.id ?? null };
    }
    unhide.mutate(comment.id);
  };

  const handleReport = (comment: HiddenCommentResponse) =>
    setReportTarget({
      entityType: REPORT_TYPES.COMMENT,
      entityId: comment.id,
      author: getDisplayName(comment.author),
      text: comment.content,
      avatarUrl: comment.author.avatarUrl,
    });

  return (
    <>
      <div
        ref={panelRef}
        style={{
          height: '100%',
          minWidth: 0,
          flex: 1,
          background: v.base,
          display: 'grid',
          gridTemplateRows: 'auto minmax(0, 1fr) auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderBottom: `1px solid ${v.borderSubtle}`,
          }}
        >
          <button
            ref={backRef}
            type="button"
            aria-label="back to comments"
            onClick={onBack}
            className="lx-header-icon-btn"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <LxIcon name="back" size={16} color={v.ink2} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span
              style={{ fontFamily: v.fontDisplay, fontSize: 16, fontWeight: 600, color: v.ink }}
            >
              hidden comments
            </span>
            {isLoading || isError || (comments.length === 0 && hasNextPage) ? null : (
              <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink3 }}>
                {`${comments.length}${hasNextPage ? '+' : ''} on this post, only you can see these`}
              </span>
            )}
          </div>
        </div>

        <div style={{ minHeight: 0, overflowY: 'auto' }}>
          {isLoading ? (
            <div role="status" style={statusStyle}>
              Loading hidden comments...
            </div>
          ) : isError ? (
            <div style={{ ...statusStyle, color: v.error }}>
              We couldn't load the hidden comments. Try again.
            </div>
          ) : comments.length === 0 ? (
            // While more pages exist an empty page is not the end of the list, so only
            // the load more control below is shown.
            hasNextPage ? null : (
              <div style={statusStyle}>No hidden comments on this post</div>
            )
          ) : (
            comments.map((comment) => (
              <HiddenCommentRow
                key={comment.id}
                comment={comment}
                error={rowErrors[comment.id]}
                onUnhide={handleUnhide}
                onReport={handleReport}
              />
            ))
          )}
          {hasNextPage ? (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                padding: '12px 0',
                cursor: 'pointer',
                fontFamily: v.fontMono,
                fontSize: 11,
                color: v.ink3,
              }}
            >
              {isFetchingNextPage ? 'loading more...' : 'load more'}
            </button>
          ) : null}
        </div>

        <p
          style={{
            margin: 0,
            padding: '14px 16px',
            borderTop: `1px solid ${v.borderSubtle}`,
            fontFamily: v.fontBody,
            fontSize: 12,
            lineHeight: 1.45,
            color: v.ink3,
          }}
        >
          Unhidden comments appear for everyone and count toward the post's comments.
        </p>
      </div>
      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
    </>
  );
}
