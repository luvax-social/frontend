import { Link } from 'react-router-dom';

import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import { LxVerifiedBadge } from '@/components/ui/lx-verified-badge';

import { LxIcon } from '../primitives';
import { FeedInjectedCard } from './FeedInjectedCard';

const TILE_W = 124;

/**
 * Suggested accounts, embedded between posts, each showing its banner as well as its avatar.
 *
 * This is the second horizontal scroller in the feed, alongside the story card, which is a cost the
 * design accepted knowingly. What keeps the two from being confused is silhouette, not gesture:
 * story tiles are dark, portrait and 80x120; these are light, near-square, 124 wide, and carry a
 * banner strip with the avatar straddling its lower edge.
 *
 * @param {Array<Object>} rows - Rows from `useSuggestions`, already adapted by `toRow`.
 * @param {Function} onFollow - Follows one account, by id.
 * @param {Function} onDismissUser - Stops one account being suggested, by id; server-side.
 * @param {Function} onDismiss - Removes the whole card for this session; client-side only.
 * @param {string} [viewport] - `mobile` tightens the horizontal padding.
 */
export function FeedPeopleCard({
  rows = [],
  onFollow,
  onDismissUser,
  onDismiss,
  viewport = 'desktop',
}) {
  const isMobile = viewport === 'mobile';

  if (rows.length === 0) return null;

  return (
    <FeedInjectedCard
      eyebrow="people you may know"
      onDismiss={onDismiss}
      dismissLabel="Dismiss account suggestions"
    >
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: isMobile ? '0 12px 14px' : '0 16px 16px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
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
                width: TILE_W,
                flexShrink: 0,
                background: v.base,
                border: `1px solid ${v.border}`,
                borderRadius: 10,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* The fallback is the common case, not the edge case: bannerUrl is nullable and most
                  accounts never set one. A flat accent-dim wash rather than a grey box, which reads
                  as broken, and rather than a gradient, which DESIGN.md forbids. */}
              <div
                data-testid={`banner-${row.id}`}
                data-fallback={row.bannerUrl ? 'false' : 'true'}
                style={{
                  height: 46,
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
                  right: 5,
                  top: 5,
                  width: 20,
                  height: 20,
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
                <LxIcon name="close" size={11} color={v.white} />
              </button>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 25,
                  transform: 'translateX(-50%)',
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  border: `3px solid ${v.base}`,
                  boxSizing: 'border-box',
                  background: row.avatarUrl
                    ? `url(${row.avatarUrl}) center/cover no-repeat`
                    : v.surfaceSunken,
                }}
              />
              <div style={{ padding: '26px 8px 11px', textAlign: 'center' }}>
                <Link
                  to={routeTo.userProfile(row.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    fontFamily: v.fontBody,
                    fontSize: 12,
                    fontWeight: 600,
                    color: v.ink,
                    textDecoration: 'none',
                    minWidth: 0,
                  }}
                >
                  {/* The name truncates and the badge does not. A badge pushed off the end by a long
                      display name would silently drop the one fact it exists to carry. */}
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
                    size={11}
                  />
                </Link>
                <div
                  style={{
                    fontFamily: v.fontBody,
                    fontSize: 10,
                    color: v.ink2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  @{row.username}
                </div>
                {row.reason ? (
                  <div
                    data-testid={`reason-${row.id}`}
                    style={{
                      fontFamily: v.fontMono,
                      fontSize: 8,
                      letterSpacing: '0.04em',
                      color: v.accentText,
                      marginTop: 6,
                      lineHeight: 1.3,
                      height: 21,
                      overflow: 'hidden',
                    }}
                  >
                    {row.reason}
                  </div>
                ) : (
                  // Reserved, not collapsed: a row with no recorded reason must not make its tile
                  // shorter than its neighbours in the same scroller.
                  <div style={{ marginTop: 6, height: 21 }} aria-hidden="true" />
                )}
                <button
                  type="button"
                  disabled={settled}
                  onClick={() => onFollow?.(row.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 8,
                    padding: '6px 0',
                    borderRadius: 999,
                    border: 'none',
                    background: v.accent,
                    color: v.ink,
                    fontFamily: v.fontBody,
                    fontSize: 11,
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
