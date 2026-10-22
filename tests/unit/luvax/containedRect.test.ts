import { describe, expect, it } from 'vitest';

import {
  containedRect,
  imageFractionToPoint,
  pointToImageFraction,
} from '@/features/luvax/utils/containedRect';

describe('containedRect', () => {
  it('fills the frame when the ratio matches', () => {
    expect(containedRect(400, 200, 2)).toEqual({ left: 0, top: 0, width: 400, height: 200 });
  });

  it('letterboxes a wide image above and below', () => {
    expect(containedRect(400, 400, 2)).toEqual({ left: 0, top: 100, width: 400, height: 200 });
  });

  it('pillarboxes a tall image left and right', () => {
    expect(containedRect(400, 400, 0.5)).toEqual({ left: 100, top: 0, width: 200, height: 400 });
  });

  it('takes the image to fill the frame when the ratio is unknown or invalid', () => {
    const full = { left: 0, top: 0, width: 300, height: 200 };

    expect(containedRect(300, 200, null)).toEqual(full);
    expect(containedRect(300, 200, 0)).toEqual(full);
    expect(containedRect(300, 200, Number.NaN)).toEqual(full);
  });

  it('returns an empty rect for an empty frame', () => {
    expect(containedRect(0, 0, 1.5)).toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });
});

describe('image fractions', () => {
  const rect = containedRect(400, 400, 2);

  it('maps a frame point to fractions of the image', () => {
    expect(pointToImageFraction(rect, 200, 200)).toEqual({ x: 0.5, y: 0.5 });
    expect(pointToImageFraction(rect, 0, 100)).toEqual({ x: 0, y: 0 });
    expect(pointToImageFraction(rect, 400, 300)).toEqual({ x: 1, y: 1 });
  });

  it('refuses a point on the letterbox bars', () => {
    expect(pointToImageFraction(rect, 200, 50)).toBeNull();
    expect(pointToImageFraction(rect, 200, 350)).toBeNull();
  });

  it('round-trips a fraction through the frame', () => {
    const point = imageFractionToPoint(rect, 0.25, 0.75);

    expect(point).toEqual({ left: 100, top: 250 });
    expect(pointToImageFraction(rect, point.left, point.top)).toEqual({ x: 0.25, y: 0.75 });
  });

  it('refuses every point of a degenerate rect', () => {
    expect(pointToImageFraction({ left: 0, top: 0, width: 0, height: 0 }, 0, 0)).toBeNull();
  });
});
