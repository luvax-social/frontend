import type { KeyboardEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { LxToggle } from '@/components/ui/lx-toggle';
import { v } from '@/config/tokens';

import { useMuteState, useSetMute } from '../hooks/useMutes';
import { useMuteDialogStore, type MuteDialogTarget } from '../store/useMuteDialogStore';
import { LxAvatar, LxBtn } from './primitives';

const SAVE_FAILED = "We couldn't save that just now. Try again in a moment.";
const LOAD_FAILED = "We couldn't load this. Try again in a moment.";

function MuteRow({
  label,
  sub,
  on,
  onChange,
}: {
  label: string;
  sub: string;
  on: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 0',
        borderBottom: `1px solid ${v.borderSubtle}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: v.fontBody, fontSize: 14, fontWeight: 500, color: v.ink }}>
          {label}
        </div>
        <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2, marginTop: 2 }}>
          {sub}
        </div>
      </div>
      <LxToggle label={label} on={on} onChange={onChange} />
    </div>
  );
}

/**
 * The mute dialog for one account: two independent switches, posts and stories.
 *
 * Nothing is guessed. The dialog reads the account's profile when it opens and shows a loading
 * state until that answers, then each switch saves on change with absolute values, so a switch
 * never writes a value the person did not see. The other switch is sent as it stands in the
 * cache, which already includes a change still in flight. A refused save puts the switch back and
 * says so.
 *
 * Focus moves into the dialog when it opens, Tab and Shift+Tab stay inside it, Escape and the
 * scrim close it, and focus returns to the control that opened it, or to whatever held focus
 * before when that control has left the page.
 */
export function MuteDialog({ target, onClose }: { target: MuteDialogTarget; onClose: () => void }) {
  const { user } = target;
  const [failure, setFailure] = useState('');
  const { status, mutePosts, muteStories } = useMuteState(user.id);
  const setMute = useSetMute({ onError: () => setFailure(SAVE_FAILED) });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  // Listens in the capture phase and stops the event there. The dialog is opened from post detail,
  // whose own Escape handler would otherwise close the overlay in the same keypress, and the
  // dialog is the topmost thing, so it takes the key first.
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
      const back = target.returnFocusTo?.isConnected ? target.returnFocusTo : before;
      if (back instanceof HTMLElement) back.focus({ preventScroll: true });
    };
  }, [target.returnFocusTo]);

  const save = (next: { mutePosts: boolean; muteStories: boolean }) => {
    setFailure('');
    setMute.mutate({ userId: user.id, ...next, was: { mutePosts, muteStories } });
  };

  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const controls = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled])'));
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

  const handle = `@${user.username}`;

  return createPortal(
    <div
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
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: v.scrim }} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={keepFocusInside}
        style={{
          position: 'relative',
          width: 432,
          maxWidth: '100%',
          background: v.base,
          borderRadius: 16,
          boxShadow: `0 20px 60px ${v.shadow25}, 0 4px 16px ${v.shadow12}`,
          padding: '28px 28px 24px',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <LxAvatar size={40} src={user.avatarUrl} />
          <div style={{ minWidth: 0 }}>
            <h2
              id={titleId}
              style={{
                margin: 0,
                fontFamily: v.fontDisplay,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: v.ink,
              }}
            >
              {`mute ${handle}`}
            </h2>
            <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
              They won&apos;t know you muted them.
            </div>
          </div>
        </div>

        {status === 'loading' ? (
          <div
            style={{
              padding: '28px 0',
              textAlign: 'center',
              fontFamily: v.fontMono,
              fontSize: 12,
              color: v.ink3,
            }}
          >
            loading
          </div>
        ) : status === 'error' ? (
          <div
            style={{
              padding: '24px 0',
              textAlign: 'center',
              fontFamily: v.fontBody,
              fontSize: 13,
              color: v.errorText,
            }}
          >
            {LOAD_FAILED}
          </div>
        ) : (
          <>
            <MuteRow
              label="posts"
              sub="Hide their posts from following, for you and explore."
              on={mutePosts}
              onChange={(value) => save({ mutePosts: value, muteStories })}
            />
            <MuteRow
              label="stories"
              sub="Hide their stories from your story tray."
              on={muteStories}
              onChange={(value) => save({ mutePosts, muteStories: value })}
            />
            <p
              style={{
                margin: '14px 0 0',
                fontFamily: v.fontBody,
                fontSize: 13,
                lineHeight: 1.5,
                color: v.ink2,
              }}
            >
              You&apos;ll still see their profile, comments and messages. You can change this in
              settings, under muted accounts.
            </p>
            {failure ? (
              <div
                role="alert"
                style={{ marginTop: 8, fontFamily: v.fontBody, fontSize: 12, color: v.errorText }}
              >
                {failure}
              </div>
            ) : null}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <LxBtn variant="primary" type="button" onClick={onClose}>
            done
          </LxBtn>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Mounts the mute dialog for whichever account `useMuteDialogStore` names.
 *
 * Rendered once, beside the toast host, so a post card or a profile only calls
 * `useMuteDialogStore.getState().open(...)` and the dialog outlives the card that opened it.
 */
export function MuteDialogHost() {
  const target = useMuteDialogStore((state) => state.target);
  const close = useMuteDialogStore((state) => state.close);
  return target ? <MuteDialog key={target.user.id} target={target} onClose={close} /> : null;
}
