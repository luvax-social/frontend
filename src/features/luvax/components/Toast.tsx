import { useEffect, useRef, useState } from 'react';
import { v } from '@/config/tokens';
import { useAuthStore } from '@/store/useAuthStore';

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

interface Dwell {
  timer: number | undefined;
  remaining: number;
  startedAt: number;
  hovered: boolean;
  focused: boolean;
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dwells = useRef(new Map<number, Dwell>());
  const leaveRef = useRef<(id: number) => void>(() => undefined);
  const holdRef = useRef<(id: number, hold: Partial<Pick<Dwell, 'hovered' | 'focused'>>) => void>(
    () => undefined
  );
  const exitTimers = useRef(new Set<number>());

  useEffect(() => {
    const track = dwells.current;
    const exits = exitTimers.current;
    const leave = (id: number) => {
      const dwell = track.get(id);
      if (dwell) window.clearTimeout(dwell.timer);
      track.delete(id);
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, leaving: true } : item))
      );
      const exit = window.setTimeout(() => {
        exits.delete(exit);
        setItems((current) => current.filter((item) => item.id !== id));
      }, EXIT_MS);
      exits.add(exit);
    };
    const arm = (id: number, dwell: Dwell, wait: number) => {
      dwell.remaining = wait;
      dwell.startedAt = Date.now();
      dwell.timer = window.setTimeout(() => leave(id), wait);
    };
    // The wait pauses while the pointer is over the toast or focus is inside it, and resumes with
    // what was left, so a viewer reading it or reaching its button is not raced by the timer.
    const hold = (id: number, change: Partial<Pick<Dwell, 'hovered' | 'focused'>>) => {
      const dwell = track.get(id);
      if (!dwell) return;
      const wasHeld = dwell.hovered || dwell.focused;
      Object.assign(dwell, change);
      const isHeld = dwell.hovered || dwell.focused;
      if (isHeld && !wasHeld) {
        window.clearTimeout(dwell.timer);
        dwell.remaining = Math.max(dwell.remaining - (Date.now() - dwell.startedAt), 0);
      } else if (!isHeld && wasHeld) {
        arm(id, dwell, dwell.remaining);
      }
    };
    const add = ({ id, message, action }: ToastItem) => {
      setItems((current) => [...current, { id, message, action, leaving: false }]);
      const dwell: Dwell = {
        timer: undefined,
        remaining: 0,
        startedAt: 0,
        hovered: false,
        focused: false,
      };
      track.set(id, dwell);
      arm(id, dwell, action ? ACTION_DWELL_MS : DWELL_MS);
    };
    // A toast action belongs to the account that made the change. After another account signs
    // in, pressing it would send the previous account's undo, so those toasts go with the account.
    const stopWatchingAccount = useAuthStore.subscribe((state, previous) => {
      if (state.user?.id === previous.user?.id) return;
      setItems((current) => {
        current.forEach((item) => {
          if (!item.action) return;
          window.clearTimeout(track.get(item.id)?.timer);
          track.delete(item.id);
        });
        return current.filter((item) => !item.action);
      });
    });
    leaveRef.current = leave;
    holdRef.current = hold;
    listeners.add(add);
    return () => {
      listeners.delete(add);
      stopWatchingAccount();
      track.forEach((dwell) => window.clearTimeout(dwell.timer));
      track.clear();
      exits.forEach((exit) => window.clearTimeout(exit));
      exits.clear();
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
          onMouseEnter={() => holdRef.current(item.id, { hovered: true })}
          onMouseLeave={() => holdRef.current(item.id, { hovered: false })}
          onFocus={() => holdRef.current(item.id, { focused: true })}
          onBlur={() => holdRef.current(item.id, { focused: false })}
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
              disabled={item.leaving}
              onClick={() => {
                if (item.leaving) return;
                item.action?.onClick();
                leaveRef.current(item.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: item.leaving ? 'default' : 'pointer',
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
