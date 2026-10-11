import { useEffect, useState } from 'react';

/**
 * Tracks a rate-limit cooldown window derived from a 429's `Retry-After`.
 *
 * On a 429, a caller reads `Retry-After`, calls `start(seconds)`, and gates
 * further requests on `cooling` until the window elapses. Never retries on a
 * fixed timer of its own: the caller decides when to try again, this hook
 * only reports whether it is too soon.
 *
 * Duplicated from `src/features/admin/hooks/useRateLimitCooldown.js`
 * (identical behavior) rather than imported across features, because the
 * project forbids cross-feature imports and shared logic must be extracted
 * to a shared layer before being consumed from more than one feature. This
 * lives in `src/hooks/` as that shared layer for the luvax and search
 * features; admin's copy is left untouched.
 */
export function useRateLimitCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (until <= Date.now()) {
      return undefined;
    }
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [until]);

  const cooling = until > now;

  return {
    cooling,
    remaining: cooling ? Math.ceil((until - now) / 1000) : 0,
    /**
     * Starts the cooldown from a `Retry-After` value. Falls back to 60
     * seconds when the header is missing or unreadable, matching the
     * dev-profile recommendation rate limit window (200 requests / 60s).
     */
    start: (seconds: unknown) => {
      const secs =
        typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
      setNow(Date.now());
      setUntil(Date.now() + secs * 1000);
    },
  };
}
