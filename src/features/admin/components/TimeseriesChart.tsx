import type { StatPointResponse } from '@/types/admin';
import type { metricFor, granularityFor } from '../lib/statistics';
type Metric = ReturnType<typeof metricFor>;
type Granularity = ReturnType<typeof granularityFor>;
interface Gap {
  fromMs: number;
  toMs: number;
  missing: number;
}
import { useEffect, useMemo, useRef, useState } from 'react';

import { v } from '@/config/tokens';

import {
  dimensionLabel,
  formatAxisTime,
  formatFullTime,
  groupByDimension,
  localZone,
  missingBucketCount,
  toSegments,
  valueAxis,
} from '../lib/statistics';

/**
 * Derived pattern: a time-series chart drawn as inline SVG from the existing
 * tokens. No charting library exists in this project and none was added.
 *
 * The form is a line per dimension over a linear time axis, with a marker on
 * every measured point. Two properties of that form are the reason for it:
 *
 * - The x axis is **time**, not the index of a point. A missing bucket therefore
 *   leaves a visibly wider blank than a present one. On an index axis a gap is
 *   invisible, because the points either side sit adjacent as though the
 *   measurement had simply continued.
 * - The line is cut at every gap and each measured point carries a marker, so
 *   what was measured is distinguishable from what the line merely passes
 *   through.
 *
 * The geometry is computed from the container's measured width, never from
 * pinned pixel values, so it holds at any width. Below a threshold the tick
 * density drops and the marker radius shrinks rather than the whole drawing
 * being scaled down, which would take the type with it.
 *
 * Colour comes from the seven-value categorical token palette. That palette has
 * seven entries, so at most seven dimensions are drawn; if a metric has more,
 * the ones not drawn are named rather than silently dropped.
 */

// The categorical palette from the token set, used here for series identity.
// Cycling it would give two dimensions the same colour and make the chart
// ambiguous, so the number of drawn series is capped at its length instead.
const SERIES_COLORS = [v.avatar3, v.avatar1, v.avatar2, v.avatar4, v.avatar5, v.avatar6, v.avatar0];

const MAX_SERIES = SERIES_COLORS.length;

/** Tracks a container's width so the drawing is sized by its container, not by a constant. */
function useMeasuredWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }
    // ResizeObserver is the only thing that sees a container change that did not
    // come from a window resize, such as the navigation rail collapsing.
    if (typeof ResizeObserver === 'undefined') {
      setWidth(node.getBoundingClientRect().width);
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect?.width ?? 0;
      setWidth(measured);
    });
    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

