import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LxDropdownMenu } from '@/components/ui/lx-dropdown-menu';

const originalInnerWidth = window.innerWidth;

function anchorAt(left: number, right: number) {
  const anchor = document.createElement('button');
  anchor.getBoundingClientRect = () =>
    ({ left, right, top: 100, bottom: 130, width: right - left, height: 30 }) as DOMRect;
  document.body.appendChild(anchor);
  return anchor;
}

function renderMenu(anchor: HTMLElement, width: number) {
  render(
    <LxDropdownMenu
      anchorRef={{ current: anchor }}
      open
      onClose={() => {}}
      items={[{ id: 'save', label: 'save', onClick: () => {} }]}
      width={width}
    />
  );
  const menu = document.querySelector<HTMLElement>('.lx-popover-menu');
  if (!menu) throw new Error('the menu did not render');
  return menu;
}

afterEach(() => {
  cleanup();
  document.documentElement.style.zoom = '';
  document.body.replaceChildren();
  Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, configurable: true });
});

describe('LxDropdownMenu placement', () => {
  it('opens at the trigger left edge with the start class when it fits', () => {
    const menu = renderMenu(anchorAt(125, 155), 160);

    expect(menu).toHaveClass('is-start', 'is-down');
    expect(menu).not.toHaveClass('is-end');
    expect(menu.style.left).toBe('125px');
  });

  it('divides visual placement by the root zoom before setting fixed offsets', () => {
    document.documentElement.style.zoom = '1.25';
    const menu = renderMenu(anchorAt(125, 155), 160);

    expect(menu).toHaveClass('is-start');
    expect(menu.style.left).toBe('100px');
    expect(menu.style.top).toBe('110.4px');
  });

  it('flips to the end class when the zoomed width overflows the viewport', () => {
    document.documentElement.style.zoom = '1.25';
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    const menu = renderMenu(anchorAt(200, 230), 160);

    expect(menu).toHaveClass('is-end');
    expect(menu.style.left).toBe('24px');
  });
});
