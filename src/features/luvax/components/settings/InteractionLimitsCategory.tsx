import { useEffect, useRef, useState } from 'react';

import { LxToggle } from '@/components/ui/lx-toggle';
import type { InteractionLimitDuration, InteractionLimitResponse } from '@/types/domain';

import {
  useClearInteractionLimit,
  useMyInteractionLimit,
  useSetInteractionLimit,
} from '../../hooks/useInteractionLimits';
import { formatLimitEnd } from '../../utils/interactionLimitFormat';
import { LxBtn } from '../primitives';
import { SettingsRadioGroup, type RadioOption } from './SettingsRadioGroup';
import { SettingsRow, StateBlock } from './settingsParts';

const NON_FOLLOWERS_LABEL = "accounts that don't follow you";
const RECENT_FOLLOWERS_LABEL = 'accounts that followed you in the last 7 days';

// A radio group is keyed by strings, so each preset `PUT /users/me/interaction-limits` accepts has
// a string value, and the two lookups below convert between that value and the number of days
// without a cast.
type DurationValue = `${InteractionLimitDuration}`;
const DURATIONS: readonly RadioOption<DurationValue>[] = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '28', label: '28 days' },
];
const DAYS_OF: Record<DurationValue, InteractionLimitDuration> = {
  '1': 1,
  '3': 3,
  '7': 7,
  '14': 14,
  '28': 28,
};
const VALUE_OF: Record<InteractionLimitDuration, DurationValue> = {
  1: '1',
  3: '3',
  7: '7',
  14: '14',
  28: '28',
};
const DEFAULT_DURATION: InteractionLimitDuration = 7;

const ON_FAILED_MESSAGE = "We couldn't turn that on just now. Try again in a moment.";
const OFF_FAILED_MESSAGE = "We couldn't turn that off just now. Try again in a moment.";

// The longest delay a timer holds: a larger one overflows and fires at once. A 28 day limit is
// further away than this, so the expiry timer re-arms itself instead of waiting in one step.
const LONGEST_TIMER_MS = 2 ** 31 - 1;
// Past the end by a little, so the server's own clock agrees that the limit is over.
const EXPIRY_GRACE_MS = 500;
// When the server still reports a limit after its end, ask again at this pace instead of at once.
const EXPIRY_RETRY_MS = 5000;

interface Draft {
  limitNonFollowers: boolean;
  limitRecentFollowers: boolean;
  durationDays: InteractionLimitDuration;
}

const INITIAL_DRAFT: Draft = {
  limitNonFollowers: false,
  limitRecentFollowers: false,
  durationDays: DEFAULT_DURATION,
};

const describeAudience = (limit: InteractionLimitResponse) => {
  if (limit.limitNonFollowers && limit.limitRecentFollowers) {
    return `Limiting ${NON_FOLLOWERS_LABEL} and ${RECENT_FOLLOWERS_LABEL}.`;
  }
  return limit.limitNonFollowers
    ? `Limiting ${NON_FOLLOWERS_LABEL}.`
    : `Limiting ${RECENT_FOLLOWERS_LABEL}.`;
};

/**
 * The Limit interactions settings page.
 *
 * With no limit in force it is a form: two audience switches, a duration and "turn on", which stays
 * disabled until an audience is chosen. With a limit in force the form is replaced by a status
 * line giving the end time in the viewer's own timezone, "turn off now", and "change", which
 * reopens the form with the current audiences.
 *
 * Nothing here is optimistic: the server computes the end time, so the status appears only after
 * the server has answered. A timer refetches the limit when its end passes while the page is open,
 * so the status does not keep claiming limits that have stopped.
 *
 * When the view swaps, focus follows it, because the control that was pressed is gone: to the
 * status line after "turn on" or "cancel", and to the first audience switch after "change" or
 * "turn off now".
 */