export function TimeseriesChart({
  points,
  metric,
  granularity,
  fromMs,
  toMs,
}: {
  points: StatPointResponse[];
  metric: Metric;
  granularity: Granularity;
  fromMs: number;
  toMs: number;
}) {
  const [ref, width] = useMeasuredWidth();

  const model = useMemo(() => {
    const all = groupByDimension(points);
    const ranked = [...all].sort(
      (a, b) =>
        Math.max(0, ...b.points.map((p) => p.value)) - Math.max(0, ...a.points.map((p) => p.value))
    );
    const shown = ranked.slice(0, MAX_SERIES);
    const omitted = ranked.slice(MAX_SERIES).map((s) => s.dimension);

    const maxValue = Math.max(0, ...shown.flatMap((s) => s.points.map((p) => p.value)));
    const axis = valueAxis(maxValue);

    // Gaps are computed from the union of every bucket the response carried, so
    // one band marks an interval in which the collection pass wrote nothing at
    // all, rather than one band per dimension over the same interval.
    const bucketTimes = [...new Set(all.flatMap((s) => s.points.map((p) => p.t)))].sort(
      (a, b) => a - b
    );
    const gaps: Gap[] = [];
    for (let i = 1; i < bucketTimes.length; i += 1) {
      const missing = missingBucketCount(bucketTimes[i - 1], bucketTimes[i], granularity.stepMs);
      if (missing > 0) {
        gaps.push({ fromMs: bucketTimes[i - 1], toMs: bucketTimes[i], missing });
      }
    }

    return { series: shown, omitted, axis, gaps };
  }, [points, granularity.stepMs]);

  const narrow = width > 0 && width < 520;
  // Height follows the container within bounds rather than being fixed, so the
  // chart keeps a workable shape from a phone to a wide desktop.
  const height = Math.round(Math.max(200, Math.min(340, width * 0.42)));

  // The left inset is sized to the widest value label actually rendered rather
  // than guessed, so a five-digit count is not clipped and a single digit does
  // not leave a channel of dead space.
  const longestTick = model.axis.ticks.reduce(
    (longest, tick) => Math.max(longest, String(tick).length),
    1
  );
  const pad = {
    left: 14 + longestTick * (narrow ? 6 : 7),
    right: narrow ? 10 : 16,
    top: 14,
    bottom: 34,
  };

  const plotWidth = Math.max(0, width - pad.left - pad.right);
  const plotHeight = Math.max(0, height - pad.top - pad.bottom);

  const span = Math.max(1, toMs - fromMs);
  const x = (t: number) => pad.left + ((t - fromMs) / span) * plotWidth;
  const y = (value: number) => pad.top + plotHeight - (value / model.axis.max) * plotHeight;

  const timeTicks = useMemo(() => {
    const count = Math.max(2, Math.floor(plotWidth / (narrow ? 78 : 104)));
    return Array.from({ length: count + 1 }, (_, i) => fromMs + (span * i) / count);
  }, [plotWidth, narrow, fromMs, span]);

  const zone = localZone();
  const description = `${metric.label} from ${formatFullTime(fromMs)} to ${formatFullTime(
    toMs
  )}, ${granularity.label}, in ${zone}. ${model.series.length} series, ${
    model.gaps.length
  } interval${model.gaps.length === 1 ? '' : 's'} not collected.`;

  const markerRadius = narrow ? 1.8 : 2.4;
  const showMarkers = points.length <= 240;

  return (
    <div ref={ref} style={{ width: '100%' }}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={description}
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            {/* A gap is drawn as a hatched band rather than left blank, so an
                interval that was never collected reads as a stated absence and
                not as an accident of layout. */}
            <pattern
              id="lx-stats-gap"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="6" stroke={v.border} strokeWidth="1.5" />
            </pattern>
          </defs>

          {model.axis.ticks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={pad.left}
                x2={pad.left + plotWidth}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? v.borderStrong : v.borderSubtle}
                strokeWidth="1"
              />
              <text
                x={pad.left - 6}
                y={y(tick) + 3.5}
                textAnchor="end"
                fill={v.ink2}
                style={{ fontFamily: v.fontMono, fontSize: narrow ? 9 : 10 }}
              >
                {tick}
              </text>
            </g>
          ))}

          {model.gaps.map((gap) => {
            const left = x(gap.fromMs);
            const right = x(gap.toMs);
            return (
              <g key={`gap-${gap.fromMs}`}>
                <rect
                  x={left}
                  y={pad.top}
                  width={Math.max(0, right - left)}
                  height={plotHeight}
                  fill="url(#lx-stats-gap)"
                  opacity="0.5"
                />
                <title>
                  {`not collected: ${gap.missing} bucket${
                    gap.missing === 1 ? '' : 's'
                  } between ${formatFullTime(gap.fromMs)} and ${formatFullTime(gap.toMs)}`}
                </title>
              </g>
            );
          })}

          {timeTicks.map((tick, index) => (
            <text
              key={`x-${tick}`}
              x={x(tick)}
              y={pad.top + plotHeight + 16}
              textAnchor={index === 0 ? 'start' : index === timeTicks.length - 1 ? 'end' : 'middle'}
              fill={v.ink2}
              style={{ fontFamily: v.fontMono, fontSize: narrow ? 9 : 10 }}
            >
              {formatAxisTime(tick, granularity.key)}
            </text>
          ))}

          {model.series.map((series, index) => {
            const color = SERIES_COLORS[index % SERIES_COLORS.length];
            const segments = toSegments(series.points, granularity.stepMs);
            return (
              <g key={series.dimension || '__scalar__'}>
                {segments.map((segment) => (
                  <polyline
                    key={`seg-${segment[0].t}`}
                    points={segment.map((p) => `${x(p.t)},${y(p.value)}`).join(' ')}
                    fill="none"
                    stroke={color}
                    strokeWidth={narrow ? 1.5 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {showMarkers
                  ? series.points.map((p) => (
                      <circle
                        key={`pt-${p.t}`}
                        cx={x(p.t)}
                        cy={y(p.value)}
                        r={markerRadius}
                        fill={color}
                      >
                        <title>
                          {`${dimensionLabel(series.dimension, metric)}: ${p.value} ${
                            metric.unit
                          } at ${formatFullTime(p.t)}`}
                        </title>
                      </circle>
                    ))
                  : null}
              </g>
            );
          })}

          <text
            x={pad.left}
            y={pad.top - 4}
            fill={v.ink2}
            style={{ fontFamily: v.fontMono, fontSize: narrow ? 9 : 10 }}
          >
            {metric.unit}
          </text>
          <text
            x={pad.left + plotWidth}
            y={height - 4}
            textAnchor="end"
            fill={v.ink2}
            style={{ fontFamily: v.fontMono, fontSize: narrow ? 9 : 10 }}
          >
            {`time — ${granularity.label} — ${zone}`}
          </text>
        </svg>
      ) : null}

      <ChartLegend
        series={model.series}
        metric={metric}
        omitted={model.omitted}
        gaps={model.gaps}
        granularity={granularity}
      />
    </div>
  );
}

function ChartLegend({
  series,
  metric,
  omitted,
  gaps,
  granularity,
}: {
  series: ReturnType<typeof groupByDimension>;
  metric: Metric;
  omitted: string[];
  gaps: Gap[];
  granularity: Granularity;
}) {
  const showKeys = series.length > 1 || series[0]?.dimension !== '';
  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {showKeys ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
          {series.map((entry, index) => (
            <span
              key={entry.dimension || '__scalar__'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: v.fontBody,
                fontSize: 12,
                color: v.ink2,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 2,
                  borderRadius: 2,
                  background: SERIES_COLORS[index % SERIES_COLORS.length],
                }}
              />
              {dimensionLabel(entry.dimension, metric)}
            </span>
          ))}
        </div>
      ) : null}

      {gaps.length > 0 ? (
        <p style={{ margin: 0, fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
          the hatched {gaps.length === 1 ? 'band marks an interval' : 'bands mark intervals'} in
          which no bucket was collected — {gaps.reduce((total, gap) => total + gap.missing, 0)}{' '}
          missing {granularity.key === 'day' ? 'day' : 'half-hour'} bucket
          {gaps.reduce((total, gap) => total + gap.missing, 0) === 1 ? '' : 's'} in all. the line is
          broken across {gaps.length === 1 ? 'it' : 'them'} rather than joined, because nothing was
          measured there.
        </p>
      ) : null}

      {omitted.length > 0 ? (
        <p style={{ margin: 0, fontFamily: v.fontBody, fontSize: 12, color: v.ink2 }}>
          {omitted.length} further {omitted.length === 1 ? 'breakdown is' : 'breakdowns are'}{' '}
          present in the data and not drawn, because the chart has {MAX_SERIES} distinguishable
          colours: {omitted.join(', ')}.
        </p>
      ) : null}
    </div>
  );
}
