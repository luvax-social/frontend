import { useState } from 'react';
import { v } from '@/config/tokens';
import { getMediaList, isVideoMedia } from '@/utils/helpers';
import { LxIcon } from './primitives';

// Same scrim as the carousel, so a badge on a tile and a control on a frame read
// as the same family. 26,24,22 is the design's own card shadow colour.
const SCRIM = 'rgba(26,24,22,0.28)';

function Badge({ icon, label }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: SCRIM,
        borderRadius: 999,
        padding: '3px 6px',
      }}
    >
      <LxIcon name={icon} size={12} color={v.base} />
      {label ? (
        <span style={{ fontFamily: v.fontMono, fontSize: 10, color: v.base }}>{label}</span>
      ) : null}
    </div>
  );
}

/**
 * A single square media tile for the profile grid, the explore grid and search
 * results.
 *
 * A tile is one square, never a carousel: it shows the post's first item and
 * indicates when the post carries more.
 */
export function MediaThumb({ post, radius = 0 }) {
  const [failed, setFailed] = useState(false);
  const items = getMediaList(post);
  const first = items[0] || null;
  const isVideo = first ? isVideoMedia(first) : false;

  const frame = {
    position: 'relative',
    width: '100%',
    aspectRatio: '1/1',
    overflow: 'hidden',
    borderRadius: radius,
    background: v.surfaceSunken,
  };

  // A grid tile is a square crop by definition, and the design crops its tiles
  // too, so cover is correct here. The no-crop rule applies to the feed and
  // detail frames, where the media is the subject rather than a thumbnail.
  const fit = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };

  if (!first || !first.cdnUrl || failed) {
    return (
      <div style={{ ...frame, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LxIcon name={isVideo ? 'video' : 'image'} size={18} color={v.ink3} />
      </div>
    );
  }

  return (
    <div style={frame}>
      {isVideo ? (
        // No poster frame exists and none is being built in this stage. The media
        // fragment asks the browser to seek to the first frame so the tile paints
        // something instead of staying blank, which is what a CSS background did.
        <video
          src={`${first.cdnUrl}#t=0.1`}
          style={fit}
          muted
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          src={first.cdnUrl}
          alt={first.altText || ''}
          loading="lazy"
          decoding="async"
          style={fit}
          onError={() => setFailed(true)}
        />
      )}

      {/* No stacked-layers glyph exists in the icon table, so the count carries
          the meaning of "there are more of these". */}
      {items.length > 1 ? <Badge icon="image" label={String(items.length)} /> : null}
      {items.length === 1 && isVideo ? <Badge icon="video" label={null} /> : null}
    </div>
  );
}
