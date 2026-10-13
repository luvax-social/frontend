import type { AdminRoleChangeRequest, UserRole } from '@/types/admin';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { v } from '@/config/tokens';
import { CHAR_LIMITS } from '@/config/constants';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { LxIcon } from '@/components/ui/lx-icon';

/**
 * The role-change form.
 *
 * The selectable roles are exactly the target's `assignableRoles` from
 * capabilities — nothing is offered that the server would refuse. Promotion to
 * administrator is the one-way door: it is visibly distinguished from every other
 * option, and choosing it surfaces plain irreversibility wording and switches the
 * confirm to the destructive tone. The confirm is not pre-armed (the 500ms arming
 * delay applies as everywhere), and a reason is mandatory.
 *
 * @param {boolean} open
 * @param {string} currentRole the target's present role, for transition labels
 * @param {string[]} assignableRoles the roles the server permits for this target
 * @param {boolean} busy
 * @param {string} serverError a non-field server message to show inline
 * @param {(payload:{role:string, reason:string})=>void} onConfirm
 * @param {()=>void} onClose
 */
const ARMING_DELAY_MS = 500;
const REASON_MAX = CHAR_LIMITS.reportDescription;

const transitionLabel = (currentRole: string | undefined, target: string) => {
  if (target === 'admin') {
    return 'promote to administrator';
  }
  if (target === 'moderator') {
    return currentRole === 'user' ? 'promote to moderator' : 'change to moderator';
  }
  return 'demote to user';
};

export function RoleChangeDialog({
  open,
  currentRole,
  assignableRoles = [],
  busy = false,
  serverError = null,
  onConfirm,
  onClose,
}: {
  open: boolean;
  currentRole?: string;
  assignableRoles?: UserRole[];
  busy?: boolean;
  serverError?: string | null;
  onConfirm: (values: AdminRoleChangeRequest) => void;
  onClose: () => void;
}) {
  const [role, setRole] = useState<UserRole | ''>('');
  const [reason, setReason] = useState('');
  const [armed, setArmed] = useState(false);
  const [localErrors, setLocalErrors] = useState<Partial<Record<string, string>>>({});
  const openCount = useRef(0);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRole('');

      setReason('');

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

  const reasonError = localErrors.reason || serverError || '';
  const roleError = localErrors.role || '';
  const overLimit = reason.length > REASON_MAX;
  const promoting = role === 'admin';

  const submit = () => {
    if (!armed || busy) {
      return;
    }
    const next: Record<string, string> = {};
    if (!role) {
      next.role = 'select a role';
    }
    if (!reason.trim()) {
      next.reason = 'a reason is required';
    }
    if (Object.keys(next).length > 0) {
      setLocalErrors(next);
      return;
    }
    if (overLimit) {
      return;
    }
    onConfirm({ role: role as UserRole, reason: reason.trim() });
  };

  const confirmInert = !armed || busy;
  const confirmBg = confirmInert ? v.surfaceRaised : promoting ? v.error : v.accent;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="change role"
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
          width: 460,
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
            change role
          </div>
          <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink2, lineHeight: 1.55 }}>
            this account is currently <strong style={{ color: v.ink2 }}>{currentRole}</strong>.
            choose the role to move it to.
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="target role"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {assignableRoles.map((target) => {
            const selected = role === target;
            const oneWay = target === 'admin';
            return (
              <button
                key={target}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={busy}
                onClick={() => {
                  setRole(target);
                  if (localErrors.role) {
                    setLocalErrors((prev) => ({ ...prev, role: undefined }));
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  padding: '11px 13px',
                  borderRadius: 12,
                  cursor: busy ? 'default' : 'pointer',
                  background: selected ? (oneWay ? v.errorDim : v.accentDim) : v.surfaceSunken,
                  border: `1px solid ${selected ? (oneWay ? v.error : v.accent) : v.border}`,
                }}
              >
                <LxIcon
                  name={oneWay ? 'shield' : 'check'}
                  size={16}
                  color={selected ? (oneWay ? v.errorText : v.accentText) : v.ink2}
                />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span
                    style={{ fontFamily: v.fontBody, fontSize: 14, fontWeight: 600, color: v.ink }}
                  >
                    {transitionLabel(currentRole, target)}
                  </span>
                  {oneWay ? (
                    <span
                      style={{
                        fontFamily: v.fontMono,
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: v.errorText,
                      }}
                    >
                      one-way — cannot be undone
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
          <span
            style={{
              fontFamily: v.fontBody,
              fontSize: 12,
              color: roleError ? v.errorText : 'transparent',
              minHeight: 16,
            }}
          >
            {roleError || '.'}
          </span>
        </div>

        {promoting ? (
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 12,
              background: v.errorDim,
              border: `1px solid ${v.error}`,
            }}
          >
            <LxIcon name="alert" size={18} color={v.errorText} />
            <div
              style={{ fontFamily: v.fontBody, fontSize: 13, color: v.errorText, lineHeight: 1.5 }}
            >
              Promotion to administrator cannot be reversed through this panel. An administrator can
              never be demoted or otherwise acted on here. Continue only if this is intended.
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="role-reason"
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
            id="role-reason"
            value={reason}
            maxLength={REASON_MAX}
            disabled={busy}
            rows={3}
            placeholder="why this role is being changed"
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
              background: confirmBg,
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
            {busy ? 'applying...' : promoting ? 'promote to administrator' : 'change role'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
