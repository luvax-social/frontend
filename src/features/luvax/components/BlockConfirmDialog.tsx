import { createPortal } from 'react-dom';
import { v } from '@/config/tokens';
import { LxBtn } from './primitives';

/**
 * Confirms a block before it happens, and states what blocking actually does.
 *
 * Every consequence listed here was verified against the running backend. The
 * wording is deliberately not softened, because the one consequence a viewer
 * is most likely to assume wrongly is reversibility: unblocking restores
 * access, but it does not restore the follow edges the block destroyed. Either
 * account has to follow the other again. A confirmation that implies otherwise
 * would be the one piece of this screen that lies.
 *
 * Escape-key dismissal is out of scope for this phase and is recorded in
 * docs/social-states-and-tabs/deferred-findings.md. Cancel and the scrim both
 * dismiss.
 *
 * This treatment is derived. The design export defines modal radius, scrim and
 * shadow but no confirmation dialog composition, so the layout reuses the
 * modal tokens with the danger button variant from the button table.
 */
export function BlockConfirmDialog({
  open,
  handle,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  handle: string;
  pending?: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
}) {
  if (!open) return null;

  if (typeof document === 'undefined') return null;

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`block @${handle}`}
      onClick={(event) => {
        event.stopPropagation();
        onCancel?.();
      }}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        background: v.scrim,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 1400,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          background: v.base,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(26,24,22,0.25), 0 4px 16px rgba(26,24,22,0.12)',
          maxWidth: 380,
          width: '100%',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: v.fontDisplay,
            fontSize: 20,
            fontWeight: 700,
            color: v.ink,
            letterSpacing: '-0.02em',
          }}
        >
          block @{handle}?
        </div>

        <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2, lineHeight: 1.6 }}>
          blocking takes effect straight away:
        </div>

        <ul
          style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          {[
            'you both stop following each other',
            'their posts leave your feed',
            'neither of you finds the other in search',
            'you can no longer open their profile',
          ].map((line) => (
            <li
              key={line}
              style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2, lineHeight: 1.5 }}
            >
              {line}
            </li>
          ))}
        </ul>

        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 12,
            color: v.errorText,
            background: v.errorDim,
            borderRadius: 8,
            padding: '10px 12px',
            lineHeight: 1.5,
          }}
        >
          unblocking later restores access but does not restore the follows. if you want to follow
          each other again, you will both have to do it again.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <LxBtn variant="secondary" size="sm" onClick={onCancel} disabled={pending}>
            cancel
          </LxBtn>
          <LxBtn
            variant="primary"
            size="sm"
            onClick={onConfirm}
            disabled={pending}
            style={{ background: v.error, color: v.inkInverse }}
          >
            {pending ? 'blocking...' : 'block'}
          </LxBtn>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
