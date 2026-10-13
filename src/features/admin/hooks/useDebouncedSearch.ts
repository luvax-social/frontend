import { useEffect, useState } from 'react';

/**
 * Search input discipline shared by the account search and the audit actor
 * picker. Search is a deliberate action, not a request per keystroke: the term
 * that reaches a query is the debounced, trimmed input, and only once it meets
 * the endpoint's minimum length. A blank or whitespace-only input, or one below
 * the minimum, yields an empty term so no request fires — the account search
 * endpoint answers those with 400 and counts them against a 40/min budget.
 *
 * On a rate-limit refusal the caller reports the `Retry-After` seconds through
 * `startCooldown`; the control is then disabled for exactly that long and the
 * term is blanked so nothing fires, and it is never retried automatically. A
 * one-second tick drives the countdown while cooling.
 *
 * @param {{minLength?: number, delay?: number}} options
 */
export function useDebouncedSearch({
  minLength = 2,
  delay = 350,
}: { minLength?: number; delay?: number } = {}) {
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text), delay);
    return () => clearTimeout(timer);
  }, [text, delay]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) {
      return undefined;
    }
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [cooldownUntil]);

  const cooling = cooldownUntil > now;
  const cooldownRemaining = cooling ? Math.ceil((cooldownUntil - now) / 1000) : 0;
  const trimmed = debounced.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < minLength;
  // The term a query may run on: empty while cooling, while below the minimum,
  // or while blank, so a request fires only for a deliberate, valid query.
  const term = !cooling && trimmed.length >= minLength ? trimmed : '';

  const startCooldown = (seconds: number | null | undefined) => {
    const secs =
      typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
    setNow(Date.now());
    setCooldownUntil(Date.now() + secs * 1000);
  };

  const reset = () => {
    setText('');
    setDebounced('');
  };

  return {
    text,
    setText,
    term,
    cooling,
    cooldownRemaining,
    startCooldown,
    tooShort,
    minLength,
    reset,
  };
}
