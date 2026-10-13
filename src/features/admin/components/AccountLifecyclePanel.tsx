import type { ReactNode } from 'react';
import { getErrorMessage } from '@/utils/errors';
import type { AdminUserDetailResponse, AdminUserSessionResponse } from '@/types/admin';
import type { UseMutationResult } from '@tanstack/react-query';
import type { AppError } from '@/api/axiosClient';
import { useState } from 'react';

import { v } from '@/config/tokens';
import { useAuthStore } from '@/store/useAuthStore';
import { LxBtn } from '@/features/luvax/components/primitives';
import { LxIcon } from '@/components/ui/lx-icon';
import { toast } from '@/features/luvax/components/Toast';

import { StatusBadge } from './StatusBadge';
import { LocalTime } from './LocalTime';
import { LoadingState, FailedState } from './ListStates';
import { ReportsAgainstList, SessionList } from './AccountSessionsPanel';
import { useCurrentSession } from '../hooks/useCurrentSession';
import { ReasonConfirmDialog } from './ReasonConfirmDialog';
import { SuspendDialog } from './SuspendDialog';
import { RoleChangeDialog } from './RoleChangeDialog';
import { useAccountDetail } from '../hooks/useAccountDetail';
import { useAccountActions } from '../hooks/useAccountActions';
import { describeError, getErrorCode } from '../lib/errors';

/**
 * An account's state and every lifecycle action an administrator may take on it,
 * driven entirely by the capabilities the server returns with the detail.
 *
 * The server decides which controls are legal; this component renders what the
 * capabilities permit and computes nothing about permission. `canChangeStatus`
 * gates whether any status control shows; which one is derived from the current
 * status (the capabilities object does not enumerate transitions, so the state
 * machine — active offers suspend/ban, suspended offers unsuspend/ban, banned
 * offers unban — is the minimum derivation, and an out-of-step transition is
 * answered by the backend as a conflict and refetched rather than pre-computed).
 * `assignableRoles` is the sole source of role transitions. Force logout is not
 * represented in capabilities: it is administrator-only and always permitted, so
 * it renders whenever the administrator-only detail is available.
 *
 * If the detail is unavailable — a moderator receives 403 — no lifecycle control
 * renders at all: an unavailable answer is not permission. After any action the
 * detail (and its capabilities) is refetched before the controls re-render.
 *
 * @param {string} userId the account this panel governs
 */

// The status transitions offered per current status, each gated by
// canChangeStatus. Verified against the backend state machine in
// accounts-contract-verification.md 3.3 so a rendered control does not 409.
const STATUS_ACTIONS: Record<string, string[]> = {
  active: ['suspend', 'ban'],
  suspended: ['unsuspend', 'ban'],
  banned: ['unban'],
  deactivated: ['ban'],
};

