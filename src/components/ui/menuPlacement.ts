export interface TriggerRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface MenuPlacementInput {
  rect: TriggerRect;
  menuWidth: number;
  menuHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gap: number;
}

export interface MenuPlacement {
  top: number;
  left: number;
  vertical: 'top' | 'bottom';
  horizontal: 'start' | 'end';
}

/**
 * Places a menu beside its trigger, opening rightward unless the viewport forces a leftward opening.
 *
 * Every input and output is in visual pixels; the caller divides the result by the root CSS zoom.
 * `horizontal: 'start'` aligns the menu's left edge with the trigger's left edge, `'end'` aligns
 * the right edges, and a menu that fits on neither side is clamped into the viewport.
 */
export function computeMenuPlacement({
  rect,
  menuWidth,
  menuHeight,
  viewportWidth,
  viewportHeight,
  gap,
}: MenuPlacementInput): MenuPlacement {
  const shouldOpenUp =
    rect.bottom + menuHeight + gap > viewportHeight && rect.top > menuHeight + gap;
  const top = shouldOpenUp
    ? Math.max(gap, rect.top - menuHeight - 8)
    : Math.min(viewportHeight - menuHeight - gap, rect.bottom + 8);
  const horizontal = rect.left + menuWidth + gap > viewportWidth ? 'end' : 'start';
  const preferredLeft = horizontal === 'start' ? rect.left : rect.right - menuWidth;
  const left = Math.min(Math.max(gap, preferredLeft), viewportWidth - menuWidth - gap);

  return { top, left, vertical: shouldOpenUp ? 'top' : 'bottom', horizontal };
}
