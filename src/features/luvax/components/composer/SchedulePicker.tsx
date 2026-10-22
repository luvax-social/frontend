import { useMemo, useState } from 'react';

import { v } from '@/config/tokens';

import { LxBtn, LxTag } from '../primitives';
import {
  checkSchedule,
  floorToMinute,
  fromInputs,
  quickPicks,
  SCHEDULE_MAX_DAYS,
  scheduleProblemMessage,
  timezoneLabel,
  toDateInput,
  toTimeInput,
} from '../../utils/scheduleTime';

const fieldStyle = (invalid: boolean) =>
  ({
    fontFamily: v.fontBody,
    fontSize: 14,
    color: v.ink,
    background: invalid ? v.errorDim : v.surfaceSunken,
    border: `1px solid ${invalid ? v.error : v.border}`,
    borderRadius: 8,
    padding: '9px 12px',
    outline: 'none',
  }) as const;

/**
 * Picks the time a scheduled post goes out, in the person's own time zone.
 *
 * The helper states both limits up front, one minute and thirty days, so the limit message that
 * replaces it when a time breaks one is no surprise. The primary button stays disabled until the
 * inputs form an acceptable time. A time chosen here is only a proposal: the composer holds it and
 * sends it with the post, and the backend repeats the same check.
 */
export function SchedulePicker({
  value,
  onSet,
  onClear,
  onCancel,
}: {
  value: Date | null;
  onSet: (at: Date) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const now = useMemo(() => new Date(), []);
  const initial = value ?? quickPicks(now).find((pick) => pick.id === 'tomorrow')!.at;
  const [date, setDate] = useState(toDateInput(initial));
  const [time, setTime] = useState(toTimeInput(initial));

  const chosen = fromInputs(date, time);
  const problem = checkSchedule(chosen, new Date());
  const invalid = problem !== null;

  return (
    <div
      role="group"
      aria-label="schedule"
      data-testid="schedule-picker"
      style={{
        margin: '4px 0 12px',
        padding: 16,
        background: v.base,
        border: `1px solid ${v.border}`,
        borderRadius: 12,
        boxShadow: `0 2px 8px ${v.shadow12}`,
      }}
    >
      <div
        style={{
          fontFamily: v.fontDisplay,
          fontSize: 15,
          fontWeight: 600,
          color: v.ink,
          marginBottom: 10,
        }}
      >
        schedule
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label="date"
          aria-invalid={invalid}
          style={{ ...fieldStyle(invalid), flex: 1, minWidth: 0 }}
        />
        <input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          aria-label="time"
          aria-invalid={invalid}
          style={{ ...fieldStyle(invalid), width: 110 }}
        />
      </div>
      <p
        data-testid="schedule-helper"
        role={invalid ? 'alert' : undefined}
        style={{
          margin: '10px 0',
          fontFamily: v.fontBody,
          fontSize: 13,
          color: invalid ? v.errorText : v.ink2,
        }}
      >
        {invalid
          ? scheduleProblemMessage(problem)
          : `Your time, ${timezoneLabel(chosen ?? now)}. Between 1 minute and ${SCHEDULE_MAX_DAYS} days from now.`}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {quickPicks(now).map((pick) => (
          <LxTag
            key={pick.id}
            size="sm"
            active={date === toDateInput(pick.at) && time === toTimeInput(pick.at)}
            onClick={() => {
              setDate(toDateInput(pick.at));
              setTime(toTimeInput(pick.at));
            }}
          >
            {pick.label}
          </LxTag>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <LxBtn variant="ghost" size="sm" type="button" onClick={onClear}>
            clear
          </LxBtn>
          <LxBtn variant="ghost" size="sm" type="button" onClick={onCancel}>
            cancel
          </LxBtn>
        </div>
        <LxBtn
          size="sm"
          type="button"
          disabled={invalid}
          onClick={() => chosen && onSet(floorToMinute(chosen))}
        >
          set time
        </LxBtn>
      </div>
    </div>
  );
}
