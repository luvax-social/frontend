import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import { formatCount } from '@/utils/helpers';
import { LxVerifiedBadge } from '@/components/ui/lx-verified-badge';

import { LxIcon } from '../primitives';
import { FeedInjectedCard } from './FeedInjectedCard';

// Geometry is lifted from PostMedia so the two controls in the column read as one control. The
// fill is not: the post carousel's arrows sit over a photograph, while these sit over a name, so
// they are carried at a lower opacity and lean on the blur behind them to stay legible without
// hiding the text they overlap.
const CONTROL_BG = 'rgba(255,255,255,0.62)';
const CONTROL_FG = '#1c1a17';
const CONTROL_SHADOW = '0 1px 5px rgba(0,0,0,0.3)';

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

  // One tile per view on mobile, two on larger viewports. Two rather than three so each account
  // gets enough width to read as a card rather than a column. The gap is subtracted so the tiles
  // plus the gaps between them come to exactly the track width and nothing is clipped.
  const perView = isMobile ? 1 : 2;
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
      viewport={viewport}
    >
      {/* Relative so the arrows can sit over the track's vertical centre, which is where the post
          carousel puts its own, rather than in the header away from the thing they move. */}
      <div style={{ position: 'relative' }}>
        <div
          ref={scrollerRef}
          onScroll={syncEdges}
          style={{
            display: 'flex',
            gap,
            // Edge to edge, like post media. The tiles are the content; insetting them drew a
            // second frame inside the one the feed already does not have.
            padding: '0 0 4px',
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
                    height: isMobile ? 84 : 88,
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
                    top: isMobile ? 52 : 56,
                    transform: 'translateX(-50%)',
                    width: isMobile ? 66 : 60,
                    height: isMobile ? 66 : 60,
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
                    padding: isMobile ? '38px 12px 14px' : '42px 14px 14px',
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
                      fontSize: isMobile ? 15 : 14,
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
        {canScroll && !atStart ? (
          <ScrollArrow side="left" onClick={() => scrollByPage(-1)} />
        ) : null}
        {canScroll && !atEnd ? <ScrollArrow side="right" onClick={() => scrollByPage(1)} /> : null}
      </div>
    </FeedInjectedCard>
  );
}

/**
 * One scroller arrow, overlaid on the track.
 *
 * Geometry, colours and blur are taken from the post carousel's own arrows rather than invented,
 * so the two controls in the same column read as the same control. Hidden rather than disabled at
 * each end, which is what the carousel does: a dead button is a target that does nothing.
 */
function ScrollArrow({ side, onClick }) {
  return (
    <button
      type="button"
      aria-label={side === 'left' ? 'Previous suggestions' : 'More suggestions'}
      onClick={onClick}
      style={{
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
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        zIndex: 3,
      }}
    >
      <LxIcon
        name={side === 'left' ? 'chevronLeft' : 'chevronRight'}
        size={16}
        color={CONTROL_FG}
      />
    </button>
  );
}

export default FeedPeopleCard;
