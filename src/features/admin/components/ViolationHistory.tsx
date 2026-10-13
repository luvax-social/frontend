import { getErrorMessage } from '@/utils/errors';
import type { AdminViolationResponse } from '@/types/admin';
import { useState } from 'react';

import { v } from '@/config/tokens';
import { isAdminRole } from '@/config/roles';
import { useAuthStore } from '@/store/useAuthStore';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxBtn } from '@/features/luvax/components/primitives';
import { toast } from '@/features/luvax/components/Toast';

import { useViolations } from '../hooks/useViolations';
import { useAccountDetail } from '../hooks/useAccountDetail';
import { useDisciplineActions } from '../hooks/useDisciplineActions';
import { useVocabularies } from '../hooks/useVocabularies';
import { describeError } from '../lib/errors';
import { EmptyState, FailedState, LoadingState } from './ListStates';
import { LoadMore } from './LoadMore';
import { LocalTime } from './LocalTime';
import { ReporterName } from './ReporterName';
import { ReasonConfirmDialog } from './ReasonConfirmDialog';

/**
 * An account's violation history: its warnings, and for an administrator its
 * strikes too. Rendering branches on the union discriminator `kind`, never on
 * the presence of a field, so a strike and a warning are drawn from their own
 * branch and a future record type does not silently mis-render.
 *
 * A moderator sees warnings only; that view is complete for a moderator, so the
 * empty and populated states are worded without implying a strike is hidden.
 * Revocation is administrator-only and sits behind the shared reason-carrying
 * confirmation. A revoked record leaves the default listing, and the toggle
 * brings it back marked as revoked with when and by whom — which reverses what
 * an earlier phase recorded, when the only listing available dropped revoked
 * records entirely and the revocation survived solely in the action log.
 *
 * @param {string} userId the account whose history to render
 */
const KIND_TONES = {
  warning: { bg: v.warningDim, color: v.warningText, icon: 'alert', label: 'warning' },
  strike: { bg: v.errorDim, color: v.errorText, icon: 'ban', label: 'strike' },
};

function KindBadge({ kind }: { kind: 'warning' | 'strike' }) {
  const tone = KIND_TONES[kind] ?? { bg: v.surface, color: v.ink2, icon: 'flag', label: kind };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: v.fontMono,
        fontSize: 11,
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderRadius: 999,
        padding: '3px 9px',
        background: tone.bg,
        color: tone.color,
        whiteSpace: 'nowrap',
      }}
    >
      <LxIcon name={tone.icon} size={12} color={tone.color} />
      {tone.label}
    </span>
  );
}

/**
 * The revoke confirmation's wording.
 *
 * Revoking a strike undoes the record, not its consequence: the suspension the
 * strike produced is a separate state change and stays in force until somebody
 * lifts it. A confirmation that stops at "the strike will be revoked" invites a
 * reviewer to believe they have restored the account, and they will not find out
 * otherwise until the person complains. The current status is named when it is
 * one the revocation will not change.
 */
const revokeDescription = (kind: string, status: string | null | undefined) => {
  const base = `this ${kind} will be revoked and removed from the account's history. the reason is recorded in the action log.`;
  if (status === 'suspended') {
    return `${base} the account stays suspended — revoking the record does not lift the suspension, which must be lifted separately.`;
  }
  if (status === 'banned') {
    return `${base} the account stays banned — revoking the record does not lift the ban, which must be lifted separately.`;
  }
  return base;
};

