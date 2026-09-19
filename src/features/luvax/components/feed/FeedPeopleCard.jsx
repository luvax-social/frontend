import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import { formatCount } from '@/utils/helpers';
import { LxVerifiedBadge } from '@/components/ui/lx-verified-badge';

import { LxIcon } from '../primitives';
import { FeedInjectedCard } from './FeedInjectedCard';

/**
 * Suggested accounts, embedded between posts.
 *
 * The tile is sized as a fraction of the card rather than in pixels, which is what lets one
 * component serve both form factors: three across on desktop, one across on mobile. A pixel width
 * would have needed a breakpoint and would have stopped tracking the feed column when it changed.
 *
 * Scrolling is snap-based so a swipe always lands on a tile rather than between two, and the arrow
 * controls exist because a horizontal list with no affordance reads as a truncated row rather than
 * as something you can move. Both are required on touch as well as pointer: the arrows are the
 * discoverability cue, the swipe is the shortcut.
 *
 * @param {Array<Object>} rows - Rows from `useSuggestions`, already adapted by `toRow`.
 * @param {Function} onFollow - Follows one account, by id.
 * @param {Function} onDismissUser - Stops one account being suggested, by id; server-side.
 * @param {Function} onDismiss - Removes the whole card for this session; client-side only.
 * @param {string} [viewport] - `mobile` switches the tile to one-per-view.
 */
