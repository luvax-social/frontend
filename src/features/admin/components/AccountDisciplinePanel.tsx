import type { AdminWarnUserRequest } from '@/types/admin';
import { useState } from 'react';

import { v } from '@/config/tokens';
import { isAdminRole } from '@/config/roles';
import { useAuthStore } from '@/store/useAuthStore';
import { LxBtn } from '@/features/luvax/components/primitives';
import { toast } from '@/features/luvax/components/Toast';

import { ViolationHistory } from './ViolationHistory';
import { WarnDialog } from './WarnDialog';
import { useAccountDetail } from '../hooks/useAccountDetail';
import { useDisciplineActions } from '../hooks/useDisciplineActions';
import { useVocabularies } from '../hooks/useVocabularies';
import { describeError } from '../lib/errors';

/**
 * An account's discipline record with the control to warn it: the violation
 * history plus the warn button and its dialog, as one drop-in panel used by both
 * the account moderation screen and the report detail. Sharing it means the
 * report detail closes the two items the previous phase deferred — the owner's
 * violation history and the warn-the-owner control — with the same code the
 * account screen uses, rather than a second copy.
 *
 * **The warn control renders only where the target can actually be warned.**
 * Only an ordinary account may be warned; the backend refuses an elevated target
 * with `ADMIN_TARGET_NOT_WARNABLE`. Where the target's role is knowable the
 * control is withheld rather than offered and then refused, because a control
 * that always fails is worse than no control.
 *
 * Whether the role is knowable depends on the caller. An administrator can read
 * it from the account detail, so for an administrator this is decided before
 * anything renders. A moderator cannot read that endpoint at all, so for a
 * moderator the control is offered and an ineligible target is surfaced through
 * the specific refusal code — the fallback the backend handoff prescribes for
 * exactly this asymmetry, and defensible because the accounts a moderator
 * reaches from a report are almost always ordinary ones.
 *
 * On success the history refetches through the mutation's cache invalidation, so
 * a new warning appears without a reload.
 *
 * @param {string} userId the account this panel acts on
 */
export function AccountDisciplinePanel({ userId }: { userId?: string | null }) {
  const role = useAuthStore((state) => state.role);
  const isAdmin = isAdminRole(role);
  const { reportReasons } = useVocabularies();
  const discipline = useDisciplineActions(userId);
  // Administrator only: the detail is the sole read that carries the target's
  // role, and a moderator receives 403 from it. Shared by query key with every
  // other reader of the same account, so this costs no extra request.
  const { detail } = useAccountDetail(userId, { enabled: isAdmin });
  // An administrator withholds the control for a target the server would refuse.
  // A moderator, which cannot know, keeps offering it.
  const canWarn = isAdmin ? detail?.role === 'user' : true;

  const [warnOpen, setWarnOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>> | null>(null);

  const openWarn = () => {
    setFieldErrors(null);
    setWarnOpen(true);
  };
  const closeWarn = () => {
    setWarnOpen(false);
    setFieldErrors(null);
  };

  const submitWarn = ({ reasonKey, note }: AdminWarnUserRequest) => {
    setFieldErrors(null);
    discipline.warn.mutate(
      { reasonKey, note },
      {
        onSuccess: (data) => {
          // Quoted from the warn response rather than recomputed. The account
          // detail now carries `activeWarningCount` too, which is what the
          // dialogue reads before issuing; this is the same number after the
          // fact, and after a strike it is legitimately zero because the ladder
          // resets the count.
          const count = data?.activeWarningCount;
          const suffix =
            typeof count === 'number'
              ? ` — ${count} active warning${count === 1 ? '' : 's'} now`
              : '';
          // The strike is not the whole outcome: it also moves the account's
          // status. `resultingStatus` is the server's own word for where the
          // account ended up, so it is quoted rather than inferred — a message
          // that says only "a strike was applied" leaves the reviewer to guess
          // whether the account is still able to sign in.
          const status = data?.resultingStatus;
          const outcome = status ? `, and the account is now ${String(status).toLowerCase()}` : '';
          toast(
            data?.strikeIssued
              ? `warning issued — this was the third active warning, so a strike was applied${outcome}${suffix}`
              : `warning issued${suffix}`
          );
          closeWarn();
        },
        onError: (err) => {
          const described = describeError(err);
          if (described.kind === 'field') {
            // Map VALIDATION_ERROR onto the form's per-field slots; a key that
            // matches no field is simply not shown, never crashed on.
            setFieldErrors({
              reasonKey: described.fields?.reasonKey,
              note: described.fields?.note,
            });
            return;
          }
          // A disabled reason, an ineligible (elevated) target, or a self-action
          // is a specific, honest message rather than a field error.
          if (described.kind !== 'silent') {
            toast(described.message);
          }
          closeWarn();
        },
      }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          borderBottom: `1px solid ${v.borderSubtle}`,
          paddingBottom: 12,
        }}
      >
        {canWarn ? (
          <LxBtn
            variant="primary"
            size="sm"
            onClick={openWarn}
            disabled={discipline.warn.isPending}
          >
            issue warning
          </LxBtn>
        ) : (
          <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
            a warning cannot be issued against {detail?.role === 'admin' ? 'an' : 'a'}{' '}
            {detail?.role ?? 'staff'} account.
          </span>
        )}
      </div>

      <ViolationHistory userId={userId} />

      <WarnDialog
        open={warnOpen}
        reasons={reportReasons}
        // Null for a moderator: the detail this comes from answers 403 there, so
        // the dialogue says the count is unreadable rather than showing a zero
        // it did not read.
        activeWarningCount={
          typeof detail?.activeWarningCount === 'number' ? detail.activeWarningCount : null
        }
        busy={discipline.warn.isPending}
        serverFieldErrors={fieldErrors}
        onConfirm={submitWarn}
        onClose={closeWarn}
      />
    </div>
  );
}
