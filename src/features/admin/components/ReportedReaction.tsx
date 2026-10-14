import { v } from '@/config/tokens';
import type { AdminReportTargetResponse } from '@/types/admin';

import { detailLabel, NoteBlock } from './DetailPrimitives';
import { LocalTime } from './LocalTime';
import { StatusBadge } from './StatusBadge';

const EMOJI_FONT = '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", sans-serif';

/**
 * The reported content of a message reaction report: the emoji, who reacted and when, and the
 * message it sits on.
 *
 * The server sends the reactor as the owner, the reaction time as the creation time and a snippet
 * of the message as the text. It sends no sender for that message, so none is shown, and a message
 * with no text left to quote is said to be no longer shown rather than shown blank.
 */
export function ReportedReaction({ target }: { target: AdminReportTargetResponse }) {
  const hasText = typeof target.text === 'string' && target.text.length > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={detailLabel}>reported reaction</span>
        {target.removed ? <StatusBadge status="removed" size="sm" /> : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontFamily: EMOJI_FONT, fontSize: 38, lineHeight: 1 }}>{target.emoji}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink, fontWeight: 600 }}>
            {target.ownerUsername ? (
              `@${target.ownerUsername}`
            ) : (
              <span style={{ fontFamily: v.fontMono }} title={target.ownerId ?? ''}>
                {target.ownerId ? target.ownerId.slice(0, 8) : 'unknown'}
              </span>
            )}
          </span>
          <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
            reacted <LocalTime value={target.createdAt} />
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={detailLabel}>on this message</span>
        {hasText ? (
          <NoteBlock label={null}>{target.text}</NoteBlock>
        ) : (
          <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
            The message is no longer shown.
          </span>
        )}
      </div>
    </div>
  );
}
