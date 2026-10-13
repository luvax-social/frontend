import type { CSSProperties, ChangeEvent, SubmitEvent } from 'react';
import type { TimeRange } from '../lib/statistics';
import { useEffect, useMemo, useState } from 'react';

import { v } from '@/config/tokens';
import { LxBtn } from '@/features/luvax/components/primitives';

import { clampRange, localZone } from '../lib/statistics';

/**
 * Derived pattern: a bounded date-range control that commits on submit.
 *
 * Two things make this control what it is, and both come from the endpoints
 * behind it rather than from taste.
 *
 * **It fires on commit, not on change.** The two endpoints this control drives
 * allow 20 requests a minute in production, the tightest budget in the system. A
 * range control wired to its own `onChange` issues a request for every
 * intermediate value a reviewer passes through while dragging or typing, and
 * exhausts that budget in seconds. So every edit here changes a draft, and only
 * "apply" turns the draft into a request.
 *
 * **It clamps before submitting.** The maximum span is enforced by the control
 * and stated on it, so a reviewer meets a bound rather than a 400. The window
 * slider cannot be dragged past the limit at all, and a range typed into the
 * two fields is corrected on commit with a note saying what was changed and why,
 * rather than being altered silently.
 *
 * @param {number} maxDays the endpoint's verified maximum span
 * @param {(range: {fromMs:number,toMs:number}) => void} onCommit
 * @param {boolean} disabled
 * @param {string} disabledReason shown in place of the limit while disabled
 * @param {string} unsetHint what to say while no range has been applied. The
 *   default suits an endpoint whose bounds are mandatory and which is therefore
 *   showing nothing at all; a screen whose bounds are optional is already
 *   showing rows and must say something else, or it tells the reviewer nothing
 *   was requested while a full page sits underneath.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// Window lengths the slider steps through, in days. Discrete rather than
// continuous because a reviewer wants "the last week", not "the last 6.4 days",
// and because a discrete track cannot land on a value the endpoint refuses.
const WINDOW_STEPS = [0.25, 0.5, 1, 2, 3, 7, 14, 30, 60, 90, 180, 365];

const pad = (n: number) => String(n).padStart(2, '0');

/** A millisecond instant as the local wall-clock string a datetime-local input takes. */
const toLocalInput = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
};

