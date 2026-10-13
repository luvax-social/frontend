import { describe, expect, it } from 'vitest';

import { computeMenuPlacement } from '@/components/ui/menuPlacement';

const rect = (left: number, right: number, top = 100, bottom = 124) => ({
  left,
  right,
  top,
  bottom,
});

const viewport = { viewportWidth: 500, viewportHeight: 400, gap: 10 };

describe('computeMenuPlacement', () => {
  it('opens rightward when the menu fits to the right', () => {
    expect(
      computeMenuPlacement({ rect: rect(120, 144), menuWidth: 196, menuHeight: 80, ...viewport })
    ).toEqual({ top: 132, left: 120, vertical: 'bottom', horizontal: 'start' });
  });

  it('opens leftward when the right side lacks room', () => {
    expect(
      computeMenuPlacement({ rect: rect(370, 394), menuWidth: 196, menuHeight: 80, ...viewport })
    ).toEqual({ top: 132, left: 198, vertical: 'bottom', horizontal: 'end' });
  });

  it('clamps into the viewport when neither side fits', () => {
    expect(
      computeMenuPlacement({
        rect: rect(150, 174),
        menuWidth: 270,
        menuHeight: 80,
        viewportWidth: 300,
        viewportHeight: 400,
        gap: 10,
      })
    ).toEqual({ top: 132, left: 10, vertical: 'bottom', horizontal: 'end' });
  });

  it('opens above when the bottom lacks room and the top fits', () => {
    expect(
      computeMenuPlacement({
        rect: rect(120, 144, 280, 304),
        menuWidth: 196,
        menuHeight: 100,
        viewportWidth: 500,
        viewportHeight: 350,
        gap: 10,
      })
    ).toEqual({ top: 172, left: 120, vertical: 'top', horizontal: 'start' });
  });

  it('combines an upward opening with a leftward opening near the bottom-right corner', () => {
    expect(
      computeMenuPlacement({
        rect: rect(440, 464, 280, 304),
        menuWidth: 196,
        menuHeight: 100,
        viewportWidth: 500,
        viewportHeight: 350,
        gap: 10,
      })
    ).toEqual({ top: 172, left: 268, vertical: 'top', horizontal: 'end' });
  });

  it('stays below when there is no room above either', () => {
    expect(
      computeMenuPlacement({
        rect: rect(120, 144, 20, 44),
        menuWidth: 196,
        menuHeight: 400,
        viewportWidth: 500,
        viewportHeight: 300,
        gap: 10,
      })
    ).toMatchObject({ vertical: 'bottom' });
  });

  it('flips only when the zoomed width no longer fits to the right', () => {
    const anchor = rect(200, 230);
    const narrow = {
      rect: anchor,
      menuHeight: 80,
      viewportWidth: 400,
      viewportHeight: 400,
      gap: 10,
    };

    expect(computeMenuPlacement({ ...narrow, menuWidth: 160 }).horizontal).toBe('start');
    expect(computeMenuPlacement({ ...narrow, menuWidth: 160 * 1.25 })).toMatchObject({
      horizontal: 'end',
      left: 30,
    });
  });
});
