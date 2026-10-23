/** A rectangle inside a frame, in the frame's own pixels. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where an image of a given aspect ratio sits inside a frame that scales it with `object-fit:
 * contain`.
 *
 * Tags are stored as fractions of the image, not of the frame. A frame that is wider or taller
 * than the image letterboxes it, so a marker has to be placed against the image's own rectangle or
 * it drifts off the person it points at. With no known ratio the image is taken to fill the frame.
 *
 * @param frameWidth the frame width in pixels
 * @param frameHeight the frame height in pixels
 * @param ratio the image width divided by its height, when known
 */
export function containedRect(
  frameWidth: number,
  frameHeight: number,
  ratio: number | null | undefined
): Rect {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return { left: 0, top: 0, width: Math.max(frameWidth, 0), height: Math.max(frameHeight, 0) };
  }
  const frameRatio = frameWidth / frameHeight;
  if (ratio >= frameRatio) {
    const height = frameWidth / ratio;
    return { left: 0, top: (frameHeight - height) / 2, width: frameWidth, height };
  }
  const width = frameHeight * ratio;
  return { left: (frameWidth - width) / 2, top: 0, width, height: frameHeight };
}

/**
 * Converts a point in the frame to fractions of the image, or null when the point lies on the
 * letterbox bars outside the image.
 */
export function pointToImageFraction(
  rect: Rect,
  pointX: number,
  pointY: number
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = (pointX - rect.left) / rect.width;
  const y = (pointY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}

/** Converts fractions of the image to a point in the frame. */
export function imageFractionToPoint(
  rect: Rect,
  x: number,
  y: number
): { left: number; top: number } {
  return { left: rect.left + x * rect.width, top: rect.top + y * rect.height };
}
