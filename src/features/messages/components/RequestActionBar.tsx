import type { CSSProperties } from 'react';

import { v } from '@/config/tokens';

interface Props {
  /** The requester's display name. */
  name: string;
  /** True while a decision is in flight, so a second tap cannot send a second one. */
  busy?: boolean;
  onAccept: () => void;
  onDelete: () => void;
  onBlock: () => void;
}

const buttonBase: CSSProperties = {
  height: 36,
  padding: '0 18px',
  borderRadius: 999,
  fontFamily: v.fontBody,
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
};

/**
 * The recipient's decision bar for a pending message request, shown in place of the composer.
 *
 * Accept moves the conversation to the primary folder. Delete and block both remove it, and the
 * wording promises nothing about what the sender sees, because the sender's view never changes.
 */
export function RequestActionBar({ name, busy = false, onAccept, onDelete, onBlock }: Props) {
  return (
    <div
      style={{
        borderTop: `1px solid ${v.border}`,
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ fontFamily: v.fontBody, fontSize: 12.5, color: v.ink2, textAlign: 'center' }}>
        Accept to reply to {name}. They won&apos;t know you&apos;ve seen this until you do.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={onBlock}
          disabled={busy}
          style={{
            ...buttonBase,
            border: 'none',
            background: v.error,
            color: v.white,
            opacity: busy ? 0.4 : 1,
          }}
        >
          block
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          style={{
            ...buttonBase,
            border: `1px solid ${v.border}`,
            background: 'transparent',
            color: v.ink,
            opacity: busy ? 0.4 : 1,
          }}
        >
          delete
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={busy}
          style={{
            ...buttonBase,
            border: 'none',
            background: v.accent,
            color: v.black,
            opacity: busy ? 0.4 : 1,
          }}
        >
          accept
        </button>
      </div>
    </div>
  );
}
