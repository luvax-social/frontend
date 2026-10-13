import type { StatPointResponse } from '@/types/admin';
export interface PlotPoint {
  t: number;
  value: number;
}
export interface TimeRange {
  fromMs: number;
  toMs: number;
}
/**
 * The statistics contract, expressed as data and pure functions.
 *
 * Everything here was established against the running server and is recorded in
 * `observability-contract-verification.md`. Nothing is inferred from the OpenAPI
 * enumeration, and nothing here invents a value the server did not send.
 *
 * The three rules this module exists to enforce:
 *
 * 1. An empty series and a series of measured zeros are different facts and are
 *    never conflated. `[]` means nothing was ever collected; a point with value
 *    0 means the job ran, looked, and counted nothing.
 * 2. A bucket absent from a returned series is a gap, not a zero. The series is
 *    cut into segments at every gap so no line is ever drawn across one.
 * 3. Every limit the server enforces is enforced here first, so a reviewer meets
 *    a bounded control rather than a 400.
 */

/**
 * The fourteen metrics the server accepts, in the order they are offered.
 *
 * `kind` is not decoration. A gauge is the state of the world at the end of a
 * bucket; a flow is how much happened inside it. The server's daily roll-up sums
 * flows and takes the last value for gauges, and summing 48 snapshots of "total
 * accounts" would produce a number 48 times too large. The panel therefore never
 * aggregates a series itself — it draws the points it was given — and the kind is
 * shown so a reviewer knows which question a chart answers.
 *
 * `unit` labels the y axis. Every metric here counts things; the unit names what
 * is being counted.
 */
export const METRICS = [
  { key: 'users_total', label: 'accounts, total', unit: 'accounts', kind: 'gauge' },
  { key: 'users_by_status', label: 'accounts by status', unit: 'accounts', kind: 'gauge' },
  { key: 'users_by_role', label: 'accounts by role', unit: 'accounts', kind: 'gauge' },
  { key: 'posts_total', label: 'posts, total', unit: 'posts', kind: 'gauge' },
  { key: 'comments_total', label: 'comments, total', unit: 'comments', kind: 'gauge' },
  { key: 'stories_total', label: 'stories, live', unit: 'stories', kind: 'gauge' },
  { key: 'reports_by_status', label: 'reports by status', unit: 'reports', kind: 'gauge' },
  { key: 'reports_by_reason', label: 'reports by reason', unit: 'reports', kind: 'gauge' },
  { key: 'registrations', label: 'registrations', unit: 'accounts created', kind: 'flow' },
  { key: 'posts_created', label: 'posts created', unit: 'posts created', kind: 'flow' },
  { key: 'comments_created', label: 'comments created', unit: 'comments created', kind: 'flow' },
  { key: 'follows_created', label: 'follows created', unit: 'follows created', kind: 'flow' },
  { key: 'likes_created', label: 'likes created', unit: 'likes created', kind: 'flow' },
  {
    key: 'admin_actions_by_type',
    label: 'moderation actions by type',
    unit: 'actions taken',
    kind: 'flow',
  },
];

export const metricFor = (key: string | null | undefined) =>
  METRICS.find((m) => m.key === key) ?? METRICS[0];

/**
 * The two granularities the server accepts. There is no hourly bucket; asking
 * for one is refused with 400. `stepMs` is what makes a gap detectable: buckets
 * are aligned to the epoch in UTC, so a correctly collected series advances by
 * exactly this much between consecutive points.
 */
export const GRANULARITIES = [
  { key: 'half_hour', label: 'every 30 minutes', stepMs: 30 * 60 * 1000 },
  { key: 'day', label: 'daily', stepMs: 24 * 60 * 60 * 1000 },
];

export const granularityFor = (key: string | null | undefined) =>
  GRANULARITIES.find((g) => g.key === key) ?? GRANULARITIES[0];

/** Longest span a single series read may cover. Verified: 365 days passes, 366 is refused. */
export const MAX_WINDOW_DAYS = 365;

/**
 * How far back fine buckets survive. Verified as a rolling boundary measured on
 * `from` alone against now, not on the width of the window: a one-hour window
 * whose lower bound is 31 days old is still refused at half-hour granularity.
 */
export const FINE_HORIZON_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the server will honour a granularity for a window starting at `from`.
 *
 * Day granularity is always available. Half-hour is available only while `from`
 * is inside the fine retention horizon; past it the rows were rolled up and
 * deleted, and the server refuses rather than answering with an empty series,
 * because an empty chart is indistinguishable from a stretch in which nothing
 * happened.
 *
 * A small safety margin is applied so a request composed a few seconds before it
 * is sent does not cross the rolling boundary in flight.
 */
export const isGranularityAvailable = (
  granularityKey: string,
  fromMs: number,
  nowMs = Date.now()
) => {
  if (granularityKey !== 'half_hour') {
    return true;
  }
  const horizon = nowMs - FINE_HORIZON_DAYS * DAY_MS;
  const margin = 5 * 60 * 1000;
  return fromMs >= horizon + margin;
};

/** The granularities selectable for a window, each flagged with why it is or is not. */
export const availableGranularities = (fromMs: number, nowMs = Date.now()) =>
  GRANULARITIES.map((g) => ({
    ...g,
    available: isGranularityAvailable(g.key, fromMs, nowMs),
    unavailableReason:
      g.key === 'half_hour'
        ? `fine buckets are kept for ${FINE_HORIZON_DAYS} days; this window starts before that`
        : null,
  }));

