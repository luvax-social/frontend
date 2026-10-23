import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { PostMediaTagResponse } from '@/types/domain';
import { routeTo } from '@/config/constants';
import { v } from '@/config/tokens';

import { containedRect, imageFractionToPoint, type Rect } from '../utils/containedRect';

const EMPTY_RECT: Rect = { left: 0, top: 0, width: 0, height: 0 };

/**
 * Draws the people tagged on one media item over the picture, with a "tags" control that shows or
 * hides them.
 *
 * A tag is stored as fractions of the image, so each marker is placed against the image's own
 * rectangle inside the frame, which differs from the frame when a carousel item has another shape
 * than the first. An approved tag is shown to everyone who can see the post; a tag still waiting is
 * returned by the server only to the owner and the tagged person, and is labelled "waiting" so
 * neither takes it for a published tag. A marker links to the person's profile.
 *
 * The overlay ignores pointer events everywhere except on the control and the markers, so a click
 * on the photo still reaches the card and a double tap still likes.
 */
export function PostTagOverlay({
  tags,
  ratio,
  active,
}: {
  tags: PostMediaTagResponse[];
  /** The media width divided by its height, when the server knows it. */
  ratio: number | null;
  /** Whether this item is the one on screen; a hidden carousel item draws nothing. */
  active: boolean;
}) {
  const navigate = useNavigate();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<Rect>(EMPTY_RECT);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;
    const measure = () => setRect(containedRect(node.clientWidth, node.clientHeight, ratio));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ratio]);

  if (tags.length === 0) return null;

  return (
    <div
      ref={frameRef}
      aria-hidden={active ? undefined : true}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {shown
        ? tags.map((tag) => {
            const point = imageFractionToPoint(rect, Number(tag.x), Number(tag.y));
            const waiting = tag.status === 'pending';
            return (
              <button
                key={tag.id}
                type="button"
                data-lxtap="1"
                data-tag={tag.user.username ?? undefined}
                data-tag-status={tag.status}
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(routeTo.userProfile(tag.user.id));
                }}
                style={{
                  appearance: 'none',
                  position: 'absolute',
                  left: point.left,
                  top: point.top,
                  transform: 'translate(-50%, -6px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: v.base,
                    border: `2px ${waiting ? 'dashed' : 'solid'} ${v.accent}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: v.fontBody,
                    fontSize: 12,
                    color: v.inkInverse,
                    background: v.black,
                    borderRadius: 999,
                    padding: '2px 9px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tag.user.username}
                  {waiting ? ' - waiting' : ''}
                </span>
              </button>
            );
          })
        : null}
      <button
        type="button"
        data-lxtap="1"
        aria-pressed={shown}
        aria-label={shown ? 'hide tags' : 'show tags'}
        onClick={(event) => {
          event.stopPropagation();
          setShown((current) => !current);
        }}
        style={{
          appearance: 'none',
          position: 'absolute',
          left: 12,
          bottom: 12,
          fontFamily: v.fontBody,
          fontSize: 12,
          color: '#1c1a17',
          background: 'rgba(255,255,255,0.9)',
          border: 'none',
          borderRadius: 999,
          padding: '5px 12px',
          cursor: 'pointer',
          pointerEvents: 'auto',
          boxShadow: '0 1px 5px rgba(0,0,0,0.3)',
        }}
      >
        tags
      </button>
    </div>
  );
}
