import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { v } from '@/config/tokens';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_ID = 'cf-turnstile-script';

// The managed widget draws at a fixed 300x65. The space is reserved before the
// script resolves so the card does not jump when it mounts, but the reservation
// is a max-width rather than a width: at 390px the viewport is narrower than the
// card's padding allows for 300px, and a fixed width there causes a horizontal
// scroll on the one screen a signed-out visitor cannot avoid.
const WIDGET_HEIGHT = 65;
const WIDGET_MAX_WIDTH = 300;

/**
 * Loads the Turnstile script once, on demand.
 *
 * Kept out of the document head so it costs nothing on any route that does not
 * render a challenge, which is most of them. The promise is cached on the
 * module so a remount does not add a second script tag.
 */
let scriptPromise = null;

/**
 * The theme the application is currently showing.
 *
 * Falls back to the operating system preference only when the toggle has not
 * stamped an explicit choice, which matches how the stylesheet resolves it.
 *
 * @returns {'light'|'dark'} the theme to hand the widget
 */
const readTheme = () => {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'dark' || explicit === 'light') {
    return explicit;
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const loadTurnstile = () => {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve(window.turnstile));
    script.addEventListener('error', () => reject(new Error('Turnstile script failed to load')));
    document.head.appendChild(script);
  });
  return scriptPromise;
};

const DEFAULT_UNAVAILABLE_MESSAGE =
  'The challenge is unavailable right now. Reload the page and try again.';

/**
 * The Cloudflare Turnstile challenge, shared by the authentication forms, the
 * report dialog and the public support form.
 *
 * Reads `VITE_TURNSTILE_SITE_KEY`. Carries no copy of its own beyond a neutral
 * fallback: what an unavailable challenge means differs by surface, because the
 * server fails open on the authentication and report paths and fails closed on
 * the public support form, so each caller supplies its own sentence.
 *
 * Exposes `reset()` through a ref. A Turnstile token is single-use, so a form
 * that submits one and is refused - for any reason, not only a refused
 * challenge - must re-solve before trying again, and without this the widget id
 * stayed private and no caller could ask for that.
 *
 * @param {(token: string|null) => void} props.onToken called with the solved token, and with null when it expires or is reset
 * @param {(message: string) => void} [props.onUnavailable] called when the challenge cannot run at all
 * @param {() => void} [props.onReady] called once the challenge has actually drawn
 * @param {string} [props.unavailableMessage] the sentence shown in place of the challenge when it cannot run
 */
export const TurnstileWidget = forwardRef(function TurnstileWidget(
  { onToken, onUnavailable, onReady, unavailableMessage = DEFAULT_UNAVAILABLE_MESSAGE },
  ref
) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  // The render effect deliberately does not depend on the callbacks: re-running
  // it would destroy a challenge the reader has already solved. Holding them in
  // a ref keeps the latest ones reachable anyway, so a caller passing an inline
  // arrow does not get a handler captured at mount.
  const handlersRef = useRef({ onToken, onUnavailable, onReady });
  handlersRef.current = { onToken, onUnavailable, onReady };

  // The application's own theme, not the operating system's. `theme: 'auto'`
  // follows prefers-color-scheme, which is not what this product's theme toggle
  // sets - so with the app switched to dark on a light OS the widget rendered as
  // a near-white block, the brightest object on the only screen an anonymous
  // submitter uses. The toggle writes data-theme on the document element, so
  // that is what the widget is told.
  const [appTheme, setAppTheme] = useState(() => readTheme());

  // Re-read when the toggle changes it. The widget cannot be re-themed in place,
  // so this drives a re-render of the whole widget through the effect's
  // dependency list below.
  useEffect(() => {
    const target = document.documentElement;
    const observer = new MutationObserver(() => setAppTheme(readTheme()));
    observer.observe(target, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Derived rather than set from inside the effect: a missing key is knowable
  // at first render, so making it the initial state avoids a second render
  // pass that only exists to record something already true.
  const [status, setStatus] = useState(siteKey ? 'loading' : 'unavailable');

  useImperativeHandle(
    ref,
    () => ({
      /**
       * Discards the current token and re-arms the challenge.
       *
       * Safe to call when nothing has been drawn: a form can call it on every
       * failed submission without first asking whether there is a widget.
       */
      reset() {
        if (!widgetIdRef.current || !window.turnstile) {
          return;
        }
        window.turnstile.reset(widgetIdRef.current);
        setStatus('ready');
        handlersRef.current.onToken?.(null);
      },
    }),
    []
  );

  useEffect(() => {
    if (!siteKey) {
      handlersRef.current.onUnavailable?.('The challenge is not configured for this environment.');
      return undefined;
    }

    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current || !turnstile) {
          return;
        }
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => {
            setStatus('solved');
            handlersRef.current.onToken?.(token);
          },
          // A token is single-use and short-lived, and clears after roughly 300
          // seconds. Clearing it on expiry stops the form submitting one the
          // server would refuse, which would read as an unexplained failure.
          'expired-callback': () => {
            setStatus('expired');
            handlersRef.current.onToken?.(null);
          },
          'error-callback': () => {
            setStatus('unavailable');
            handlersRef.current.onToken?.(null);
            handlersRef.current.onUnavailable?.(
              'The challenge could not be completed. Reload and try again.'
            );
          },
          theme: appTheme,
        });
        setStatus('ready');
        handlersRef.current.onReady?.();
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setStatus('unavailable');
        handlersRef.current.onUnavailable?.(
          'The challenge could not be loaded. Check your connection and reload.'
        );
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, appTheme]);

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Holds the challenge's height from first paint, so the card does not
          shift downward when the script resolves and the frame appears. */}
      <div style={{ minHeight: WIDGET_HEIGHT }}>
        <div ref={containerRef} />
        {status === 'loading' ? (
          <div
            className="lx-skeleton"
            style={{
              height: WIDGET_HEIGHT,
              width: '100%',
              maxWidth: WIDGET_MAX_WIDTH,
              borderRadius: 8,
            }}
          />
        ) : null}
      </div>
      {status === 'expired' ? (
        <div
          role="status"
          style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2, marginTop: 6 }}
        >
          The challenge expired. Complete it again.
        </div>
      ) : null}
      {status === 'unavailable' ? (
        <div
          role="alert"
          style={{
            fontFamily: v.fontBody,
            fontSize: 13,
            color: v.errorText,
            background: v.errorDim,
            border: `1px solid ${v.error}`,
            borderRadius: 8,
            padding: '10px 12px',
            marginTop: 6,
          }}
        >
          {unavailableMessage}
        </div>
      ) : null}
    </div>
  );
});

export default TurnstileWidget;
