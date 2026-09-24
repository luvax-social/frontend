import { v } from '@/config/tokens';

const KIND_LABEL = {
  post: 'post',
  comment: 'comment',
  story: 'story',
  user: 'account',
  support_ticket: 'ticket',
  moderation: 'item',
  none: 'item',
};

/**
 * The row's second line: a muted "no longer available" state, or the quoted snippet a
 * comment/reply preview carries, each truncated to one line so a long reply does not push
 * the rest of the list down. Renders nothing when the target carries no preview text at
 * all, which is the common case for a follow or a like row. The preview's own thumbnail, if
 * any, is rendered separately in the row's trailing slot (NotificationRow), not here.
 * @param {{target: object, preview: ?object}} props
 */
export function NotificationPreview({ target, preview }) {
  if (target && target.available === false) {
    return (
      <div style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink3, marginTop: 4 }}>
        This {KIND_LABEL[target.kind] ?? 'item'} is no longer available.
      </div>
    );
  }

  if (!preview || (!preview.parentCommentSnippet && !preview.commentSnippet)) return null;

  return (
    <div style={{ marginTop: 6, minWidth: 0 }}>
      {preview.parentCommentSnippet ? (
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 12,
            color: v.ink3,
            borderLeft: `2px solid ${v.borderSubtle}`,
            paddingLeft: 8,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Your comment: &ldquo;{preview.parentCommentSnippet}&rdquo;
        </div>
      ) : null}
      {preview.commentSnippet ? (
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 12,
            color: v.ink2,
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          &ldquo;{preview.commentSnippet}&rdquo;
        </div>
      ) : null}
    </div>
  );
}
