import { useState } from 'react';

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

// Values and labels of the presets `PUT /users/me/interaction-limits` accepts. The radio values
// are strings because a radio group is string-keyed; they are converted back before sending.
const DURATIONS: readonly RadioOption<string>[] = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '28', label: '28 days' },
];
const DEFAULT_DURATION: InteractionLimitDuration = 7;

const ON_FAILED_MESSAGE = "We couldn't turn that on just now. Try again in a moment.";
const OFF_FAILED_MESSAGE = "We couldn't turn that off just now. Try again in a moment.";

interface Draft {
  limitNonFollowers: boolean;
  limitRecentFollowers: boolean;
  durationDays: InteractionLimitDuration;
}

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
 * the server has answered.
 */
export function InteractionLimitsCategory() {
  const { data: limit, isLoading, error } = useMyInteractionLimit();
  const setLimit = useSetInteractionLimit();
  const clearLimit = useClearInteractionLimit();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    limitNonFollowers: false,
    limitRecentFollowers: false,
    durationDays: DEFAULT_DURATION,
  });
  const [failure, setFailure] = useState('');

  if (error) {
    return (
      <StateBlock
        icon="alert"
        title="we could not load your interaction limit"
        hint="the server did not answer. reload the page and it should come back."
      />
    );
  }
  if (isLoading || !limit) return <StateBlock icon="clock" title="loading" />;

  if (limit.active && !editing) {
    return (
      <div>
        <div className="lx-limit-status">
          <div className="lx-limit-status-line">
            <span className="lx-limit-status-dot" aria-hidden="true" />
            <span className="lx-limit-status-title">
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
                clearLimit.mutate(undefined, { onError: () => setFailure(OFF_FAILED_MESSAGE) });
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
                setEditing(true);
              }}
            >
              change
            </button>
          </div>
          {failure ? <div className="lx-settings-error">{failure}</div> : null}
        </div>
      </div>
    );
  }

  const none = !draft.limitNonFollowers && !draft.limitRecentFollowers;

  return (
    <div>
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
          value={String(draft.durationDays)}
          onChange={(value) =>
            setDraft({ ...draft, durationDays: Number(value) as InteractionLimitDuration })
          }
        />
      </div>

      <ul className="lx-settings-note lx-limit-effects">
        <li>Their new comments on your posts are hidden. You can review them on each post.</li>
        <li>Their new message requests go to hidden requests.</li>
        <li>You won&apos;t be notified when they mention you.</li>
      </ul>

      {failure ? <div className="lx-settings-error">{failure}</div> : null}

      <div className="lx-settings-actions">
        <LxBtn
          variant="primary"
          type="button"
          disabled={none || setLimit.isPending}
          onClick={() => {
            setFailure('');
            setLimit.mutate(draft, {
              onSuccess: () => setEditing(false),
              onError: () => setFailure(ON_FAILED_MESSAGE),
            });
          }}
        >
          {setLimit.isPending ? 'turning on' : 'turn on'}
        </LxBtn>
        {editing ? (
          <LxBtn variant="ghost" type="button" onClick={() => setEditing(false)}>
            cancel
          </LxBtn>
        ) : null}
      </div>
    </div>
  );
}
