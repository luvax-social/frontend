import type { ReactNode, RefObject } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';

export interface DropdownItem {
  id: string;
  label: ReactNode;
  icon?: string;
  readOnly?: boolean;
  separator?: boolean;
  tone?: string;
  onClick?: () => void;
  disabled?: boolean;
}
interface DropdownProps {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose?: () => void;
  items: (DropdownItem | null | undefined | false)[];
  width?: number;
  align?: 'left' | 'right';
  zIndex?: number;
}

export function LxDropdownMenu({
  anchorRef,
  open,
  onClose,
  items,
  width = 196,
  align = 'right',
  zIndex = 1200,
}: DropdownProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' });

  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') {
      return undefined;
    }

    const updatePosition = () => {
      const anchor = anchorRef?.current;
      const menu = menuRef.current;
      if (!anchor || !menu) return;

      // The app scales itself with a root CSS zoom. getBoundingClientRect returns
      // visual (post-zoom) coordinates, but a position:fixed element inside the
      // zoomed subtree has its top/left multiplied by the zoom again, so a raw
      // rect value would land the menu one zoom-factor away from its anchor. All
      // geometry below stays in visual pixels; the final offsets are divided by
      // the zoom so that, once the browser multiplies them back, the menu lands
      // exactly on its anchor. With no zoom the factor is 1 and nothing changes.
      const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      const rect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const menuHeight = menuRect.height || menu.offsetHeight * zoom;
      const menuWidth = width * zoom;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const gap = 10;
      const shouldOpenUp =
        rect.bottom + menuHeight + gap > viewportHeight && rect.top > menuHeight + gap;
      const topVisual = shouldOpenUp
        ? Math.max(gap, rect.top - menuHeight - 8)
        : Math.min(viewportHeight - menuHeight - gap, rect.bottom + 8);
      const preferredLeft = align === 'right' ? rect.right - menuWidth : rect.left;
      const leftVisual = Math.min(Math.max(gap, preferredLeft), viewportWidth - menuWidth - gap);

      setPosition({
        top: topVisual / zoom,
        left: leftVisual / zoom,
        placement: shouldOpenUp ? 'top' : 'bottom',
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, anchorRef, open, width]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const anchor = anchorRef?.current;
      const menu = menuRef.current;
      if (
        !(event.target instanceof Node) ||
        !menu ||
        menu.contains(event.target) ||
        anchor?.contains(event.target)
      ) {
        return;
      }
      onClose?.();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [anchorRef, onClose, open]);

  if (!open) return null;

  const menu = (
    <div
      ref={menuRef}
      className={`lx-popover-menu ${position.placement === 'top' ? 'is-up' : 'is-down'}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width,
        zIndex,
      }}
    >
      {items
        .filter((item): item is DropdownItem => Boolean(item))
        .map((item) =>
          // A readOnly row states a fact the viewer cannot act on. It is not a
          // disabled control: disabling implies the action becomes available
          // later, and these states do not reverse.
          item.readOnly ? (
            <div
              key={item.id}
              className={`lx-popover-item is-readonly ${item.separator ? 'has-separator' : ''}`}
              style={{ cursor: 'default', color: v.ink3 }}
            >
              {item.icon ? <LxIcon name={item.icon} size={16} color={v.ink3} /> : null}
              <span>{item.label}</span>
            </div>
          ) : (
            <button
              key={item.id}
              type="button"
              className={`lx-popover-item ${item.tone === 'danger' ? 'is-danger' : ''} ${item.separator ? 'has-separator' : ''}`}
              onClick={() => {
                item.onClick?.();
                onClose?.();
              }}
              disabled={item.disabled}
            >
              {item.icon ? (
                <LxIcon
                  name={item.icon}
                  size={16}
                  color={item.tone === 'danger' ? v.error : v.ink2}
                />
              ) : null}
              <span>{item.label}</span>
            </button>
          )
        )}
    </div>
  );

  return createPortal(menu, document.body);
}
