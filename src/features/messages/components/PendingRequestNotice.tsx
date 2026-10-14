import { v } from '@/config/tokens';

/**
 * Tells the sender of an unanswered request why the composer is locked.
 *
 * The wording is the same whether the request is waiting or the recipient deleted it, because the
 * server shows the sender no difference. Nothing here, or in the callers, may infer or name a
 * declined state.
 */
export function PendingRequestNotice({ name }: { name: string }) {
  return (
    <div
      style={{
        alignSelf: 'center',
        background: v.surface,
        color: v.ink2,
        fontFamily: v.fontBody,
        fontSize: 12.5,
        lineHeight: 1.4,
        padding: '9px 14px',
        borderRadius: 8,
        textAlign: 'center',
      }}
    >
      Request sent. You can send more messages after {name} accepts.
    </div>
  );
}
