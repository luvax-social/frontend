import type { HashtagStatus } from '@/types/domain';
import type { AdminCreateHashtagRequest } from '@/types/admin';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { v } from '@/config/tokens';
import { CHAR_LIMITS } from '@/config/constants';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { LxIcon } from '@/components/ui/lx-icon';

/**
 * The hashtag creation form.
 *
 * It quotes the shared confirmation shape (500ms arming delay, portalled overlay,
 * Escape-to-close, cancel-then-confirm pair) and carries the three fields the
 * create endpoint requires: a name, an initial status, and a recorded note. The
 * response is an audit action, not the hashtag; the caller reads the new id from
 * `targetEntityId`. A duplicate name is refused with HASHTAG_ALREADY_EXISTS,
 * which the parent maps to `nameError` here so it shows against the name input
 * rather than as a generic toast.
 *
 * @param {boolean} open
 * @param {boolean} busy
 * @param {string} nameError a server or local error shown against the name field
 * @param {(payload:{name:string, status:string, note:string})=>void} onConfirm
 * @param {()=>void} onClose
 */
const ARMING_DELAY_MS = 500;
const NAME_MAX = 101;
const NOTE_MAX = CHAR_LIMITS.reportDescription;
const STATUS_OPTIONS: { value: HashtagStatus; label: string; hint: string }[] = [
  { value: 'active', label: 'active', hint: 'usable in posts and search' },
  { value: 'banned', label: 'banned', hint: 'blocked from posts on creation' },
];

export function HashtagCreateDialog({
  open,
  busy = false,
  nameError = '',
  onConfirm,
  onClose,
}: {
  open: boolean;
  busy?: boolean;
  nameError?: string;
  onConfirm: (values: AdminCreateHashtagRequest) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<HashtagStatus>('active');
  const [note, setNote] = useState('');
  const [armed, setArmed] = useState(false);
  const [localErrors, setLocalErrors] = useState<Partial<Record<string, string>>>({});
  const openCount = useRef(0);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName('');

      setStatus('active');

      setNote('');

      setArmed(false);

      setLocalErrors({});
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

  const shownNameError = localErrors.name || nameError || '';
  const noteError = localErrors.note || '';
  const overName = name.length > NAME_MAX;
  const overNote = note.length > NOTE_MAX;

  const submit = () => {
    if (!armed || busy) {
      return;
    }
    const next: Record<string, string> = {};
    if (!name.trim()) {
      next.name = 'a name is required';
    }
    if (!note.trim()) {
      next.note = 'a note is required';
    }
    if (Object.keys(next).length > 0) {
      setLocalErrors(next);
      return;
    }
    if (overName || overNote) {
      return;
    }
    onConfirm({ name: name.trim(), status, note: note.trim() });
  };

  const confirmInert = !armed || busy;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="create hashtag"
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
          width: 440,
          maxWidth: '100%',
          background: v.base,
          borderRadius: 16,
          boxShadow: `0 20px 60px ${v.shadow25}, 0 4px 16px ${v.shadow12}`,
          padding: '26px 24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: v.fontDisplay,
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: '-0.02em',
            color: v.ink,
          }}
        >
          create a hashtag
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="hashtag-name"
            style={{
              fontFamily: v.fontMono,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: v.ink2,
            }}
          >
            name
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: v.surfaceSunken,
              border: `1px solid ${shownNameError ? v.error : v.border}`,
              borderRadius: 10,
              padding: '10px 12px',
            }}
          >
            <LxIcon name="hash" size={15} color={v.ink2} />
            <input
              id="hashtag-name"
              type="text"
              value={name}
              maxLength={NAME_MAX}
              disabled={busy}
              autoFocus
              placeholder="the tag name, without the #"
              onChange={(event) => {
                setName(event.target.value);
                if (localErrors.name) {
                  setLocalErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: v.fontBody,
                fontSize: 14,
                color: v.ink,
              }}
            />
          </div>
          <span
            style={{
              fontFamily: v.fontBody,
              fontSize: 12,
              color: shownNameError ? v.errorText : 'transparent',
              minHeight: 16,
            }}
          >
            {shownNameError || '.'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontFamily: v.fontMono,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: v.ink2,
            }}
          >
            initial status
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {STATUS_OPTIONS.map((option) => {
              const selected = status === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(option.value)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    textAlign: 'left',
                    padding: '9px 12px',
                    borderRadius: 10,
                    cursor: busy ? 'default' : 'pointer',
                    background: selected ? v.accentDim : v.surfaceSunken,
                    border: `1px solid ${selected ? v.accent : v.border}`,
                  }}
                >
                  <span
                    style={{ fontFamily: v.fontBody, fontSize: 13, fontWeight: 600, color: v.ink }}
                  >
                    {option.label}
                  </span>
                  <span style={{ fontFamily: v.fontBody, fontSize: 11, color: v.ink2 }}>
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="hashtag-note"
            style={{
              fontFamily: v.fontMono,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: v.ink2,
            }}
          >
            note (recorded)
          </label>
          <textarea
            id="hashtag-note"
            value={note}
            maxLength={NOTE_MAX}
            disabled={busy}
            rows={3}
            placeholder="why this hashtag is being created"
            onChange={(event) => {
              setNote(event.target.value);
              if (localErrors.note) {
                setLocalErrors((prev) => ({ ...prev, note: undefined }));
              }
            }}
            style={{
              width: '100%',
              resize: 'vertical',
              fontFamily: v.fontBody,
              fontSize: 14,
              color: v.ink,
              background: v.surfaceSunken,
              border: `1px solid ${noteError ? v.error : v.border}`,
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
                color: noteError ? v.errorText : 'transparent',
              }}
            >
              {noteError || '.'}
            </span>
            <span
              style={{
                fontFamily: v.fontMono,
                fontSize: 11,
                color: overNote ? v.errorText : v.ink2,
              }}
            >
              {note.length}/{NOTE_MAX}
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
              background: confirmInert ? v.surfaceRaised : v.accent,
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
            {busy ? 'creating...' : 'create hashtag'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
