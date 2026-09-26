import { v } from '@/config/tokens';

/**
 * Renders an ISO-8601 UTC instant in the viewer's local timezone, labelled as
 * local. A reviewer reading a report or an audit trail needs to know whether a
 * time was their morning or someone else's, so the zone is shown rather than
 * assumed. The full instant is available on hover for precision.
 */
const localZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  } catch {
    return 'local';
  }
};

export function LocalTime({ value, showZone = true }) {
  if (!value) {
    return <span style={{ color: v.ink2 }}>-</span>;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return <span style={{ color: v.ink2 }}>-</span>;
  }
  const label = date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <span title={`${value} (UTC)`} style={{ fontFamily: v.fontBody, color: v.ink2 }}>
      {label}
      {showZone ? (
        <>
          {/*
            A real separator in the text, not just a margin. With the zone
            abutting the time, the text content read "12:23 AMAsia/Saigon" -
            wrong for anything that copies it, and a screen reader announced
            "AMAsia slash Saigon". The styling made it look separated while the
            string never was. This component is the panel's shared timestamp, so
            the same run appeared on every timestamped screen.
          */}
          <span aria-hidden="true"> · </span>
          <span style={{ color: v.ink2, fontSize: '0.85em' }}>{localZone()}</span>
        </>
      ) : null}
    </span>
  );
}
