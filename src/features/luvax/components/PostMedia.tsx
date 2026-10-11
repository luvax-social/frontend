import type {
  CSSProperties,
  KeyboardEvent,
  TouchEvent,
  MouseEvent,
  MouseEventHandler,
  RefCallback,
} from 'react';
import type { PostMediaSource, RenderableMedia } from '@/types/composer';
import { useEffect, useRef, useState } from 'react';
import { v } from '@/config/tokens';
import { getFrameRatio, getMediaList, isVideoMedia } from '@/utils/helpers';
import { LxIcon } from './primitives';

// Derived, not from the design: the design defines no carousel and no control
// that sits on top of a photograph. 26,24,22 is the design's own card shadow
// colour, reused here as a scrim so quiet controls stay legible on any image.
const SCRIM = 'rgba(26,24,22,0.28)';

// Carousel controls read as light frosted chips with a dark glyph, so they stay
// legible over a dark image where a dark scrim did not, without a heavy fill that
// would compete with the photograph. Fixed hues, not theme tokens, since the
// contrast is against the media, not the app surface.
const CONTROL_BG = 'rgba(255,255,255,0.9)';
const CONTROL_FG = '#1c1a17';
const CONTROL_SHADOW = '0 1px 5px rgba(0,0,0,0.3)';

// Shortest horizontal travel that reads as a deliberate swipe rather than a
// tap that wobbled.
const SWIPE_THRESHOLD = 40;

function MediaFallback({ kind }: { kind: 'video' | 'image' }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: v.surfaceSunken,
      }}
    >
      <LxIcon name={kind === 'video' ? 'video' : 'image'} size={20} color={v.ink3} />
      <span style={{ fontFamily: v.fontMono, fontSize: 10, color: v.ink3 }}>
        {kind === 'video' ? 'video unavailable' : 'image unavailable'}
      </span>
    </div>
  );
}

