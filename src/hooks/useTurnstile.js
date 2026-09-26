import { useCallback, useRef, useState } from 'react';

/**
 * Wiring every form that carries a Turnstile challenge needs.
 *
 * Six surfaces mount the widget and each has to do the same four things: hold a
 * ref so the challenge can be re-armed, record whether it drew, record whether
 * it failed to, and re-arm it after a failed submission. Written out per form
 * that is four chances to forget the reset, and a token is single-use - a wrong
 * password followed by a retry would otherwise submit a spent one and be
 * refused for a reason the reader cannot see.
 *
 * @param {(token: string|null) => void} onTokenChange receives the solved token, and null when it expires or is reset
 * @returns {{
 *   widgetProps: object,
 *   unavailable: string,
 *   ready: boolean,
 *   reset: () => void
 * }} `widgetProps` spreads onto `<TurnstileWidget>`; `unavailable` is the
 *   sentence to show instead of a working challenge, empty when there is none;
 *   `ready` is whether the challenge has actually drawn, which gates the "complete
 *   the challenge" hint so it does not appear while there is nothing to complete
 */
export function useTurnstile(onTokenChange) {
  const widgetRef = useRef(null);
  const [unavailable, setUnavailable] = useState('');
  const [ready, setReady] = useState(false);

  const handleReady = useCallback(() => setReady(true), []);

  // Safe before the widget has drawn, so a caller can put it on every error path
  // without first asking whether there is a challenge to reset.
  const reset = useCallback(() => widgetRef.current?.reset(), []);

  return {
    widgetProps: {
      ref: widgetRef,
      onToken: onTokenChange,
      onUnavailable: setUnavailable,
      onReady: handleReady,
    },
    unavailable,
    ready,
    reset,
  };
}

export default useTurnstile;
