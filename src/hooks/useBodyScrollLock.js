import { useEffect } from 'react';

/**
 * Locks page scroll while an overlay is open, without losing the scroll position.
 *
 * Setting `overflow: hidden` on `body` alone, while the page is scrolled down, drops the
 * browser's scroll offset to 0 the instant the property applies - `body` stops being a scroll
 * container, so it has nothing left to remember a scrollTop for. The three call sites that did
 * this directly (a bottom sheet, a follow-list modal, the post-detail overlay) all reproduced the
 * same symptom: the page underneath visibly jumped to its top the moment the overlay opened. This
 * hook pins the body at its current offset with `position: fixed` instead, then restores both the
 * scroll position and the removed styles on close - the standard pattern for a scroll lock that
 * must not disturb what was already scrolled to.
 *
 * A route overlay (the post-detail screen) swaps its background screen from `<Outlet/>` to a
 * directly-rendered element one React commit before this hook's effect can run, which remounts
 * it; a taller-than-viewport page whose content is briefly gone clamps `window.scrollY` to 0 on
 * that remount, before this effect ever reads it. `restoreScrollY` lets a route overlay capture
 * the true offset earlier - synchronously, at the moment it navigates - and hand it in rather than
 * have this hook read the already-clamped value. A plain modal, which never remounts anything
 * behind it, has no such gap and can omit it.
 *
 * @param {boolean} isOpen whether the overlay is currently showing
 * @param {number} [restoreScrollY] a scroll offset captured before `isOpen` went true, used
 *   instead of reading `window.scrollY` live
 */
export const useBodyScrollLock = (isOpen, restoreScrollY) => {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    const scrollY = typeof restoreScrollY === 'number' ? restoreScrollY : window.scrollY;
    const { position, top, width, overflow } = document.body.style;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.width = width;
      document.body.style.overflow = overflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, restoreScrollY]);
};
