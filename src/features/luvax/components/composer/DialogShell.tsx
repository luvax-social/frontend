import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';

/**
 * The frame the composer's dialogs share: a centred panel over a scrim, a title and a close
 * control.
 *
 * Focus moves into the panel when it opens, Tab and Shift+Tab stay inside it, Escape and the
 * scrim close it, and focus returns to whatever held it before. Escape is handled in the capture
 * phase and stopped there, because a dialog opened over another overlay is the topmost thing and
 * must take the key first.
 */
export function DialogShell({
  title,
  onClose,
  width = 480,
  children,
  aside,
  testId,
}: {
  title: string;
  onClose: () => void;
  width?: number;
  children: ReactNode;
  /** Extra content beside the title, such as a position counter. */
  aside?: ReactNode;
  testId?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [onClose]);

  useEffect(() => {
    const before = document.activeElement;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (before instanceof HTMLElement && before.isConnected)
        before.focus({ preventScroll: true });
    };
  }, []);

  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const controls = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
      )
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: v.scrim }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
        tabIndex={-1}
        onKeyDown={keepFocusInside}
        style={{
          position: 'relative',
          width,
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          background: v.base,
          borderRadius: 16,
          boxShadow: `0 20px 60px ${v.shadow25}, 0 4px 16px ${v.shadow12}`,
          padding: '22px 24px 20px',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <h2
            id={titleId}
            style={{
              flex: 1,
              margin: 0,
              fontFamily: v.fontDisplay,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: v.ink,
            }}
          >
            {title}
          </h2>
          {aside}
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            style={{
              appearance: 'none',
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <LxIcon name="close" size={20} color={v.ink2} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