export function FeedPeopleCard({
  rows = [],
  onFollow,
  onDismissUser,
  onDismiss,
  viewport = 'desktop',
}) {
  const isMobile = viewport === 'mobile';
  const scrollerRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // One tile per view on mobile, three on larger viewports. The gap is subtracted so three tiles
  // plus two gaps come to exactly the track width and nothing is clipped at the right edge.
  const perView = isMobile ? 1 : 3;
  const gap = 10;
  const tileWidth = `calc((100% - ${gap * (perView - 1)}px) / ${perView})`;

  const syncEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    // The one-pixel tolerance absorbs sub-pixel rounding from the percentage track width, which
    // otherwise leaves the next arrow enabled on a list already scrolled to its end.
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    syncEdges();
  }, [syncEdges, rows.length]);

  const scrollByPage = (direction) => {
    const el = scrollerRef.current;
    if (!el) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({
      left: direction * (el.clientWidth / perView + gap),
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  };

  if (rows.length === 0) return null;

  const canScroll = rows.length > perView;

  return (
    <FeedInjectedCard
      eyebrow="people you may know"
      onDismiss={onDismiss}
      dismissLabel="Dismiss account suggestions"
      trailing={
        canScroll ? (
          <span style={{ display: 'flex', gap: 2 }}>
            <ScrollArrow direction="prev" disabled={atStart} onClick={() => scrollByPage(-1)} />
            <ScrollArrow direction="next" disabled={atEnd} onClick={() => scrollByPage(1)} />
          </span>
        ) : null
      }
    >
      <div
        ref={scrollerRef}
        onScroll={syncEdges}
        style={{
          display: 'flex',
          gap,
          padding: isMobile ? '0 12px 14px' : '0 16px 16px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          scrollSnapType: 'x mandatory',
          // Keeps a horizontal swipe inside the scroller instead of chaining out to the page,
          // which on mobile otherwise triggers a back-navigation gesture mid-swipe.
          overscrollBehaviorX: 'contain',
        }}
      >
        {rows.map((row) => {
          const pending = !row.isFollowing && row.isFollowRequested;
          const name = row.displayName || row.username;
          const settled = row.isFollowing || pending;
          return (
            <div
              key={row.id ?? row.username}
              style={{
                width: tileWidth,
                flexShrink: 0,
                scrollSnapAlign: 'start',
                background: v.base,
                borderRadius: 10,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* The fallback is the common case, not the edge case: bannerUrl is nullable and
                  most accounts never set one. A flat accent-dim wash rather than a grey box, which
                  reads as broken, and rather than a gradient, which DESIGN.md forbids. */}
              <div
                data-testid={`banner-${row.id}`}
                data-fallback={row.bannerUrl ? 'false' : 'true'}
                style={{
                  height: isMobile ? 72 : 60,
                  background: row.bannerUrl
                    ? `url(${row.bannerUrl}) center/cover no-repeat`
                    : v.accentDim,
                }}
              />
              <button
                type="button"
                aria-label={`Dismiss ${name}`}
                onClick={() => onDismissUser?.(row.id)}
                style={{
                  position: 'absolute',
                  right: 4,
                  top: 4,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: 'none',
                  background: v.black40,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <LxIcon name="close" size={12} color={v.white} />
              </button>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: isMobile ? 44 : 36,
                  transform: 'translateX(-50%)',
                  width: isMobile ? 60 : 52,
                  height: isMobile ? 60 : 52,
                  borderRadius: '50%',
                  border: `3px solid ${v.surface}`,
                  boxSizing: 'border-box',
                  background: row.avatarUrl
                    ? `url(${row.avatarUrl}) center/cover no-repeat`
                    : v.surfaceSunken,
                }}
              />
              <div
                style={{
                  padding: isMobile ? '34px 12px 14px' : '28px 10px 12px',
                  textAlign: 'center',
                }}
              >
                <Link
                  to={routeTo.userProfile(row.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    fontFamily: v.fontBody,
                    fontSize: isMobile ? 14 : 13,
                    fontWeight: 600,
                    color: v.ink,
                    textDecoration: 'none',
                    minWidth: 0,
                  }}
                >
                  {/* The name truncates and the badge does not. A badge pushed off the end by a
                      long display name would silently drop the one fact it exists to carry. */}
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    {name}
                  </span>
                  <LxVerifiedBadge
                    verified={row.verified}
                    category={row.verifiedCategory}
                    size={12}
                  />
                </Link>
                <div
                  style={{
                    fontFamily: v.fontBody,
                    fontSize: isMobile ? 12 : 11,
                    color: v.ink2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 1,
                  }}
                >
                  @{row.username}
                </div>
                <div
                  data-testid={`followers-${row.id}`}
                  style={{
                    fontFamily: v.fontMono,
                    fontSize: isMobile ? 11 : 10,
                    color: v.ink2,
                    marginTop: 5,
                  }}
                >
                  {formatCount(row.followerCount)} followers
                </div>
                <button
                  type="button"
                  disabled={settled}
                  onClick={() => onFollow?.(row.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 10,
                    // 44px on touch so the primary action clears the minimum target size; the
                    // pointer build can be tighter because a cursor does not need the slack.
                    minHeight: isMobile ? 44 : 32,
                    borderRadius: 999,
                    border: 'none',
                    background: v.accent,
                    color: v.ink,
                    fontFamily: v.fontBody,
                    fontSize: isMobile ? 13 : 11.5,
                    fontWeight: 500,
                    cursor: settled ? 'not-allowed' : 'pointer',
                    opacity: settled ? 0.4 : 1,
                  }}
                >
                  {row.isFollowing ? 'following' : pending ? 'pending' : 'follow'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </FeedInjectedCard>
  );
}

/**
 * One scroller arrow.
 *
 * Kept at 32px visually but padded to a 44px hit area through the wrapper's own height, so the
 * control meets the touch minimum without an oversized glyph crowding the card header.
 */
function ScrollArrow({ direction, disabled, onClick }) {
  return (
    <button
      type="button"
      aria-label={direction === 'prev' ? 'Previous suggestions' : 'More suggestions'}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: '50%',
        background: 'none',
        padding: 0,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.25 : 1,
        transition: 'opacity 150ms var(--ease-out)',
      }}
    >
      <LxIcon
        name={direction === 'prev' ? 'chevronLeft' : 'chevronRight'}
        size={16}
        color={v.ink2}
      />
    </button>
  );
}

export default FeedPeopleCard;
