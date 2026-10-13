import { useEffect, useState } from 'react';

/**
 * The rate-limit cooldown that `useDebouncedSearch` applies to a search box,
 * lifted out for controls that are not search boxes.
 *
 * The two tightest budgets in the system are the statistics timeseries and the
 * activity log, at 20 requests a minute in production. Both are driven by a
 * control a reviewer can operate quickly, so both need the same discipline: on a
 * 429, read `Retry-After`, refuse to submit for exactly that long, say why, and
 * never retry on a timer. An automatic retry against a rate limit turns a burst
 * into a longer burst and takes the decision away from the person who can see
 * what is happening.
 *
 * A half-second tick drives the countdown, so the remaining time is visible
 * rather than the control simply being inert.
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
     * Starts the cooldown from a `Retry-After` value. Falls back to 60 seconds
     * when the header is missing or unreadable, which matches the window every
     * one of these limiters is configured with.
     */
    start: (seconds: number | null | undefined) => {
      const secs =
        typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
      setNow(Date.now());
      setUntil(Date.now() + secs * 1000);
    },
  };
}
