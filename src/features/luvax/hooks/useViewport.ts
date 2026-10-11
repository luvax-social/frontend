import { useState, useEffect } from 'react';

// ── Viewport hook ──────────────────────────────────────────────────────────
export function useViewport() {
  const get = () => {
    const w = window.innerWidth;
    if (w >= 1200) return 'desktop';
    if (w >= 768) return 'tablet';
    return 'mobile';
  };
  const [vp, setVp] = useState(get);
  useEffect(() => {
    const handler = () => setVp(get());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return vp;
}

/**
 * The viewport width in device pixels, as state.
 *
 * {@link useViewport} answers a bucket, and a resize inside one bucket sets the same value, which
 * React bails out of re-rendering. A layout decision that depends on the actual width - such as
 * whether the tablet shell can host the right rail - therefore cannot read `window.innerWidth`
 * during render: it would keep whatever width happened to be current when the bucket last changed.
 */
export function useViewportWidth() {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth));
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    handler();
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}
