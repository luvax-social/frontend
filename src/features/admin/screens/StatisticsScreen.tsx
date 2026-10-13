import type { TopHashtagResponse } from '@/types/admin';
import type { TimeRange } from '../lib/statistics';
import { useEffect, useMemo, useState } from 'react';

import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';
import { LxBtn, LxTag } from '@/features/luvax/components/primitives';

import { PageHeader, PanelCard } from '../components/PanelPage';
import { EmptyState, FailedState, LoadingState } from '../components/ListStates';
import { LocalTime } from '../components/LocalTime';
import { DateRangeControl } from '../components/DateRangeControl';
import { TimeseriesChart } from '../components/TimeseriesChart';
import { useCurrentStats, useStatsTimeseries } from '../hooks/useStats';
import { useRateLimitCooldown } from '../hooks/useRateLimitCooldown';
import { describeError } from '../lib/errors';
import {
  FINE_HORIZON_DAYS,
  GRANULARITIES,
  METRICS,
  MAX_WINDOW_DAYS,
  availableGranularities,
  granularityFor,
  localZone,
  metricFor,
  seriesState,
} from '../lib/statistics';

/**
 * Statistics. Administrator only.
 *
 * The screen has one job that outranks every other: never to assert a number
 * nobody measured. A chart is the most confident thing an interface can draw,
 * and the data behind this one is deliberately sparse — the collection job
 * writes one bucket every half hour, there is no backfill, and a bucket that was
 * never written can never be written later. So three states that are easy to
 * conflate are kept apart everywhere on this screen:
 *
 * - **nothing has ever been collected** — the snapshot's `computedAt` is null,
 *   or a series comes back with no points. The screen says so and draws nothing.
 * - **it was measured and it was zero** — points exist and are zero. That is a
 *   fact about the platform and is drawn as a line on the baseline.
 * - **a bucket in the middle is missing** — the line is cut, and the interval is
 *   hatched and named.
 *
 * The snapshot is a stored bucket up to thirty minutes old and is labelled as of
 * its time, never as live. The single exception is the top-hashtag list, which
 * the server computes at request time and flags as such.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const GAUGE_METRICS = METRICS.filter((m) => m.kind === 'gauge');
const FLOW_METRICS = METRICS.filter((m) => m.kind === 'flow');

export function StatisticsScreen() {
  const current = useCurrentStats();
  const cooldown = useRateLimitCooldown();

  const [metric, setMetric] = useState('registrations');
  const [granularity, setGranularity] = useState('half_hour');
  const [range, setRange] = useState(() => {
    const to = Date.now();
    return { fromMs: to - DAY_MS, toMs: to };
  });

  const granularityOptions = useMemo(() => availableGranularities(range.fromMs), [range.fromMs]);

  // Selecting a granularity the window cannot serve is prevented in the control
  // rather than surfaced as a server error, so this only ever fires when a range
  // change makes an already-selected granularity unreachable. Falling back to
  // the one that is always available is the correct move, and the screen says it
  // happened rather than switching silently.
  const selectedAvailable =
    granularityOptions.find((option) => option.key === granularity)?.available ?? true;
  const [autoDowngraded, setAutoDowngraded] = useState(false);

  useEffect(() => {
    if (!selectedAvailable) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGranularity('day');

      setAutoDowngraded(true);
    }
  }, [selectedAvailable]);

  const timeseries = useStatsTimeseries({
    metric,
    granularity,
    fromMs: range.fromMs,
    toMs: range.toMs,
    enabled: !cooldown.cooling && selectedAvailable,
  });

  // A 429 disables the controls for exactly the returned Retry-After and is
  // never retried on a timer; the query's own retry policy already refuses to
  // repeat it.
  useEffect(() => {
    if (!timeseries.isError) {
      return;
    }
    const described = describeError(timeseries.error);
    if (described.code === 'TOO_MANY_REQUESTS') {
      cooldown.start(described.retryAfterSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeseries.isError, timeseries.error]);

  const commitRange = (next: TimeRange) => {
    setAutoDowngraded(false);
    setRange(next);
  };

  const chosenMetric = metricFor(metric);
  // The axis is labelled from what the server said it returned, not from what
  // was asked for; the two can differ.
  const resolvedGranularity = granularityFor(timeseries.resolvedGranularity ?? granularity);
  const state = seriesState(timeseries.points);

  return (
    <div>
      <PageHeader
        title="statistics"
        right={
          <LxBtn
            variant="secondary"
            size="sm"
            onClick={() => current.refetch()}
            disabled={current.isFetching}
          >
            {current.isFetching ? 'refreshing...' : 'refresh snapshot'}
          </LxBtn>
        }
      />

      <SnapshotPanel current={current} />

      <PanelCard title="series">
        <MetricSelector value={metric} onChange={setMetric} disabled={cooldown.cooling} />

        <div style={{ height: 1, background: v.borderSubtle, margin: '16px 0' }} />

        <GranularitySelector
          options={granularityOptions}
          value={granularity}
          onChange={(next) => {
            setAutoDowngraded(false);
            setGranularity(next);
          }}
          disabled={cooldown.cooling}
        />

        {autoDowngraded ? (
          <p
            style={{
              margin: '10px 0 0',
              fontFamily: v.fontBody,
              fontSize: 12,
              color: v.warningText,
            }}
          >
            this range starts before the {FINE_HORIZON_DAYS}-day fine-bucket horizon, so the
            half-hour series no longer exists for it. the granularity was moved to daily.
          </p>
        ) : null}

        <div style={{ height: 1, background: v.borderSubtle, margin: '16px 0' }} />

        <DateRangeControl
          value={range}
          maxDays={MAX_WINDOW_DAYS}
          onCommit={commitRange}
          disabled={cooldown.cooling}
          disabledReason={
            cooldown.cooling
              ? `the server refused the last request for exceeding its rate limit. this control is held for ${cooldown.remaining} more second${
                  cooldown.remaining === 1 ? '' : 's'
                }, the delay the server asked for. nothing is being retried in the background.`
              : null
          }
        />
      </PanelCard>

      <PanelCard
        title={`${chosenMetric.label} — ${chosenMetric.kind === 'gauge' ? 'state at each bucket' : 'activity within each bucket'}`}
      >
        <SeriesBody
          cooling={cooldown.cooling}
          remaining={cooldown.remaining}
          timeseries={timeseries}
          state={state}
          metric={chosenMetric}
          granularity={resolvedGranularity}
          range={range}
        />
      </PanelCard>
    </div>
  );
}

function SeriesBody({
  cooling,
  remaining,
  timeseries,
  state,
  metric,
  granularity,
  range,
}: {
  cooling: boolean;
  remaining: number;
  timeseries: ReturnType<typeof useStatsTimeseries>;
  state: string;
  metric: ReturnType<typeof metricFor>;
  granularity: ReturnType<typeof granularityFor>;
  range: TimeRange;
}) {
  if (cooling) {
    return (
      <EmptyState
        icon="clock"
        title="held back by the server's rate limit"
        hint={`the statistics series allows a limited number of reads a minute and the last request was refused. the controls return in ${remaining} second${
          remaining === 1 ? '' : 's'
        }. nothing is being retried in the background.`}
      />
    );
  }
  if (timeseries.isLoading) {
    return <LoadingState rows={4} />;
  }
  if (timeseries.isError) {
    const described = describeError(timeseries.error);
    return <FailedState message={described.message} onRetry={() => timeseries.refetch()} />;
  }

  if (state === 'empty') {
    return (
      <EmptyState
        icon="eye"
        title="nothing was collected in this window"
        hint={`no bucket exists for ${metric.label} between these two times. that is not the same as a measurement of zero: the collection job never wrote here, and because nothing backfills the table it never will. try a more recent window.`}
      />
    );
  }

  return (
    <div>
      {state === 'zero' ? (
        <p
          style={{
            margin: '0 0 12px',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: v.surface,
            fontFamily: v.fontBody,
            fontSize: 13,
            color: v.ink2,
          }}
        >
          every bucket in this window was collected and every one of them counted zero. this is a
          measurement, not an absence — the line sits on the baseline because that is where the data
          is.
        </p>
      ) : null}

      <TimeseriesChart
        points={timeseries.points}
        metric={metric}
        granularity={granularity}
        fromMs={range.fromMs}
        toMs={range.toMs}
      />

      <p style={{ margin: '12px 0 0', fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
        {timeseries.points.length} bucket{timeseries.points.length === 1 ? '' : 's'} returned,{' '}
        {granularity.label}, times shown in {localZone()}. every point is a stored measurement; the
        chart draws nothing between them.
      </p>
    </div>
  );
}

function MetricSelector({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const group = (label: string, hint: string, metrics: typeof METRICS) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontFamily: v.fontMono,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: v.ink2,
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>{hint}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {metrics.map((m) => (
          <LxTag
            key={m.key}
            size="sm"
            active={value === m.key}
            onClick={disabled ? undefined : () => onChange(m.key)}
          >
            {m.label}
          </LxTag>
        ))}
      </div>
    </div>
  );

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: disabled ? 0.5 : 1 }}
      aria-label="metric"
    >
      {group(
        'state of the platform',
        'each point is how things stood at the end of that bucket. these never sum across buckets.',
        GAUGE_METRICS
      )}
      {group(
        'activity within each bucket',
        'each point is how much happened inside that bucket.',
        FLOW_METRICS
      )}
      <p style={{ margin: 0, fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
        one metric is read at a time. the series endpoint allows a small number of reads a minute
        and there are {METRICS.length} metrics, so a screen that drew them all at once would exhaust
        its budget in two page loads.
      </p>
    </div>
  );
}

function GranularitySelector({
  options,
  value,
  onChange,
  disabled,
}: {
  options: ReturnType<typeof availableGranularities>;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: disabled ? 0.5 : 1 }}>
      <span
        style={{
          fontFamily: v.fontMono,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: v.ink2,
        }}
      >
        bucket width
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {options.map((option) => (
          <span
            key={option.key}
            style={option.available ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}
            title={option.available ? undefined : (option.unavailableReason ?? undefined)}
          >
            <LxTag
              size="sm"
              active={value === option.key}
              onClick={option.available && !disabled ? () => onChange(option.key) : undefined}
            >
              {option.label}
              {option.available ? '' : ' (unavailable for this range)'}
            </LxTag>
          </span>
        ))}
      </div>
      {options.some((option) => !option.available) ? (
        <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
          fine buckets are kept for {FINE_HORIZON_DAYS} days and then rolled up into daily rows and
          deleted. a range starting before that can only be read daily, so the half-hour option is
          offered as unavailable rather than allowed and then refused.
        </span>
      ) : (
        <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
          both widths are available for this range. fine buckets survive {FINE_HORIZON_DAYS} days.
        </span>
      )}
      <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
        {GRANULARITIES.length} widths exist; the server accepts no other.
      </span>
    </div>
  );
}

function SnapshotPanel({ current }: { current: ReturnType<typeof useCurrentStats> }) {
  if (current.isLoading) {
    return (
      <PanelCard title="snapshot">
        <LoadingState rows={3} />
      </PanelCard>
    );
  }

  if (current.isError) {
    const described = describeError(current.error);
    return (
      <PanelCard title="snapshot">
        <FailedState message={described.message} onRetry={() => current.refetch()} />
      </PanelCard>
    );
  }

  // The pre-collection state. The figures in the payload are all zero here, and
  // rendering them would assert that the platform has no accounts, which is a
  // different and false claim. So none of them are shown.
  if (current.neverCollected) {
    return (
      <PanelCard title="snapshot">
        <EmptyState
          icon="clock"
          title="no statistics have been collected yet"
          hint="the collection job writes one bucket every 30 minutes and skips the partial bucket it starts inside, so the first readable bucket appears within an hour of the server starting. until then there is nothing to show. the zeroes in the response are placeholders for absent rows, not counts, so none of them are displayed here."
        />
      </PanelCard>
    );
  }

  const snapshot = current.snapshot;
  if (!snapshot) {
    return null;
  }

  return (
    <PanelCard
      title="snapshot"
      right={
        <span style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
          as of <LocalTime value={snapshot.computedAt} />
        </span>
      }
    >
      <p style={{ margin: '0 0 16px', fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
        read from the last completed bucket, which began at{' '}
        <LocalTime value={snapshot.bucketStart} showZone={false} />. these figures are up to 30
        minutes behind the platform and are not live — an account banned a moment ago will not
        appear here until the next bucket is written.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Figure label="accounts" value={snapshot.totalUsers} />
        <Figure label="posts" value={snapshot.totalPosts} />
        <Figure label="comments" value={snapshot.totalComments} />
        <Figure label="stories, live" value={snapshot.totalStories} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 20,
        }}
      >
        <Breakdown label="accounts by status" map={snapshot.usersByStatus} />
        <Breakdown label="accounts by role" map={snapshot.usersByRole} />
        <Breakdown label="reports by status" map={snapshot.reportsByStatus} />
        <Breakdown label="reports by reason" map={snapshot.reportsByReason} />
      </div>

      <div style={{ marginTop: 20 }}>
        <TopHashtags entries={snapshot.topHashtags} live={snapshot.topHashtagsLive} />
      </div>
    </PanelCard>
  );
}

function Figure({ label, value }: { label: string; value?: number | null }) {
  return (
    <div
      style={{
        border: `1px solid ${v.border}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        background: v.base,
      }}
    >
      <div
        style={{
          fontFamily: v.fontMono,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: v.ink2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: v.fontDisplay,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: v.ink,
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Breakdown({ label, map }: { label: string; map?: Record<string, number> }) {
  const entries = Object.entries(map ?? {});
  return (
    <div>
      <div
        style={{
          fontFamily: v.fontMono,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: v.ink2,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {entries.length === 0 ? (
        <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
          no rows in this bucket
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map(([key, value]) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12,
                fontFamily: v.fontBody,
                fontSize: 13,
                color: v.ink2,
              }}
            >
              <span>{key.replace(/_/g, ' ')}</span>
              <span style={{ fontFamily: v.fontMono, color: v.ink }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopHashtags({ entries, live }: { entries: TopHashtagResponse[]; live?: boolean }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: v.fontMono,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: v.ink2,
          }}
        >
          most used hashtags
        </span>
        {live ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: v.fontBody,
              fontSize: 11,
              color: v.successText,
            }}
          >
            <LxIcon name="check" size={11} color={v.successText} />
            counted now, not from the bucket
          </span>
        ) : null}
      </div>
      {(entries ?? []).length === 0 ? (
        <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
          no active hashtags carry a post
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {entries.map((tag) => (
            <span
              key={tag.name}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: `1px solid ${v.border}`,
                borderRadius: 999,
                padding: '4px 10px',
                fontFamily: v.fontBody,
                fontSize: 12,
                color: v.ink2,
              }}
            >
              <LxIcon name="hash" size={11} color={v.ink2} />
              {tag.name}
              <span style={{ fontFamily: v.fontMono, color: v.ink2 }}>{tag.postCount}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
