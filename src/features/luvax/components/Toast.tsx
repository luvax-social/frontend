import { useEffect, useState } from 'react';
import { v } from '@/config/tokens';

// A small acknowledgement for an action whose result is not already on screen.
// The design ships an imperative toast (chunk 9bffeb59, lines 13-24); this is the
// same host and the same visual values, held in React so it lives inside the app
// tree and honours the motion vocabulary. A toast that restates what the user can
// already see is noise, so callers only reach for this when nothing visible
// changed. See docs/layout-overhaul/changes-applied.md.

interface ToastItem {
  id: number;
  message: string;
  leaving?: boolean;
}
const listeners = new Set<(item: ToastItem) => void>();
let nextId = 0;
let lastToast = { message: '', at: 0 };

// Visible dwell before the toast leaves, from the design's 1700ms.
const DWELL_MS = 1700;
// Exit animation length, kept in step with the motion vocabulary.
const EXIT_MS = 200;

export function toast(message: string) {
  if (!message) return;
  const now = Date.now();
  if (lastToast.message === message && now - lastToast.at < DWELL_MS) return;
  lastToast = { message, at: now };
  const id = ++nextId;
  listeners.forEach((listener) => listener({ id, message }));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const add = ({ id, message }: ToastItem) => {
      setItems((current) => [...current, { id, message, leaving: false }]);
      window.setTimeout(() => {
        setItems((current) =>
          current.map((item) => (item.id === id ? { ...item, leaving: true } : item))
        );
        window.setTimeout(() => {
          setItems((current) => current.filter((item) => item.id !== id));
        }, EXIT_MS);
      }, DWELL_MS);
    };
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
          }}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
