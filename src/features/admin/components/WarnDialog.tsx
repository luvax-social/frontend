import type { ReportReasonVocabularyResponse } from '@/types/domain';
import type { AdminWarnUserRequest } from '@/types/admin';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { v } from '@/config/tokens';
import { CHAR_LIMITS } from '@/config/constants';
import { useEscapeKey } from '@/hooks/useEscapeKey';

import { ReasonSelect } from './ReasonSelect';

/**
 * The warning issuance form.
 *
 * It quotes the shared reason-confirm dialogue's shape — the same 500ms arming
 * delay, portalled overlay, Escape-to-close, and cancel-then-confirm button pair
 * — so the panel keeps one confirmation vocabulary, but it carries the two
 * fields the warn endpoint requires rather than a single free-text reason: a
 * vocabulary-driven reason key and a required note bounded to 2000 characters
 * with the count visible before the limit is hit.
 *
 * Both fields are required. An empty submit produces a message against the
 * specific field rather than a generic toast. The parent maps a server
 * VALIDATION_ERROR onto the same per-field slots; a key matching no field is
 * ignored. The confirm is inert during the arming delay and while the request
 * is in flight.
 *
 * **What this warning will do is stated before it is issued.** The account
 * detail carries `activeWarningCount`, so an administrator is told how many
 * warnings already count and, when this one is the third, what the strike it
 * triggers does to the account. The panel used to state the three-warning rule
 * as a bare constant because the count could not be read; that statement is
 * gone wherever the number itself is available.
 *
 * A moderator cannot read the account detail at all — it answers 403 — so the
 * count is genuinely unavailable there. That case says so rather than showing a
 * number it cannot have, and states the rule, which remains the only true thing
 * that can be said without the count.
 *
 * @param {boolean} open
 * @param {Object[]} reasons the report-reason vocabulary, pre-sorted
 * @param {number|null} activeWarningCount warnings already counting toward the
 *   next strike, or null when the caller cannot read it
 * @param {boolean} busy whether the warn request is in flight
 * @param {{reasonKey?: string, note?: string}} serverFieldErrors mapped from VALIDATION_ERROR
 * @param {(payload:{reasonKey:string, note:string})=>void} onConfirm
 * @param {()=>void} onClose
 */
const ARMING_DELAY_MS = 500;
const NOTE_MAX = CHAR_LIMITS.warningNote;

export function WarnDialog({
  open,
  reasons = [],
  activeWarningCount = null,
  busy = false,
  serverFieldErrors = null,
  onConfirm,
  onClose,
}: {
  open: boolean;
  reasons?: ReportReasonVocabularyResponse[];
  activeWarningCount?: number | null;
  busy?: boolean;
  serverFieldErrors?: Partial<Record<string, string>> | null;
  onConfirm: (values: AdminWarnUserRequest) => void;
  onClose: () => void;
}) {
  const [reasonKey, setReasonKey] = useState('');
  const [note, setNote] = useState('');
  const [armed, setArmed] = useState(false);
  const [localErrors, setLocalErrors] = useState<Partial<Record<string, string>>>({});
  const openCount = useRef(0);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReasonKey('');

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

  const reasonError = localErrors.reasonKey || serverFieldErrors?.reasonKey || '';
  const noteError = localErrors.note || serverFieldErrors?.note || '';
  const overLimit = note.length > NOTE_MAX;

  const submit = () => {
    if (!armed || busy) {
      return;
    }
    const next: Record<string, string> = {};
    if (!reasonKey) {
      next.reasonKey = 'select a reason';
    }
    if (!note.trim()) {
      next.note = 'a note is required';
    }
    if (Object.keys(next).length > 0) {
      setLocalErrors(next);
      return;
    }
    if (overLimit) {
      return;
    }
    onConfirm({ reasonKey, note: note.trim() });
  };

  const confirmInert = !armed || busy;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="warn account"
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
            warn this account
          </div>
          <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink2, lineHeight: 1.55 }}>
            a formal warning is recorded against this account.
          </div>
          <WarningConsequence activeWarningCount={activeWarningCount} />
        </div>

        <ReasonSelect
          id="warn-reason"
          reasons={reasons}
          value={reasonKey}
          disabled={busy}
          error={reasonError}
          onChange={(key) => {
            setReasonKey(key);
            if (localErrors.reasonKey) {
              setLocalErrors((prev) => ({ ...prev, reasonKey: undefined }));
            }
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="warn-note"
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
            id="warn-note"
            value={note}
            maxLength={NOTE_MAX}
            disabled={busy}
            rows={4}
            placeholder="what this warning is for"
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
                color: overLimit ? v.errorText : v.ink2,
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
            {busy ? 'warning...' : 'issue warning'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * What issuing this warning will do, said before it is issued.
 *
 * Three cases, and the difference between them is what the caller can actually
 * know:
 *
 * - The count is readable and this warning is not the third: the number is
 *   stated, and what it will become.
 * - The count is readable and this warning is the third: the strike is named
 *   along with what a strike does. The consequence is a ladder — seven days,
 *   then thirty, then a ban — and which rung this account lands on depends on
 *   how many strikes it already carries, which the account detail does not
 *   carry. So the ladder is stated in full rather than one rung of it guessed.
 *   A message naming only the strike, or only a suspension, would repeat the
 *   omission a previous phase already had to fix.
 * - The count is not readable, which is every moderator: that is said plainly,
 *   with the rule.
 */
function WarningConsequence({ activeWarningCount }: { activeWarningCount?: number | null }) {
  const known = typeof activeWarningCount === 'number';
  const isThird = known && activeWarningCount >= 2;

  return (
    <div
      style={{
        marginTop: 10,
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        background: isThird ? v.warningDim : v.surfaceSunken,
        fontFamily: v.fontBody,
        fontSize: 13,
        lineHeight: 1.55,
        color: isThird ? v.warningText : v.ink2,
      }}
    >
      {!known ? (
        <>
          how many warnings this account already carries cannot be read with your access. three
          active warnings issue a strike: a first strike suspends the account for seven days, a
          second for thirty, and a third bans it.
        </>
      ) : isThird ? (
        <>
          this account has <strong>{activeWarningCount} active warnings</strong>. this one will be
          the third, which issues a strike automatically and resets the count to zero. a strike
          suspends the account — seven days for a first strike, thirty for a second — and a third
          strike bans it outright.
        </>
      ) : (
        <>
          this account has{' '}
          <strong>
            {activeWarningCount} active {activeWarningCount === 1 ? 'warning' : 'warnings'}
          </strong>
          . this will make {activeWarningCount + 1}. the third issues a strike.
        </>
      )}
    </div>
  );
}
