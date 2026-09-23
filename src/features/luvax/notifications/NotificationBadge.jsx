import { v } from '@/config/tokens';

/**
 * The unseen-count pill shared by every nav location (mobile app bar, bottom nav, side
 * rail). Replaces the three duplicated dot-only badges: P0 section 16 calls a numeric
 * badge a deliberate, approved change from the plain dot, using the existing error token
 * and body type rather than a new colour.
 * @param {{count: number, capped: boolean}} props
 */
export function NotificationBadge({ count, capped }) {
  if (count === 0) return null;
  const label = capped ? '99+' : String(count);
  return (
    <span
      role="status"
      aria-label={`${label} new notifications`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        borderRadius: 999,
        background: v.error,
        color: v.white,
        fontFamily: v.fontBody,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}