export function InteractionLimitsCategory() {
  const { data: limit, isLoading, error, refetch } = useMyInteractionLimit();
  const setLimit = useSetInteractionLimit();
  const clearLimit = useClearInteractionLimit();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [failure, setFailure] = useState('');
  const [expiryTick, setExpiryTick] = useState(0);

  const view = !limit ? 'loading' : limit.active && !editing ? 'status' : 'form';
  const focusAfterSwap = useRef<'status' | 'form' | null>(null);
  const statusRef = useRef<HTMLSpanElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const wasActive = useRef(false);

  // Runs when the view changes, not on every render: it exists only to hand focus to the control
  // that replaced the one that was pressed, and only when a press asked for it. A request can
  // resolve long after the press, so focus is handed over only while it is still on this page's
  // content or nowhere (the pressed control just left); a user who moved on keeps their place.
  useEffect(() => {
    if (focusAfterSwap.current !== view) return;
    focusAfterSwap.current = null;
    const focused = document.activeElement;
    if (focused && focused !== document.body && !rootRef.current?.contains(focused)) return;
    const target =
      view === 'status'
        ? statusRef.current
        : formRef.current?.querySelector<HTMLElement>('[role="switch"]');
    target?.focus();
  }, [view]);

  const isActive = Boolean(limit?.active);
  // A limit that ends while the page is open leaves nothing of the old choices behind: the form
  // that comes back is the initial one, not the draft of a "change" that was never saved.
  useEffect(() => {
    if (wasActive.current && !isActive) {
      setDraft(INITIAL_DRAFT);
      setEditing(false);
      setFailure('');
    }
    wasActive.current = isActive;
  }, [isActive]);

  const expiresAt = limit?.active ? limit.expiresAt : null;
  // Re-arms when the end moves, after each wait that fell short of the end because a timer cannot
  // hold a delay as long as 28 days, and after a refetch that still reports the same limit (the
  // server's clock can trail this one). Cleared on unmount so a left page never refetches.
  useEffect(() => {
    if (!expiresAt) return;
    const end = Date.parse(expiresAt);
    if (Number.isNaN(end)) return;
    let cancelled = false;
    const remaining = end - Date.now();
    const wait =
      remaining > 0
        ? Math.min(remaining + EXPIRY_GRACE_MS, LONGEST_TIMER_MS)
        : expiryTick === 0
          ? EXPIRY_GRACE_MS
          : EXPIRY_RETRY_MS;
    const timer = window.setTimeout(() => {
      if (end - Date.now() > 0) {
        setExpiryTick((tick) => tick + 1);
        return;
      }
      void refetch().finally(() => {
        if (!cancelled) setExpiryTick((tick) => tick + 1);
      });
    }, wait);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [expiresAt, expiryTick, refetch]);

  if (error && !limit) {
    return (
      <StateBlock
        icon="alert"
        title="we could not load your interaction limit"
        hint="the server did not answer. reload the page and it should come back."
      />
    );
  }
  if (isLoading || !limit) return <StateBlock icon="clock" title="loading" />;

  if (view === 'status') {
    return (
      <div ref={rootRef}>
        <div className="lx-limit-status">
          <div className="lx-limit-status-line">
            <span className="lx-limit-status-dot" aria-hidden="true" />
            <span ref={statusRef} tabIndex={-1} className="lx-limit-status-title">
              {`limits are on until ${formatLimitEnd(limit.expiresAt)}`}
            </span>
          </div>
          <p className="lx-settings-note">{describeAudience(limit)}</p>
          <div className="lx-limit-status-actions">
            <LxBtn
              variant="secondary"
              size="sm"
              type="button"
              disabled={clearLimit.isPending}
              onClick={() => {
                setFailure('');
                // The form is not on screen while the status is, so it is reset now and is
                // already empty when turning off brings it back.
                setDraft(INITIAL_DRAFT);
                focusAfterSwap.current = 'form';
                clearLimit.mutate(undefined, {
                  onError: () => {
                    focusAfterSwap.current = null;
                    setFailure(OFF_FAILED_MESSAGE);
                  },
                });
              }}
            >
              turn off now
            </LxBtn>
            <button
              type="button"
              className="lx-settings-textlink"
              onClick={() => {
                setFailure('');
                setDraft({
                  limitNonFollowers: limit.limitNonFollowers,
                  limitRecentFollowers: limit.limitRecentFollowers,
                  durationDays: DEFAULT_DURATION,
                });
                focusAfterSwap.current = 'form';
                setEditing(true);
              }}
            >
              change
            </button>
          </div>
          {failure ? (
            <div className="lx-settings-error" role="alert">
              {failure}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const none = !draft.limitNonFollowers && !draft.limitRecentFollowers;

  return (
    <div
      ref={(node) => {
        formRef.current = node;
        rootRef.current = node;
      }}
    >
      <SettingsRow
        label={NON_FOLLOWERS_LABEL}
        control={
          <LxToggle
            label={NON_FOLLOWERS_LABEL}
            on={draft.limitNonFollowers}
            onChange={(value) => setDraft({ ...draft, limitNonFollowers: value })}
          />
        }
      />
      <SettingsRow
        label={RECENT_FOLLOWERS_LABEL}
        control={
          <LxToggle
            label={RECENT_FOLLOWERS_LABEL}
            on={draft.limitRecentFollowers}
            onChange={(value) => setDraft({ ...draft, limitRecentFollowers: value })}
          />
        }
      />

      <div className="lx-settings-section">
        <h3 className="lx-settings-section-title">for how long</h3>
        <SettingsRadioGroup
          label="for how long"
          variant="segmented"
          options={DURATIONS}
          value={VALUE_OF[draft.durationDays]}
          onChange={(value) => setDraft({ ...draft, durationDays: DAYS_OF[value] })}
        />
        {/* Only when a limit is already running: the preselected 7 days is a default, not the
            duration that was chosen before, which the server does not keep. */}
        {limit.active ? (
          <p className="lx-settings-note lx-limit-restart-hint">The new duration starts now.</p>
        ) : null}
      </div>

      <ul className="lx-settings-note lx-limit-effects">
        <li>Their new comments on your posts are hidden. You can review them on each post.</li>
        <li>Their new message requests go to hidden requests.</li>
        <li>You won&apos;t be notified when they mention you.</li>
      </ul>

      {failure ? (
        <div className="lx-settings-error" role="alert">
          {failure}
        </div>
      ) : null}

      <div className="lx-settings-actions">
        <LxBtn
          variant="primary"
          type="button"
          disabled={none || setLimit.isPending}
          onClick={() => {
            setFailure('');
            focusAfterSwap.current = 'status';
            setLimit.mutate(draft, {
              onSuccess: () => setEditing(false),
              onError: () => {
                focusAfterSwap.current = null;
                setFailure(ON_FAILED_MESSAGE);
              },
            });
          }}
        >
          {setLimit.isPending ? 'turning on' : 'turn on'}
        </LxBtn>
        {editing ? (
          <LxBtn
            variant="ghost"
            type="button"
            onClick={() => {
              setFailure('');
              focusAfterSwap.current = 'status';
              setEditing(false);
            }}
          >
            cancel
          </LxBtn>
        ) : null}
      </div>
    </div>
  );
}
