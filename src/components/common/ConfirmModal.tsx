import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { v } from '@/config/tokens';
import { useEscapeKey } from '@/hooks/useEscapeKey';

/**
 * The design's destructive-confirmation dialogue.
 *
 * Every value here is read from the design export's `ConfirmModal`. The one
 * behaviour worth naming is the arming delay: the confirm button is inert for
 * half a second after the dialogue appears, so a second click aimed at the
 * control that opened it cannot land on the destructive action underneath.
 *
 * `message` accepts a node rather than only a string, because the confirmations
 * being migrated onto this carry emphasis and an inline failure notice that
 * would otherwise have to be dropped.
 */

const ARMING_DELAY_MS = 500;

export interface ConfirmConfig {
  title?: ReactNode;
  message?: ReactNode;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmLabel?: ReactNode;
}

export function ConfirmModal({
  config,
  onClose,
}: {
  config?: ConfirmConfig | null;
  onClose: () => void;
}) {
  const [delayed, setDelayed] = useState(true);
  const openCount = useRef(0);

  const title = config?.title;
  const message = config?.message;

  useEffect(() => {
    if (!config) {
      // Arms and disarms a timer; the delayed flag tracks elapsed time, not derived data.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDelayed(true);
      return undefined;
    }
    // Counted so a dialogue reopened before the previous timer fires cannot be
    // armed early by the earlier timeout.
    openCount.current += 1;
    const myCount = openCount.current;
    setDelayed(true);
    const timer = setTimeout(() => {
      if (openCount.current === myCount) setDelayed(false);
    }, ARMING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [config, title, message]);

  useEscapeKey(Boolean(config), onClose);

  if (!config) return null;
  if (typeof document === 'undefined') return null;

  const confirm = () => {
    if (delayed) return;
    if (config.onConfirm) config.onConfirm();
    onClose();
  };

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : 'confirm'}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
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
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        style={{ position: 'absolute', inset: 0, background: v.scrim }}
      />
      <div
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        style={{
          position: 'relative',
          width: 340,
          maxWidth: '100%',
          background: v.base,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(26,24,22,0.26)',
          padding: '28px 24px 22px',
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
          <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink3, lineHeight: 1.55 }}>
            {message}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: 999,
              background: v.surface,
              border: 'none',
              cursor: 'pointer',
              fontFamily: v.fontBody,
              fontSize: 14,
              fontWeight: 500,
              color: v.ink2,
            }}
          >
            cancel
          </button>
          <button
            type="button"
            disabled={delayed || config.confirmDisabled}
            onClick={(event) => {
              event.stopPropagation();
              confirm();
            }}
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: 999,
              background: delayed ? v.surfaceRaised : v.error,
              border: 'none',
              cursor: delayed ? 'default' : 'pointer',
              fontFamily: v.fontBody,
              fontSize: 14,
              fontWeight: 600,
              color: delayed ? v.ink3 : v.white,
              opacity: delayed ? 0.5 : 1,
              transition: 'opacity 0.25s, background 0.25s, color 0.25s',
            }}
          >
            {config.confirmLabel || 'confirm'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
