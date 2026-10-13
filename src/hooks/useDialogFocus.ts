import { useEffect, useRef, useState } from 'react';

export interface DialogOpener {
  tag: string;
  label: string | null;
  text: string;
  index: number;
  target?: string | null;
}

function matchingOpeners(opener: Omit<DialogOpener, 'index'>) {
  return Array.from(document.getElementsByTagName(opener.tag)).filter((element) =>
    opener.target
      ? element.getAttribute('data-overlay-target') === opener.target
      : element.getAttribute('aria-label') === opener.label &&
        (opener.label !== null || element.textContent === opener.text)
  );
}

/** Records an opener that can be found again when a route remounts its background. */
export function captureDialogOpener(): DialogOpener | undefined {
  const element = document.activeElement;
  if (!(element instanceof HTMLElement) || element === document.body) return undefined;
  const descriptor = {
    tag: element.tagName.toLowerCase(),
    label: element.getAttribute('aria-label'),
    text: element.textContent ?? '',
    target: element.getAttribute('data-overlay-target'),
  };
  return { ...descriptor, index: matchingOpeners(descriptor).indexOf(element) };
}

/** Keeps keyboard focus in the topmost modal and returns it to the opener. */
export function useDialogFocus(isOpen: boolean, onClose: () => void, routeOpener?: DialogOpener) {
  const [dialog, setDialog] = useState<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !dialog) return;
    const opener =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
    const controls = () =>
      Array.from(
        new Set([
          ...Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
            )
          ),
          ...Array.from(
            document.querySelectorAll<HTMLElement>('.lx-popover-menu button:not(:disabled)')
          ),
        ])
      ).filter((element) => element.getClientRects().length > 0);
    const isTopmost = () => {
      const modals = Array.from(
        document.querySelectorAll<HTMLElement>('[aria-modal="true"]')
      ).filter((element) => element.getClientRects().length > 0);
      return modals[modals.length - 1] === dialog;
    };
    (controls()[0] ?? dialog).focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      if (!isTopmost()) return;
      if (event.key === 'Escape') {
        // Dropdowns render in a portal; their own listener dismisses the menu
        // before a subsequent Escape dismisses its parent modal.
        if (document.querySelector('.lx-popover-menu')) return;
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const elements = controls();
        event.preventDefault();
        const index = elements.findIndex((element) => element === document.activeElement);
        const nextIndex =
          index < 0
            ? event.shiftKey
              ? elements.length - 1
              : 0
            : (index + (event.shiftKey ? -1 : 1) + elements.length) % elements.length;
        (elements[nextIndex] ?? dialog).focus();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      // Route overlays replace their background element. Restore after that commit,
      // resolving the equivalent control when the original DOM node has gone.
      window.requestAnimationFrame(() => {
        if (dialog.isConnected && dialog.getClientRects().length > 0) return;
        const target = opener?.isConnected
          ? opener
          : routeOpener
            ? matchingOpeners(routeOpener)[routeOpener.index]
            : null;
        if (target instanceof HTMLElement) {
          target.focus({ preventScroll: true });
        } else {
          // A nested dialog may be opened from a menu item that disappears as
          // the menu closes. Return to the remaining parent modal in that case.
          const parent = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]'))
            .filter((element) => element.getClientRects().length > 0)
            .at(-1);
          const control = parent?.querySelector<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
          );
          (control ?? parent)?.focus({ preventScroll: true });
        }
      });
    };
  }, [isOpen, dialog, routeOpener]);
  return setDialog;
}
