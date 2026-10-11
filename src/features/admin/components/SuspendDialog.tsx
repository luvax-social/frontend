import type { AdminSuspendUserRequest } from '@/types/admin';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { v } from '@/config/tokens';
import { CHAR_LIMITS } from '@/config/constants';
import { useEscapeKey } from '@/hooks/useEscapeKey';

import { LocalTime } from './LocalTime';

/**
 * The suspension form.
 *
 * It quotes the shared reason-confirm dialogue's shape — the 500ms arming delay,
 * portalled overlay, Escape-to-close, and cancel-then-confirm pair — but carries
 * the fields the suspend endpoint accepts: a required reason and an optional
 * duration in days.
 *
 * **A suspension with no end date is a supported choice, not an incomplete
 * form.** Omitting `durationDays` suspends indefinitely: the account's end time
 * is null, the sweep that lifts lapsed suspensions never matches it, and it
 * stays suspended until an administrator lifts it by hand. The panel used to
 * treat the duration as required because the endpoint's optionality had been
 * read as an oversight. Both are offered here, and the consequence of each is
 * stated before it is confirmed.
 *
 * When a duration is given the server takes `durationDays` (1..3650), not an end
 * time; the resulting end is `now + durationDays`, shown in the reviewer's local
 * timezone so a duration is never confirmed blind. The bounds are enforced
 * before submission, matching the server's 400 on an out-of-range value.
 *
 * @param {boolean} open
 * @param {boolean} busy
 * @param {string} serverError a non-field server message to show inline
 * @param {(payload:{reason:string, durationDays:number|undefined})=>void} onConfirm
 * @param {()=>void} onClose
 */
const ARMING_DELAY_MS = 500;
const REASON_MAX = CHAR_LIMITS.reportDescription;
const MIN_DAYS = 1;
const MAX_DAYS = 3650;

export function SuspendDialog({
  open,
  busy = false,
  serverError = null,
  onConfirm,
  onClose,
}: {
  open: boolean;
  busy?: boolean;
  serverError?: string | null;
  onConfirm: (values: AdminSuspendUserRequest) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  // 'dated' | 'indefinite'. Dated is the default because it is the ordinary
  // case; indefinite is a deliberate escalation and is chosen, never defaulted
  // into by leaving a field blank.
  const [mode, setMode] = useState('dated');
  const [days, setDays] = useState('7');
  const [armed, setArmed] = useState(false);
  const [localErrors, setLocalErrors] = useState<Partial<Record<string, string>>>({});
  const [nowMs] = useState(() => Date.now());
  const openCount = useRef(0);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReason('');

      setDays('7');

      setMode('dated');

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

  const isIndefinite = mode === 'indefinite';
  const daysNum = Number.parseInt(days, 10);
  const daysValid = Number.isFinite(daysNum) && daysNum >= MIN_DAYS && daysNum <= MAX_DAYS;
  const endDate =
    !isIndefinite && daysValid
      ? new Date(nowMs + daysNum * 24 * 60 * 60 * 1000).toISOString()
      : null;
  const reasonError = localErrors.reason || serverError || '';
  const daysError = localErrors.days || '';
  const overLimit = reason.length > REASON_MAX;

  const submit = () => {
    if (!armed || busy) {
      return;
    }
    const next: Record<string, string> = {};
    if (!reason.trim()) {
      next.reason = 'a reason is required';
    }
    if (!isIndefinite && !daysValid) {
      next.days = `enter a whole number of days between ${MIN_DAYS} and ${MAX_DAYS}`;
    }
    if (Object.keys(next).length > 0) {
      setLocalErrors(next);
      return;
    }
    if (overLimit) {
      return;
    }
    // Omitted entirely for an indefinite suspension. `buildBody` drops an
    // undefined field, so the request carries no `durationDays` key at all
    // rather than a null the endpoint does not declare.
    onConfirm({
      reason: reason.trim(),
      durationDays: isIndefinite ? undefined : daysNum,
    });
  };

  const confirmInert = !armed || busy;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="suspend account"
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
            suspend this account
          </div>
          <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink2, lineHeight: 1.55 }}>
            {isIndefinite
              ? 'the account cannot sign in. an indefinite suspension has no end date and never lifts on its own — it lasts until an administrator unsuspends it.'
              : 'the account cannot sign in until the suspension ends. it lifts automatically at the time below, or an administrator can unsuspend it sooner.'}
          </div>
        </div>

        <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', gap: 16 }}>
          <legend
            style={{
              fontFamily: v.fontMono,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: v.ink2,
              padding: 0,
              marginBottom: 6,
            }}
          >
            how long
          </legend>
          {[
            { key: 'dated', label: 'for a set number of days' },
            { key: 'indefinite', label: 'indefinitely' },
          ].map((option) => (
            <label
              key={option.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: v.fontBody,
                fontSize: 13,
                color: v.ink2,
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              <input
                type="radio"
                name="suspend-mode"
                value={option.key}
                checked={mode === option.key}
                disabled={busy}
                onChange={() => {
                  setMode(option.key);
                  setLocalErrors((prev) => ({ ...prev, days: undefined }));
                }}
                style={{ accentColor: v.accentText }}
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        <div
          style={{
            display: isIndefinite ? 'none' : 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <label
            htmlFor="suspend-days"
            style={{
              fontFamily: v.fontMono,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: v.ink2,
            }}
          >
            duration (days)
          </label>
          <input
            id="suspend-days"
            type="number"
            inputMode="numeric"
            min={MIN_DAYS}
            max={MAX_DAYS}
            step={1}
            value={days}
            disabled={busy}
            onChange={(event) => {
              setDays(event.target.value);
              if (localErrors.days) {
                setLocalErrors((prev) => ({ ...prev, days: undefined }));
              }
            }}
            style={{
              width: 140,
              fontFamily: v.fontBody,
              fontSize: 14,
              color: v.ink,
              background: v.surfaceSunken,
              border: `1px solid ${daysError ? v.error : v.border}`,
              borderRadius: 10,
              padding: '10px 12px',
              outline: 'none',
            }}
          />
          <div
            style={{
              minHeight: 20,
              fontFamily: v.fontBody,
              fontSize: 13,
              color: daysError ? v.errorText : v.ink2,
            }}
          >
            {daysError ? (
              daysError
            ) : endDate ? (
              <span>
                ends <LocalTime value={endDate} />
              </span>
            ) : (
              <span>enter a duration to see when it ends</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="suspend-reason"
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
            id="suspend-reason"
            value={reason}
            maxLength={REASON_MAX}
            disabled={busy}
            rows={3}
            placeholder="why this account is being suspended"
            onChange={(event) => {
              setReason(event.target.value);
              if (localErrors.reason) {
                setLocalErrors((prev) => ({ ...prev, reason: undefined }));
              }
            }}
            style={{
              width: '100%',
              resize: 'vertical',
              fontFamily: v.fontBody,
              fontSize: 14,
              color: v.ink,
              background: v.surfaceSunken,
              border: `1px solid ${reasonError ? v.error : v.border}`,
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
                color: reasonError ? v.errorText : 'transparent',
              }}
            >
              {reasonError || '.'}
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
              background: confirmInert ? v.surfaceRaised : v.warning,
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
            {busy ? 'suspending...' : isIndefinite ? 'suspend indefinitely' : 'suspend account'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