export function ViolationHistory({ userId }: { userId?: string | null }) {
  const role = useAuthStore((state) => state.role);
  const isAdmin = isAdminRole(role);
  const { reasonLabel } = useVocabularies();
  // Off by default, matching the server's own default. Flipping it changes the
  // query key, so pagination restarts from the first page rather than replaying
  // a cursor the other listing rejects with INVALID_CURSOR.
  const [includeRevoked, setIncludeRevoked] = useState(false);

  const {
    rows,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useViolations(userId, includeRevoked);
  const discipline = useDisciplineActions(userId);
  // Read only as an administrator: revoke controls are administrator-only, so
  // this is exactly the audience that needs the account's current status, and a
  // moderator never fires a request that would answer 403.
  const { detail } = useAccountDetail(userId, { enabled: isAdmin });

  const [revoking, setRevoking] = useState<Pick<AdminViolationResponse, 'id' | 'kind'> | null>(
    null
  );
  const [serverError, setServerError] = useState<string | null>(null);

  const closeRevoke = () => {
    setRevoking(null);
    setServerError(null);
  };

  const runRevoke = (reason: string) => {
    if (!revoking) {
      return;
    }

    const options = {
      onSuccess: () => {
        toast(`${revoking.kind} revoked`);
        closeRevoke();
      },
      onError: (err: unknown) => {
        const described = describeError(err);
        if (described.kind === 'field') {
          setServerError(described.fields?.reason || described.message);
          return;
        }
        if (described.kind !== 'silent') {
          toast(described.message);
        }
        closeRevoke();
      },
    };
    if (revoking.kind === 'strike')
      discipline.revokeStrike.mutate({ strikeId: revoking.id, reason }, options);
    else discipline.revokeWarning.mutate({ warningId: revoking.id, reason }, options);
  };

  // The toggle is rendered in every state, including the empty one. If it were
  // inside the populated branch only, turning it on against an account whose
  // revoked records are its only records would hide the control that turned it
  // on, leaving no way back.
  const toggle = (
    <RevokedToggle checked={includeRevoked} disabled={isLoading} onChange={setIncludeRevoked} />
  );

  if (isLoading && rows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toggle}
        <LoadingState rows={3} />
      </div>
    );
  }
  if (isError && rows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toggle}
        <FailedState message={getErrorMessage(error, 'Something went wrong.')} onRetry={refetch} />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toggle}
        <EmptyState
          icon="check"
          title="clean record"
          hint={
            includeRevoked
              ? 'no records on file for this account, revoked ones included.'
              : isAdmin
                ? 'no warnings or strikes on file for this account.'
                : 'no warnings on file for this account.'
          }
        />
      </div>
    );
  }

  const revokeBusy = discipline.revokeWarning.isPending || discipline.revokeStrike.isPending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {toggle}
      {rows.map((record) => (
        <div
          key={record.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 14px',
            border: `1px solid ${v.border}`,
            borderRadius: 12,
            background: v.surfaceSunken,
            // A revoked record is still a record and stays legible; the reduced
            // emphasis says it no longer counts without hiding what it said.
            opacity: record.revokedAt ? 0.72 : 1,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <KindBadge kind={record.kind} />
              {record.kind === 'warning' ? (
                <span
                  style={{ fontFamily: v.fontBody, fontSize: 14, fontWeight: 500, color: v.ink }}
                >
                  {reasonLabel(record.reasonKey)}
                </span>
              ) : null}
              {record.kind === 'strike' ? (
                <span
                  style={{ fontFamily: v.fontBody, fontSize: 14, fontWeight: 500, color: v.ink }}
                >
                  strike #{record.strikeNumber}
                </span>
              ) : null}
              {record.revokedAt ? (
                <span
                  style={{
                    fontFamily: v.fontMono,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    borderRadius: 999,
                    padding: '3px 9px',
                    background: v.surface,
                    color: v.ink2,
                    border: `1px solid ${v.border}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  revoked
                </span>
              ) : null}
            </div>

            {record.kind === 'warning' && record.note ? (
              <div
                style={{
                  fontFamily: v.fontBody,
                  fontSize: 13,
                  color: v.ink2,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {record.note}
              </div>
            ) : null}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: v.fontBody,
                fontSize: 12,
                color: v.ink2,
                flexWrap: 'wrap',
              }}
            >
              <span>by</span>
              <ReporterName userId={record.actorId} prefix="@" />
              <span aria-hidden="true">·</span>
              <LocalTime value={record.createdAt} showZone={false} />
            </div>

            {record.revokedAt ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: v.fontBody,
                  fontSize: 12,
                  color: v.ink2,
                  flexWrap: 'wrap',
                }}
              >
                <span>revoked by</span>
                <ReporterName userId={record.revokedBy} prefix="@" />
                <span aria-hidden="true">·</span>
                <LocalTime value={record.revokedAt} showZone={false} />
              </div>
            ) : null}
          </div>

          {isAdmin && !record.revokedAt ? (
            <LxBtn
              variant="ghost"
              size="sm"
              disabled={revokeBusy}
              onClick={() => {
                setServerError(null);
                setRevoking({ id: record.id, kind: record.kind });
              }}
            >
              revoke
            </LxBtn>
          ) : null}
        </div>
      ))}

      <LoadMore
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
      />

      <ReasonConfirmDialog
        open={Boolean(revoking)}
        title={revoking ? `revoke ${revoking.kind}` : 'revoke'}
        description={revoking ? revokeDescription(revoking.kind, detail?.status) : ''}
        confirmLabel="revoke"
        tone="danger"
        busy={revokeBusy}
        serverError={serverError}
        onConfirm={runRevoke}
        onClose={closeRevoke}
      />
    </div>
  );
}

/**
 * Controls whether revoked warnings and strikes are listed.
 *
 * Off by default, which is the server's own default. It is a checkbox rather
 * than a pair of filter buttons because it adds records to the list rather than
 * choosing between two lists, and because "include revoked" reads as what it
 * does where "all / active" would leave the reader to work out which is which.
 *
 * Flipping it restarts pagination. That is not a nicety: the cursor is scoped
 * on this flag and the server rejects one issued under the other setting, so
 * carrying a cursor across would produce INVALID_CURSOR rather than a page.
 */
function RevokedToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        fontFamily: v.fontBody,
        fontSize: 12,
        color: v.ink2,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        style={{ accentColor: v.accentText, width: 14, height: 14 }}
      />
      include revoked records
    </label>
  );
}