/**
 * Clamps a range to what the server accepts, before it is ever submitted.
 *
 * Two things are enforced: `to` must be after `from`, and the span may not
 * exceed one year. The clamp moves `from` forward rather than `to` back, because
 * the reviewer chose the end of the window they care about and the recent end is
 * the one worth keeping.
 *
 * Returns the corrected range together with a note naming what was changed, so
 * the control can say what it did instead of silently altering the input.
 */
export const clampRange = (fromMs: number, toMs: number, maxDays = MAX_WINDOW_DAYS) => {
  let from = fromMs;
  let to = toMs;
  let note: string | null = null;

  if (!(to > from)) {
    to = from + DAY_MS;
    note = 'the end of the range must be after its start; it was moved to one day later.';
  }
  if (to - from > maxDays * DAY_MS) {
    from = to - maxDays * DAY_MS;
    note = `a range may span at most ${maxDays} days; the start was moved forward to fit.`;
  }
  return { fromMs: from, toMs: to, note };
};

/**
 * Groups a flat point list into one series per dimension.
 *
 * A metric with no breakdown reports the empty string as its dimension and
 * yields exactly one series. A metric with a breakdown yields one series per
 * dimension that appears — and a dimension nobody held during a bucket has no
 * row at all rather than a row holding zero, which is why a series may be
 * shorter than its neighbours without anything being wrong.
 */
export const groupByDimension = (points: StatPointResponse[] = []) => {
  const map = new Map<string, PlotPoint[]>();
  for (const point of points) {
    const key = point?.dimension ?? '';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push({ t: Date.parse(point.bucketStart), value: Number(point.value) || 0 });
  }
  return [...map.entries()]
    .map(([dimension, values]) => ({
      dimension,
      points: values.sort((a, b) => a.t - b.t),
    }))
    .sort((a, b) => a.dimension.localeCompare(b.dimension));
};

/**
 * Cuts one series into contiguous segments, breaking wherever a bucket is
 * missing.
 *
 * This is the whole of the no-fabrication rule for the chart. The server returns
 * only the buckets it actually collected; a bucket that was never written can
 * never be written later, because there is no backfill. Joining across the hole
 * would draw a straight line through two measurements that were never taken, and
 * a straight line is the most confident thing a chart can say.
 *
 * A step is treated as a break when it exceeds one interval by more than half an
 * interval, which tolerates the small jitter in a bucket boundary without ever
 * absorbing a genuinely missing bucket.
 *
 * A segment holding a single point is kept: it is drawn as a lone marker, which
 * is honest, rather than dropped for being unlineable.
 */
export const toSegments = (points: PlotPoint[] = [], stepMs: number) => {
  if (points.length === 0) {
    return [];
  }
  const tolerance = stepMs * 1.5;
  const segments = [[points[0]]];
  for (let i = 1; i < points.length; i += 1) {
    const gap = points[i].t - points[i - 1].t;
    if (gap > tolerance) {
      segments.push([points[i]]);
    } else {
      segments[segments.length - 1].push(points[i]);
    }
  }
  return segments;
};

/** How many buckets are missing between two consecutive segments. */
export const missingBucketCount = (endMs: number, startMs: number, stepMs: number) =>
  Math.max(0, Math.round((startMs - endMs) / stepMs) - 1);

/**
 * Classifies a response into the three states the screen renders differently.
 *
 * - `empty`  the server returned no points at all. Nothing was ever collected
 *            for this metric in this window.
 * - `zero`   points exist and every one of them is 0. The job ran and counted
 *            nothing. This is a measurement, not an absence.
 * - `data`   points exist and at least one is non-zero.
 *
 * Collapsing `empty` into `zero` is how a panel lies: it turns "we do not know"
 * into "we know it was none".
 */
export const seriesState = (points: Pick<StatPointResponse, 'value'>[] = []) => {
  if (points.length === 0) {
    return 'empty';
  }
  return points.some((p) => Number(p.value) !== 0) ? 'data' : 'zero';
};

/**
 * Chooses a rounded upper bound for the value axis and the tick values under it.
 *
 * The axis always starts at zero. Every metric counts things, a count cannot be
 * negative, and a non-zero baseline exaggerates variation — a flat line near the
 * top of a chart whose axis starts at 168 reads as volatility that is not there.
 *
 * A series that is entirely zero gets a nominal bound of 1 so the axis has a
 * scale at all; the line then sits on the baseline, which is exactly right.
 */
export const valueAxis = (maxValue: number, tickCount = 4) => {
  if (!(maxValue > 0)) {
    return { max: 1, ticks: [0, 1] };
  }
  const rough = maxValue / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const stepFactor = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  const step = stepFactor * magnitude;
  const max = Math.ceil(maxValue / step) * step;
  const ticks = [];
  for (let value = 0; value <= max + step / 2; value += step) {
    ticks.push(Math.round(value * 1000) / 1000);
  }
  return { max, ticks };
};

/** The viewer's timezone name, shown so a reviewer knows whose clock a chart is on. */
export const localZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
  } catch {
    return 'local time';
  }
};

/** Formats a bucket start for a time-axis tick, in the viewer's own timezone. */
export const formatAxisTime = (ms: number, granularityKey: string | null | undefined) =>
  new Date(ms).toLocaleString(
    undefined,
    granularityKey === 'day'
      ? { month: 'short', day: 'numeric' }
      : { hour: '2-digit', minute: '2-digit' }
  );

/** Formats a bucket start in full, for a readout where precision matters. */
export const formatFullTime = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** A dimension key as a label. The empty dimension means the metric has no breakdown. */
export const dimensionLabel = (dimension: string, metric: { label: string }) =>
  dimension === '' ? metric.label : dimension.replace(/_/g, ' ');

/** An ISO instant for the wire, from a local millisecond value. */
export const toIso = (ms: number) => new Date(ms).toISOString();
