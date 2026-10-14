import { useEffect, useRef, useState } from 'react';
import { v } from '@/config/tokens';

// A small acknowledgement for an action whose result is not already on screen.
// The design ships an imperative toast (chunk 9bffeb59, lines 13-24); this is the
// same host and the same visual values, held in React so it lives inside the app
// tree and honours the motion vocabulary. A toast that restates what the user can
// already see is noise, so callers only reach for this when nothing visible
// changed. See docs/layout-overhaul/changes-applied.md.

/** A button on the toast, for a change the viewer may want to take back. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
  leaving?: boolean;
}
const listeners = new Set<(item: ToastItem) => void>();
let nextId = 0;
let lastToast = { message: '', at: 0 };

// Visible dwell before the toast leaves, from the design's 1700ms.
const DWELL_MS = 1700;
// A toast carrying an action stays long enough to be reached and read before it goes.
const ACTION_DWELL_MS = 6000;
// Exit animation length, kept in step with the motion vocabulary.
const EXIT_MS = 200;

/**
 * Shows a short message. With `options.action` the toast carries one button, which runs its
 * handler and closes the toast; it stays longer than a plain message so there is time to use it.
 */
export function toast(message: string, options: { action?: ToastAction } = {}) {
  if (!message) return;
  const now = Date.now();
  // A toast with an action is never a repeat: its button undoes one specific change.
  if (!options.action && lastToast.message === message && now - lastToast.at < DWELL_MS) return;
  lastToast = { message, at: now };
  const id = ++nextId;
  listeners.forEach((listener) => listener({ id, message, action: options.action }));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const leaveRef = useRef<(id: number) => void>(() => undefined);

  useEffect(() => {
    const add = ({ id, message, action }: ToastItem) => {
      setItems((current) => [...current, { id, message, action, leaving: false }]);
      window.setTimeout(() => leave(id), action ? ACTION_DWELL_MS : DWELL_MS);
    };
    const leave = (id: number) => {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, leaving: true } : item))
      );
      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
      }, EXIT_MS);
    };
    leaveRef.current = leave;
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 24,
        zIndex: 2147483000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          style={{
            background: v.ink,
            color: v.inkInverse,
            fontFamily: v.fontBody,
            fontSize: 13,
            fontWeight: 500,
            padding: '10px 18px',
            borderRadius: 999,
            boxShadow: '0 6px 24px rgba(0,0,0,.22)',
            animation: `${item.leaving ? 'lx-toast-out' : 'lx-toast-in'} var(--duration-normal) var(--ease-out) forwards`,
            // The host ignores the pointer so a toast never blocks the page under it; one with a
            // button has to take it.
            pointerEvents: item.action ? 'auto' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          {item.message}
          {item.action ? (
            <button
              type="button"
              onClick={() => {
                item.action?.onClick();
                leaveRef.current(item.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontFamily: v.fontBody,
                fontSize: 13,
                fontWeight: 600,
                color: v.accent,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              {item.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
