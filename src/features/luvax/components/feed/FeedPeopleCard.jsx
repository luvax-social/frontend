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
 * The card holds one page of accounts and never scrolls. The feed places further cards further
 * down, each with the next page, which is what removes the need for any control to move through
 * them: more suggestions are found by reading on rather than by operating a widget.
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

  // One tile per view on mobile, two on larger viewports. Two rather than three so each account
  // gets enough width to read as a card rather than a column. The gap is subtracted so the tiles
  // plus the gaps between them come to exactly the track width and nothing is clipped.
  const perView = isMobile ? 1 : 2;
  const gap = 10;

  // Derived rather than four independent numbers. The banner height, the avatar box and the text
  // inset have to agree or the avatar either overlaps the name or leaves a hole above it, and
  // keeping them as separate literals is how they drifted apart before.
  const bannerH = isMobile ? 84 : 88;
  const avatarSize = isMobile ? 92 : 96;
  const avatarTop = isMobile ? 34 : 38;
  // How far the avatar hangs below the banner, plus a small gap, is exactly where the name starts.
  const textTop = avatarTop + avatarSize - bannerH + 10;
  // Clear of the banner and of the name, level with the space beside the avatar.
  const arrowTop = bannerH + 22;
  const tileWidth = `calc((100% - ${gap * (perView - 1)}px) / ${perView})`;

  if (rows.length === 0) return null;

  return (
    <FeedInjectedCard
      eyebrow="people you may know"
      onDismiss={onDismiss}
      dismissLabel="Dismiss account suggestions"
      viewport={viewport}
    >
      {/* A fixed row, not a scroller. The card shows exactly the accounts it was handed and the
          feed places another card further down for the next ones, so there is nothing to scroll
          and no control needed to do it. */}
      <div
        style={{
          display: 'flex',
          gap,
          // Edge to edge, like post media. The tiles are the content; insetting them drew a
          // second frame inside the one the feed already does not have.
          padding: '0 0 4px',
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
                  height: bannerH,
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
                  top: avatarTop,
                  transform: 'translateX(-50%)',
                  width: avatarSize,
                  height: avatarSize,
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
                  padding: `${textTop}px ${isMobile ? 12 : 14}px 14px`,
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
    </FeedInjectedCard>
  );
}

export default FeedPeopleCard;
