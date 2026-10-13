import type { PreviewMedia } from '../types';

interface Props {
  item?: PreviewMedia | null;
  large?: boolean;
  onClick?: () => void;
}
import { useState } from 'react';

import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';
import { isVideoMessageMedia } from '../utils/messageMedia';

// A single-photo bubble is capped to this box rather than forced into a fixed square: the media
// keeps its own shape (a portrait photo stays tall, a landscape one stays wide) instead of being
// cropped to fit, while the cap keeps a very large or very extreme-ratio image from dominating or
// overflowing the thread.
const MAX_BUBBLE_WIDTH = 280;
const MAX_BUBBLE_HEIGHT = 340;
// Ratio is clamped rather than used raw: an unclamped panorama or a very tall screenshot would
// still overflow one of the two caps above by shrinking the other dimension to almost nothing.
const MIN_RATIO = 0.55;
const MAX_RATIO = 1.7;

const formatDuration = (seconds: number | null | undefined) => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null;
  const whole = Math.round(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

function DurationBadge({ seconds }: { seconds?: number | null }) {
  const label = formatDuration(seconds);
  if (!label) return null;
  return (
    <span
      style={{
        position: 'absolute',
        bottom: 6,
        right: 6,
        padding: '1px 5px',
        borderRadius: 5,
        background: 'rgba(0,0,0,0.55)',
        color: '#fff',
        fontFamily: v.fontMono,
        fontSize: 9.5,
      }}
    >
      {label}
    </span>
  );
}

/**
 * A message attachment.
 *
 * Renders the real image or video when the server resolved one (`item.cdnUrl`), as a plain
 * thumbnail with no card chrome around it - a photo message reads as a photo, not a bordered tile
 * framing one. Shared posts and stories carry no direct media of their own here, so those fall
 * back to a labelled placeholder rather than an empty box, and keep the frame since there is no
 * photo underneath it to speak for itself.
 *
 * `large` (a standalone bubble, not an album grid cell) keeps the media's own aspect ratio inside
 * a capped box instead of force-cropping it to a square - a grid cell still crops to a square,
 * which is what makes a grid of mixed-shape photos read as a grid.
 */
export function MediaPlaceholder({ item, large = false, onClick }: Props) {
  const src = item?.cdnUrl || '';
  const [failedSrc, setFailedSrc] = useState('');
  const isVideo = isVideoMessageMedia(item);

  if (src && failedSrc !== src) {
    const ratio =
      large && item?.width && item?.height
        ? Math.max(MIN_RATIO, Math.min(MAX_RATIO, item.width / item.height))
        : null;

    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          width: large ? '100%' : '100%',
          maxWidth: large ? MAX_BUBBLE_WIDTH : '100%',
          maxHeight: large ? MAX_BUBBLE_HEIGHT : undefined,
          aspectRatio: large ? (ratio ?? '4 / 3') : '1 / 1',
          border: 'none',
          background: v.surface,
          overflow: 'hidden',
          cursor: 'pointer',
          padding: 0,
          display: 'block',
          position: 'relative',
        }}
      >
        {isVideo ? (
          <video
            src={src}
            onError={() => setFailedSrc(src)}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: large ? 'contain' : 'cover',
            }}
            muted
            playsInline
          />
        ) : (
          <img
            src={src}
            alt=""
            onError={() => setFailedSrc(src)}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: large ? 'contain' : 'cover',
            }}
          />
        )}
        {isVideo ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.18)',
            }}
          >
            <LxIcon name="play" filled size={large ? 26 : 16} color="#fff" />
          </span>
        ) : null}
        {isVideo ? <DurationBadge seconds={item?.duration} /> : null}
      </button>
    );
  }

  const label = item?.label || 'shared story';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: large ? 138 : 82,
        borderRadius: large ? 14 : 10,
        border: `1px solid ${v.border}`,
        background: v.surface,
        color: v.ink3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <LxIcon name="image" size={large ? 22 : 18} color={v.ink3} />
        {label ? (
          <span style={{ fontFamily: v.fontMono, fontSize: 11, color: v.ink3 }}>{label}</span>
        ) : null}
      </div>
    </button>
  );
}