function MediaItem({
  media,
  active,
  registerVideo,
}: {
  media: RenderableMedia;
  active: boolean;
  registerVideo: RefCallback<HTMLVideoElement>;
}) {
  const [failed, setFailed] = useState(false);
  const isVideo = isVideoMedia(media);

  if (failed) {
    return <MediaFallback kind={isVideo ? 'video' : 'image'} />;
  }

  // contain, not cover: the frame is already the media's own ratio, so contain
  // fills it exactly for a single item and letterboxes only the carousel items
  // that differ from the first. cover would crop them, which is the defect this
  // component exists to remove.
  const fit: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  };

  if (isVideo) {
    return (
      <video
        ref={registerVideo}
        src={media.cdnUrl}
        style={fit}
        controls={active}
        muted
        playsInline
        preload="metadata"
        data-lxtap="1"
        // Remember when the reader unmutes, so scrolling away and back does not
        // silence a video they chose to hear.
        onVolumeChange={(event) => {
          if (!event.currentTarget.muted) event.currentTarget.dataset.userUnmuted = '1';
        }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    // The frame around this already reserves the media's aspect ratio, so
    // deferring the fetch cannot reintroduce the layout shift that box removed.
    <img
      src={media.cdnUrl}
      alt={media.altText || ''}
      style={fit}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Post media frame. Renders a single asset, or a carousel when the post carries
 * more than one, with one item filling the frame at a time.
 *
 * The frame takes its aspect ratio from the first item and keeps it for every
 * item, so moving through a carousel of mixed shapes never resizes the card.
 */
export function PostMedia({
  post,
  radius = 0,
  onOpen = null,
  minAspect = 0.8,
}: {
  post: PostMediaSource;
  radius?: number;
  onOpen?: MouseEventHandler<HTMLDivElement> | null;
  minAspect?: number;
}) {
  const items = getMediaList(post);
  const [index, setIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const touchStartX = useRef<number | null>(null);

  const count = items.length;
  const safeIndex = Math.min(index, Math.max(count - 1, 0));

  // Only the visible item plays. Moving to another item stops the previous one
  // rather than leaving it playing behind the frame.
  useEffect(() => {
    videoRefs.current.forEach((node, i) => {
      if (!node || i === safeIndex) return;
      node.pause();
      node.currentTime = 0;
    });
  }, [safeIndex]);

  // A video plays only while it is on screen. It starts muted and autoplays when
  // the post scrolls into view, and pauses when it leaves, so nothing plays before
  // the reader reaches it and no sound follows a card off screen. Audio stays off
  // until the reader unmutes it with the controls; the muted state the reader sets
  // is not forced back, so scrolling away and back does not re-mute their choice.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (!(video instanceof HTMLVideoElement)) return;
          if (entry.isIntersecting) {
            // Force muted before autoplay so sound never starts on its own, unless
            // the reader has already unmuted this video, whose choice is kept.
            if (video.dataset.userUnmuted !== '1') video.muted = true;
            const attempt = video.play();
            // Autoplay can be refused; a muted video is normally allowed, and if
            // it is not the video simply stays paused for a manual tap.
            if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
          } else if (!video.paused) {
            video.pause();
          }
        });
      },
      { threshold: 0.6 }
    );

    const nodes = videoRefs.current.filter((node): node is HTMLVideoElement => Boolean(node));
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [count]);

  if (count === 0) return null;

  // The frame keeps the media's own ratio, but caps how tall it may get. A wide
  // single-column feed turns a 9:16 portrait into nearly a whole viewport, so the
  // box is clamped to a minimum width-to-height ratio. Taller media is not cropped:
  // object-fit contain letterboxes it against the page, which reads as breathing
  // room on the flat feed rather than a boxed frame. minAspect is width/height, so
  // 0.8 means the box never exceeds 5:4 tall.
  const rawRatio = getFrameRatio(items[0]);
  const ratio = Math.max(rawRatio, minAspect);
  const isCarousel = count > 1;

  const go = (next: number) => {
    if (next < 0 || next > count - 1) return;
    setIndex(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isCarousel) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(safeIndex + 1);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(safeIndex - 1);
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > SWIPE_THRESHOLD) {
      go(delta < 0 ? safeIndex + 1 : safeIndex - 1);
    }
    touchStartX.current = null;
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onOpen) return;
    if (event.target instanceof Element && event.target.closest('[data-lxtap]')) return;
    onOpen(event);
  };

  const arrowStyle = (side: 'left' | 'right'): CSSProperties => ({
    position: 'absolute',
    top: '50%',
    [side]: 8,
    transform: 'translateY(-50%)',
    width: 30,
    height: 30,
    borderRadius: 999,
    border: 'none',
    background: CONTROL_BG,
    boxShadow: CONTROL_SHADOW,
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    zIndex: 2,
  });

  return (
    <div
      role={isCarousel ? 'group' : undefined}
      aria-roledescription={isCarousel ? 'carousel' : undefined}
      aria-label={isCarousel ? `post media, ${count} items` : undefined}
      tabIndex={isCarousel ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: String(ratio),
        overflow: 'hidden',
        background: v.surfaceSunken,
        borderRadius: radius,
        cursor: onOpen ? 'pointer' : 'default',
        outline: 'none',
      }}
    >
      {/* Items sit side by side on a track that slides horizontally to the active
          one, so moving through a carousel reads as a smooth glide, not a snap. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          transform: `translateX(-${safeIndex * 100}%)`,
          transition: 'transform var(--duration-slow) var(--ease-out)',
        }}
      >
        {items.map((media, i) => (
          <div
            key={media.id || i}
            aria-hidden={i !== safeIndex}
            style={{
              position: 'relative',
              flex: '0 0 100%',
              width: '100%',
              height: '100%',
            }}
          >
            <MediaItem
              media={media}
              active={i === safeIndex}
              registerVideo={(node) => {
                videoRefs.current[i] = node;
              }}
            />
          </div>
        ))}
      </div>

      {isCarousel ? (
        <>
          {safeIndex > 0 ? (
            <button
              type="button"
              data-lxtap="1"
              aria-label="previous item"
              onClick={(event) => {
                event.stopPropagation();
                go(safeIndex - 1);
              }}
              style={arrowStyle('left')}
            >
              <LxIcon name="chevronLeft" size={16} color={CONTROL_FG} />
            </button>
          ) : null}

          {safeIndex < count - 1 ? (
            <button
              type="button"
              data-lxtap="1"
              aria-label="next item"
              onClick={(event) => {
                event.stopPropagation();
                go(safeIndex + 1);
              }}
              style={arrowStyle('right')}
            >
              <LxIcon name="chevronRight" size={16} color={CONTROL_FG} />
            </button>
          ) : null}

          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: CONTROL_BG,
              boxShadow: CONTROL_SHADOW,
              borderRadius: 999,
              padding: '3px 7px',
              fontFamily: v.fontMono,
              fontSize: 10,
              color: CONTROL_FG,
              zIndex: 2,
            }}
          >
            {safeIndex + 1}/{count}
          </div>

          {/* An indicator, not a control: the dots report position and count and
              do not accept clicks, so the frame keeps one click meaning. */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 5,
              background: CONTROL_BG,
              boxShadow: CONTROL_SHADOW,
              borderRadius: 999,
              padding: '5px 7px',
              zIndex: 2,
            }}
          >
            {items.map((media, i) => (
              <span
                key={media.id || i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: CONTROL_FG,
                  opacity: i === safeIndex ? 1 : 0.35,
                }}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
