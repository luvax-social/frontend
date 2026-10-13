import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { v } from '@/config/tokens';
import { CHAR_LIMITS } from '@/config/constants';
import { useEscapeKey } from '@/hooks/useEscapeKey';

/**
 * Derived pattern: a confirmation dialogue carrying a mandatory reason.
 *
 * The panel builds this as a dedicated component rather than extending the
 * shared `ConfirmModal`, and deliberately mirrors that modal's vocabulary so
 * the product keeps one confirmation language: the same 500ms arming delay, the
 * same cancel-then-confirm button pair, and the destructive `v.error` confirm.
 * `ConfirmModal` has no reason concept and no way to hand a payload back to its
 * caller, so threading a required textarea and the submitted value through its
 * `message` node would fork its behaviour anyway; a dedicated component that
 * quotes its arming delay and button shape keeps the single vocabulary while
 * adding the reason affordance cleanly. The reasoning is recorded in
 * design-decisions.md.
 *
 * The dialogue is portalled to the document body so it is never clipped by a
 * scrolling ancestor. It closes on Escape. The confirm is inert during the
 * arming delay and while a mutation is in flight; it is not disabled on an empty
 * reason, so an empty submit produces a field-level message rather than a
 * generic toast.
 */
const ARMING_DELAY_MS = 500;
const REASON_MAX = CHAR_LIMITS.reportDescription;

export function ReasonConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'confirm',
  tone = 'danger',
  busy = false,
  serverError = null,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: string;
  busy?: boolean;
  serverError?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [armed, setArmed] = useState(false);
  const [localError, setLocalError] = useState('');
  const openCount = useRef(0);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReason('');

      setArmed(false);

      setLocalError('');
      return undefined;
    }
    openCount.current += 1;
    const myCount = openCount.current;

    setArmed(false);
    const timer = setTimeout(() => {
      if (openCount.current === myCount) {
        setArmed(true);
      }
    }, ARMING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEscapeKey(open && !busy, onClose);

  if (!open) {
    return null;
  }

  const fieldError = localError || serverError || '';
  const overLimit = reason.length > REASON_MAX;

  const submit = () => {
    if (!armed || busy) {
      return;
    }
    if (!reason.trim()) {
      setLocalError('a reason is required');
      return;
    }
    if (overLimit) {
      return;
    }
    onConfirm(reason.trim());
  };

  const confirmBg = tone === 'danger' ? v.error : v.accent;
  const confirmInert = !armed || busy;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : 'confirm'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={busy ? undefined : onClose}
        style={{ position: 'absolute', inset: 0, background: v.scrim }}
      />
      <div
        style={{
          position: 'relative',
          width: 420,
          maxWidth: '100%',
          background: v.base,
          borderRadius: 16,
          boxShadow: `0 20px 60px ${v.shadow25}, 0 4px 16px ${v.shadow12}`,
          padding: '26px 24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: v.fontDisplay,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: '-0.02em',
              color: v.ink,
              marginBottom: 8,
            }}
          >
            {title}
          </div>
          {description ? (
            <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink2, lineHeight: 1.55 }}>
              {description}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="reason-confirm-input"
            style={{
              fontFamily: v.fontMono,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: v.ink2,
            }}
          >
            reason (recorded)
          </label>
          <textarea
            id="reason-confirm-input"
            value={reason}
            maxLength={REASON_MAX}
            disabled={busy}
            autoFocus
            onChange={(event) => {
              setReason(event.target.value);
              if (localError) {
                setLocalError('');
              }
            }}
            rows={4}
            placeholder="why this action is being taken"
            style={{
              width: '100%',
              resize: 'vertical',
              fontFamily: v.fontBody,
              fontSize: 14,
              color: v.ink,
              background: v.surfaceSunken,
              border: `1px solid ${fieldError ? v.error : v.border}`,
              borderRadius: 10,
              padding: '10px 12px',
              outline: 'none',
              lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontFamily: v.fontBody,
                fontSize: 12,
                color: fieldError ? v.errorText : 'transparent',
              }}
            >
              {fieldError || '.'}
            </span>
            <span
              style={{
                fontFamily: v.fontMono,
                fontSize: 11,
                color: overLimit ? v.errorText : v.ink2,
              }}
            >
              {reason.length}/{REASON_MAX}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={busy ? undefined : onClose}
            disabled={busy}
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: 999,
              background: v.surface,
              border: 'none',
              cursor: busy ? 'default' : 'pointer',
              fontFamily: v.fontBody,
              fontSize: 14,
              fontWeight: 500,
              color: v.ink2,
              opacity: busy ? 0.6 : 1,
            }}
          >
            cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={confirmInert}
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: 999,
              background: confirmInert ? v.surfaceRaised : confirmBg,
              border: 'none',
              cursor: confirmInert ? 'default' : 'pointer',
              fontFamily: v.fontBody,
              fontSize: 14,
              fontWeight: 600,
              color: confirmInert ? v.ink2 : v.white,
              opacity: !armed ? 0.5 : 1,
              transition: 'opacity 0.25s, background 0.25s, color 0.25s',
            }}
          >
            {busy ? 'working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