/** The reverse. Returns null for an incomplete or unparseable entry. */
const fromLocalInput = (text: string) => {
  const ms = new Date(text).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const describeSpan = (days: number) => {
  if (days < 1) {
    return `${Math.round(days * 24)} hours`;
  }
  return `${days} day${days === 1 ? '' : 's'}`;
};

// The panel's one control shape, so a date input sits in the same row as the
// apply button without reading as a different kind of thing.
const fieldStyle: CSSProperties = {
  fontFamily: v.fontMono,
  fontSize: 12,
  color: v.ink,
  background: v.base,
  border: `1px solid ${v.border}`,
  borderRadius: 'var(--radius-pill)',
  height: 30,
  padding: '0 var(--space-3)',
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  fontFamily: v.fontMono,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: v.ink2,
};

export function DateRangeControl({
  value,
  maxDays,
  onCommit,
  disabled = false,
  disabledReason = null,
  unsetHint = 'nothing has been requested yet — set both ends and apply.',
}: {
  value: TimeRange | null;
  maxDays: number;
  onCommit: (range: TimeRange) => void;
  disabled?: boolean;
  disabledReason?: string | null;
  unsetHint?: string;
}) {
  const steps = useMemo(() => WINDOW_STEPS.filter((d) => d <= maxDays), [maxDays]);

  // `value` is null before a range has ever been committed. The activity log
  // starts that way on purpose: both bounds are mandatory there, so the screen
  // must be able to exist in a state where it has neither and has asked for
  // nothing.
  const [draftFrom, setDraftFrom] = useState(() => (value ? toLocalInput(value.fromMs) : ''));
  const [draftTo, setDraftTo] = useState(() => (value ? toLocalInput(value.toMs) : ''));
  const [note, setNote] = useState<string | null>(null);

  const committedFrom = value?.fromMs ?? null;
  const committedTo = value?.toMs ?? null;

  // The committed range is the source of truth; the draft follows it whenever it
  // changes from outside, such as a preset being applied elsewhere.
  useEffect(() => {
    if (committedFrom === null || committedTo === null) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftFrom(toLocalInput(committedFrom));

    setDraftTo(toLocalInput(committedTo));
    // The note is deliberately not cleared here. A commit that was clamped sets
    // the note and then changes the committed range, so clearing it on that
    // change would wipe the explanation in the same tick it was written and the
    // correction would land silently — which is the one thing this control must
    // not do. The note is cleared where an edit actually invalidates it instead.
  }, [committedFrom, committedTo]);

  const draftFromMs = fromLocalInput(draftFrom);
  const draftToMs = fromLocalInput(draftTo);
  const draftSpanDays =
    draftFromMs !== null && draftToMs !== null ? (draftToMs - draftFromMs) / DAY_MS : null;

  // The slider index is derived from the draft rather than held separately, so
  // typing a date and dragging the slider cannot disagree with one another.
  const sliderIndex = useMemo(() => {
    if (draftSpanDays === null) {
      return steps.length - 1;
    }
    let closest = 0;
    for (let i = 1; i < steps.length; i += 1) {
      if (Math.abs(steps[i] - draftSpanDays) < Math.abs(steps[closest] - draftSpanDays)) {
        closest = i;
      }
    }
    return closest;
  }, [draftSpanDays, steps]);

  // Compared as the strings the inputs hold, not as milliseconds. A
  // datetime-local field has minute precision, so a committed instant carrying
  // seconds can never equal its own round trip through the field, and comparing
  // numbers would leave the control permanently claiming to be edited.
  const dirty =
    draftFromMs === null ||
    draftToMs === null ||
    committedFrom === null ||
    committedTo === null ||
    draftFrom !== toLocalInput(committedFrom) ||
    draftTo !== toLocalInput(committedTo);

  const handleSlider = (event: ChangeEvent<HTMLInputElement>) => {
    const days = steps[Number(event.target.value)] ?? steps[steps.length - 1];
    // With no end entered yet the slider anchors on now, so dragging it composes
    // a whole range rather than doing nothing.
    const anchor = draftToMs ?? committedTo ?? Date.now();
    if (draftToMs === null) {
      setDraftTo(toLocalInput(anchor));
    }
    setDraftFrom(toLocalInput(anchor - days * DAY_MS));
    setNote(null);
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled) {
      return;
    }
    if (draftFromMs === null || draftToMs === null) {
      setNote('enter both a start and an end before applying.');
      return;
    }
    // The endpoint's own maximum, not the module default: this control serves
    // two endpoints whose limits differ by an order of magnitude (a year for the
    // series, thirty days for the activity log), and clamping to the wrong one
    // lets a refused window through.
    const clamped = clampRange(draftFromMs, draftToMs, maxDays);
    setNote(clamped.note);
    onCommit({ fromMs: clamped.fromMs, toMs: clamped.toMs });
  };

  const applyPreset = (days: number) => {
    if (disabled) {
      return;
    }
    // eslint-disable-next-line react-hooks/purity
    const to = Date.now();
    setNote(null);
    onCommit({ fromMs: to - days * DAY_MS, toMs: to });
  };

  const presets = steps.filter((d) => [1, 7, 30, 90].includes(d));

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      aria-label="date range"
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 1 240px' }}>
          <span style={labelStyle}>from</span>
          <input
            type="datetime-local"
            value={draftFrom}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setDraftFrom(event.target.value);
              setNote(null);
            }}
            disabled={disabled}
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 1 240px' }}>
          <span style={labelStyle}>to</span>
          <input
            type="datetime-local"
            value={draftTo}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setDraftTo(event.target.value);
              setNote(null);
            }}
            disabled={disabled}
            style={fieldStyle}
          />
        </label>
        <LxBtn
          type="submit"
          variant={dirty ? 'primary' : 'secondary'}
          size="sm"
          disabled={disabled}
        >
          apply
        </LxBtn>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={labelStyle}>
          window length — {describeSpan(steps[sliderIndex])} — at most {maxDays} days
        </span>
        <input
          type="range"
          min={0}
          max={steps.length - 1}
          step={1}
          value={sliderIndex}
          onChange={handleSlider}
          disabled={disabled}
          aria-label={`window length, at most ${maxDays} days`}
          style={{ width: '100%', accentColor: v.accent }}
        />
      </label>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={labelStyle}>jump to</span>
          {presets.map((days) => (
            <LxBtn
              key={days}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => applyPreset(days)}
              disabled={disabled}
            >
              last {describeSpan(days)}
            </LxBtn>
          ))}
        </div>
        <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
          {/* Both endpoints behind this control treat the window as half-open,
              verified at the boundary against a real row's timestamp on each
              rather than assumed from one. Saying so matters because a reviewer
              setting an exact end time and not finding the row that sits on it
              would otherwise read a correct result as a missing record. */}
          from is included, to is not — times are {localZone()}
        </span>
      </div>

      {dirty && !disabled ? (
        <p style={{ margin: 0, fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
          {value === null
            ? unsetHint
            : 'the range has been edited and not applied yet — nothing is requested until you apply it.'}
        </p>
      ) : null}

      {note ? (
        <p style={{ margin: 0, fontFamily: v.fontBody, fontSize: 12, color: v.warningText }}>
          {note}
        </p>
      ) : null}

      {disabled && disabledReason ? (
        <p style={{ margin: 0, fontFamily: v.fontBody, fontSize: 12, color: v.warningText }}>
          {disabledReason}
        </p>
      ) : null}
    </form>
  );
}
