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
 * The row's second line: a muted "no longer available" state, or whatever preview the
 * target carries (thumbnail and/or quoted snippet). Renders nothing when the target
 * carries no preview at all, which is the common case for a follow row.
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

  if (!preview) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
      {preview.media?.thumbnailUrl ? (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            flexShrink: 0,
            background: `url(${preview.media.thumbnailUrl}) center/cover no-repeat`,
          }}
        />
      ) : null}
      {preview.parentCommentSnippet || preview.commentSnippet ? (
        <div style={{ minWidth: 0 }}>
          {preview.parentCommentSnippet ? (
            <div
              style={{
                fontFamily: v.fontBody,
                fontSize: 12,
                color: v.ink3,
                borderLeft: `2px solid ${v.borderSubtle}`,
                paddingLeft: 8,
              }}
            >
              Your comment: &ldquo;{preview.parentCommentSnippet}&rdquo;
            </div>
          ) : null}
          {preview.commentSnippet ? (
            <div style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2, marginTop: 2 }}>
              &ldquo;{preview.commentSnippet}&rdquo;
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