export function AccountLifecyclePanel({ userId }: { userId?: string | null }) {
  const signedInUserId = useAuthStore((state) => state.user?.id);
  const { detail, capabilities, isLoading, isError, error, refetch } = useAccountDetail(userId);
  const actions = useAccountActions(userId);

  const [dialog, setDialog] = useState<string | null>(null);
  const [serverError, setServerError] = useState('');
  // The row a per-session revoke confirmation is about, held while the dialog is
  // open so the confirmation can name what it is ending.
  const [sessionToRevoke, setSessionToRevoke] = useState<AdminUserSessionResponse | null>(null);
  const currentSession = useCurrentSession();

  const isSelf = Boolean(signedInUserId) && signedInUserId === userId;
  // True only when the server named the caller's session and the row queued for
  // revocation is that one. Never guessed from the account being one's own: an
  // administrator looking at their own account has many sessions and only one
  // of them is the one they are reading in.
  const isOwnSessionRow =
    currentSession.isKnown &&
    Boolean(sessionToRevoke?.id) &&
    sessionToRevoke?.id === currentSession.sessionId;

  if (isLoading) {
    return <LoadingState rows={3} />;
  }

  // A moderator's 403, or any state where capabilities did not load, renders no
  // control. A moderator legitimately has no account-lifecycle access, so this is
  // silent rather than an error; a transient failure offers a retry.
  if (isError) {
    if (getErrorCode(error) === 'FORBIDDEN') {
      return null;
    }
    return (
      <FailedState message={getErrorMessage(error, 'Something went wrong.')} onRetry={refetch} />
    );
  }

  if (!capabilities || !detail) {
    return null;
  }

  const openDialog = (type: string) => {
    setServerError('');
    setDialog(type);
  };
  const closeDialog = () => {
    setServerError('');
    setDialog(null);
    setSessionToRevoke(null);
  };

  const run = <T, V>(
    mutation: Pick<UseMutationResult<T, AppError, V>, 'mutate'>,
    payload: V,
    successMessage: string
  ) => {
    setServerError('');
    mutation.mutate(payload, {
      onSuccess: () => {
        toast(successMessage);
        closeDialog();
      },
      onError: (err) => {
        const described = describeError(err);
        if (described.kind === 'field') {
          const first = described.fields ? Object.values(described.fields)[0] : null;
          setServerError(first || 'please check the form and try again');
          return;
        }
        // A conflict means the account's state changed under the reviewer; refetch
        // so the controls re-sync, and say so calmly rather than as a raw error.
        if (described.isConflict) {
          refetch();
        }
        if (described.kind !== 'silent') {
          toast(described.message);
        }
        closeDialog();
      },
    });
  };

  const statusActions = capabilities.canChangeStatus ? (STATUS_ACTIONS[detail.status] ?? []) : [];
  const roleAssignable = capabilities.canChangeRole ? (capabilities.assignableRoles ?? []) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StateSummary detail={detail} isSelf={isSelf} />

      <div
        style={{
          borderTop: `1px solid ${v.borderSubtle}`,
          paddingTop: 14,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        {statusActions.includes('suspend') ? (
          <LxBtn
            variant="secondary"
            size="sm"
            onClick={() => openDialog('suspend')}
            style={{ color: v.warningText }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <LxIcon name="clock" size={14} color={v.warningText} />
              suspend
            </span>
          </LxBtn>
        ) : null}
        {statusActions.includes('unsuspend') ? (
          <LxBtn variant="secondary" size="sm" onClick={() => openDialog('unsuspend')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <LxIcon name="check" size={14} color={v.successText} />
              lift suspension
            </span>
          </LxBtn>
        ) : null}
        {statusActions.includes('ban') ? (
          <LxBtn variant="danger" size="sm" onClick={() => openDialog('ban')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <LxIcon name="ban" size={14} color={v.error} />
              ban
            </span>
          </LxBtn>
        ) : null}
        {statusActions.includes('unban') ? (
          <LxBtn variant="secondary" size="sm" onClick={() => openDialog('unban')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <LxIcon name="check" size={14} color={v.successText} />
              lift ban
            </span>
          </LxBtn>
        ) : null}
        {roleAssignable.length > 0 ? (
          <LxBtn variant="secondary" size="sm" onClick={() => openDialog('role')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <LxIcon name="shield" size={14} color={v.ink2} />
              change role
            </span>
          </LxBtn>
        ) : null}
        <LxBtn variant="ghost" size="sm" onClick={() => openDialog('forceLogout')}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <LxIcon name="logout" size={14} color={v.ink2} />
            {isSelf ? 'sign out my sessions' : 'force logout'}
          </span>
        </LxBtn>
      </div>

      {/* Sessions and reports-against were surfaced as counts by the previous
          phase. Both are full arrays in this payload, so both are rendered as
          what they are. They sit here rather than on their own screen because
          the only revocation that exists is the account-wide force logout whose
          confirmation is already in this component. */}
      <div style={{ borderTop: `1px solid ${v.borderSubtle}`, paddingTop: 16 }}>
        <SessionList
          sessions={detail.sessions}
          isSelf={isSelf}
          onRevokeAll={() => openDialog('forceLogout')}
          onRevokeSession={(row) => {
            setSessionToRevoke(row);
            openDialog('revokeSession');
          }}
          currentSessionId={currentSession.sessionId}
          currentSessionKnown={currentSession.isKnown}
        />
      </div>

      <div style={{ borderTop: `1px solid ${v.borderSubtle}`, paddingTop: 16 }}>
        <ReportsAgainstList reports={detail.reportsAgainst} />
      </div>

      <ReasonConfirmDialog
        open={dialog === 'ban'}
        title="ban this account"
        description="the account is signed out and cannot sign in again until an administrator lifts the ban. its username and email stay reserved."
        confirmLabel="ban account"
        tone="danger"
        busy={actions.ban.isPending}
        serverError={serverError || null}
        onConfirm={(reason) => run(actions.ban, { reason }, 'account banned')}
        onClose={closeDialog}
      />
      <ReasonConfirmDialog
        open={dialog === 'unban'}
        title="lift this ban"
        description="the account can sign in again immediately."
        confirmLabel="lift ban"
        tone="default"
        busy={actions.unban.isPending}
        serverError={serverError || null}
        onConfirm={(reason) => run(actions.unban, { reason }, 'ban lifted')}
        onClose={closeDialog}
      />
      <ReasonConfirmDialog
        open={dialog === 'unsuspend'}
        title="lift this suspension"
        description="the account can sign in again immediately, before the suspension would have ended."
        confirmLabel="lift suspension"
        tone="default"
        busy={actions.unsuspend.isPending}
        serverError={serverError || null}
        onConfirm={(reason) => run(actions.unsuspend, { reason }, 'suspension lifted')}
        onClose={closeDialog}
      />
      <ReasonConfirmDialog
        open={dialog === 'forceLogout'}
        title={isSelf ? 'sign out your own sessions' : 'force logout'}
        description={
          isSelf
            ? 'this ends every active session for your own account, including this one — you will be signed out of the panel immediately and must sign in again.'
            : 'this ends every active session for the account. already-issued tokens stop working at once and the person must sign in again on every device. it does not ban or suspend the account.'
        }
        confirmLabel={isSelf ? 'sign myself out' : 'end all sessions'}
        tone="danger"
        busy={actions.forceLogout.isPending}
        serverError={serverError || null}
        onConfirm={(reason) =>
          run(actions.forceLogout, { reason }, isSelf ? 'signing you out...' : 'all sessions ended')
        }
        onClose={closeDialog}
      />
      {/* Per-session revocation. The confirmation states both halves of what it
          does: this session ends, the account's others do not. When the row is
          the reader's own session it says plainly that confirming signs them
          out, because that is the one case where the consequence lands on the
          person confirming. */}
      <ReasonConfirmDialog
        open={dialog === 'revokeSession'}
        title="end this session"
        description={
          isOwnSessionRow
            ? 'this ends the session you are reading this in and signs you out of the panel immediately. the account’s other sessions stay signed in. a revoked session cannot be restored — signing in again is the only way back.'
            : 'this ends one session. every other session this account holds stays signed in, and the account is not banned or suspended. a revoked session cannot be restored — the person signs in again.'
        }
        confirmLabel={isOwnSessionRow ? 'end my session and sign out' : 'end this session'}
        tone="danger"
        busy={actions.revokeSession.isPending}
        serverError={serverError || null}
        onConfirm={(reason) =>
          run(actions.revokeSession, { sessionId: sessionToRevoke!.id, reason }, 'session ended')
        }
        onClose={closeDialog}
      />
      <SuspendDialog
        open={dialog === 'suspend'}
        busy={actions.suspend.isPending}
        serverError={serverError || null}
        onConfirm={({ reason, durationDays }) =>
          run(actions.suspend, { reason, durationDays }, 'account suspended')
        }
        onClose={closeDialog}
      />
      <RoleChangeDialog
        open={dialog === 'role'}
        currentRole={detail.role}
        assignableRoles={roleAssignable}
        busy={actions.changeRole.isPending}
        serverError={serverError || null}
        onConfirm={({ role, reason }) =>
          run(
            actions.changeRole,
            { role, reason },
            role === 'admin' ? 'promoted to administrator' : 'role changed'
          )
        }
        onClose={closeDialog}
      />
    </div>
  );
}

const Field = ({ label, children }: { label?: ReactNode; children?: ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
    <span
      style={{
        fontFamily: v.fontMono,
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: v.ink2,
      }}
    >
      {label}
    </span>
    <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2, wordBreak: 'break-word' }}>
      {children}
    </span>
  </div>
);

function StateSummary({ detail, isSelf }: { detail: AdminUserDetailResponse; isSelf: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <StatusBadge status={detail.status} />
        <StatusBadge status={detail.role} />
        {detail.isVerified ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: v.fontMono,
              fontSize: 11,
              textTransform: 'uppercase',
              color: v.accentText,
            }}
          >
            <LxIcon name="check" size={12} color={v.accentText} /> verified
          </span>
        ) : null}
        {detail.isPrivate ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: v.fontMono,
              fontSize: 11,
              textTransform: 'uppercase',
              color: v.ink2,
            }}
          >
            <LxIcon name="lock" size={12} color={v.ink2} /> private
          </span>
        ) : null}
        {isSelf ? (
          <span
            style={{
              fontFamily: v.fontMono,
              fontSize: 11,
              textTransform: 'uppercase',
              color: v.ink2,
              background: v.surface,
              borderRadius: 999,
              padding: '2px 8px',
            }}
          >
            this is you
          </span>
        ) : null}
      </div>

      {/* `suspendedUntil` is null for two different things: an account that is
          not suspended, and one suspended with no end date. Reading it alone
          cannot tell them apart, so the status is read first and the null branch
          says "indefinitely" rather than rendering nothing, which would leave a
          suspended account looking unsuspended. */}
      {detail.status === 'suspended' ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: v.fontBody,
            fontSize: 13,
            color: v.warningText,
            background: v.warningDim,
            borderRadius: 10,
            padding: '8px 12px',
            width: 'fit-content',
          }}
        >
          <LxIcon name="clock" size={14} color={v.warningText} />
          {detail.suspendedUntil ? (
            <span>
              suspension ends <LocalTime value={detail.suspendedUntil} />
            </span>
          ) : (
            <span>
              suspended indefinitely — there is no end date, and it lasts until an administrator
              lifts it
            </span>
          )}
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 14,
        }}
      >
        <Field label="email">{detail.email || '—'}</Field>
        <Field label="registration address">
          {detail.registrationIp ? (
            <span style={{ fontFamily: v.fontMono, fontSize: 12 }}>{detail.registrationIp}</span>
          ) : (
            'none recorded'
          )}
        </Field>
        <Field label="last login address">
          {detail.lastLoginIp ? (
            <span style={{ fontFamily: v.fontMono, fontSize: 12 }}>{detail.lastLoginIp}</span>
          ) : (
            'none recorded'
          )}
        </Field>
        <Field label="joined">
          <LocalTime value={detail.createdAt} showZone={false} />
        </Field>
        <Field label="last login">
          {detail.lastLoginAt ? <LocalTime value={detail.lastLoginAt} showZone={false} /> : 'never'}
        </Field>
      </div>
    </div>
  );
}
