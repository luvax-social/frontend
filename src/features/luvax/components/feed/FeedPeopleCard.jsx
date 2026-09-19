import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import { formatCount } from '@/utils/helpers';
import { REPORT_TYPES } from '@/services/report.service';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { LxDropdownMenu } from '@/components/ui/lx-dropdown-menu';
import { LxVerifiedBadge } from '@/components/ui/lx-verified-badge';

import { LxIcon } from '../primitives';
import { toast } from '../Toast';
import { ReportModal } from '../ReportModal';
import { useBlock } from '../../hooks/useSocial';
import { FeedInjectedCard } from './FeedInjectedCard';

/**
 * Suggested accounts, embedded between posts.
 *
 * The tile is sized as a fraction of the card rather than in pixels, which is what lets one
 * component serve both form factors: two across on desktop, one across on mobile. A pixel width
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
  const [blockTarget, setBlockTarget] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const block = useBlock();

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
  const tileWidth = `calc((100% - ${gap * (perView - 1)}px) / ${perView})`;

  if (rows.length === 0) return null;

  return (
    <FeedInjectedCard
      eyebrow="people you may know"
      icon="profile"
      menuLabel="Suggestion options"
      menuItems={[
        {
          id: 'hide',
          icon: 'eye',
          label: 'Hide suggestions for now',
          onClick: onDismiss,
        },
      ]}
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
        {rows.map((row) => (
          <AccountTile
            key={row.id ?? row.username}
            row={row}
            isMobile={isMobile}
            geometry={{ tileWidth, bannerH, avatarSize, avatarTop, textTop }}
            onFollow={onFollow}
            onDismissUser={onDismissUser}
            onBlock={setBlockTarget}
            onReport={setReportTarget}
          />
        ))}
      </div>

      <ConfirmModal
        config={
          blockTarget
            ? {
                title: 'block user',
                // The same wording the post card and the profile already use, so one
                // irreversible action reads the same way everywhere.
                message: (
                  <>
                    Are you sure you want to block{' '}
                    <strong>{blockTarget.displayName || blockTarget.username}</strong>? They
                    won&apos;t be able to find your profile, posts or story on Luvax.
                  </>
                ),
                confirmLabel: 'block',
                confirmDisabled: block.isPending,
                onConfirm: () =>
                  block.mutate(blockTarget.id, {
                    // The tile leaves the suggestion list on the next refetch rather than
                    // immediately, so without the toast the action looks as if it did nothing.
                    onSuccess: () => toast(`blocked @${blockTarget.username}`),
                  }),
              }
            : null
        }
        onClose={() => setBlockTarget(null)}
      />
      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
    </FeedInjectedCard>
  );
}

/**
 * One suggested account.
 *
 * Its own component because each tile owns an independent menu: a single open flag on the card
 * would let one tile's button drive another tile's popover.
 *
 * Banner, avatar and name all address the profile. Only the name is reachable by keyboard and
 * announced; the other two are decoration that happens to be clickable, and three tab stops to
 * one destination is noise for anyone not using a pointer.
 */
function AccountTile({ row, isMobile, geometry, onFollow, onDismissUser, onBlock, onReport }) {
  const { tileWidth, bannerH, avatarSize, avatarTop, textTop } = geometry;
  const menuButtonRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const pending = !row.isFollowing && row.isFollowRequested;
  const name = row.displayName || row.username;
  const settled = row.isFollowing || pending;
  const profilePath = routeTo.userProfile(row.id);

  const menuItems = [
    settled
      ? null
      : {
          id: 'follow',
          icon: 'userPlus',
          label: `Follow @${row.username}`,
          onClick: () => onFollow?.(row.id),
        },
    {
      id: 'hide',
      icon: 'close',
      label: 'Do not suggest this account',
      separator: true,
      onClick: () => onDismissUser?.(row.id),
    },
    {
      id: 'block',
      icon: 'ban',
      label: `Block @${row.username}`,
      tone: 'danger',
      onClick: () => onBlock?.(row),
    },
    {
      id: 'report',
      icon: 'flag',
      label: 'Report',
      tone: 'danger',
      onClick: () =>
        onReport?.({
          entityType: REPORT_TYPES.USER,
          entityId: row.id,
          author: name,
          avatarUrl: row.avatarUrl,
        }),
    },
  ];

  return (
    <div
      style={{
        width: tileWidth,
        flexShrink: 0,
        background: v.base,
        // Square on mobile, where the tile spans the full column and a rounded corner would be
        // the only rounded corner in a feed of edge-to-edge media.
        borderRadius: isMobile ? 0 : 10,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* The fallback is the common case, not the edge case: bannerUrl is nullable and most
          accounts never set one. A flat accent-dim wash rather than a grey box, which reads as
          broken, and rather than a gradient, which DESIGN.md forbids. */}
      <Link to={profilePath} aria-hidden="true" tabIndex={-1} style={{ display: 'block' }}>
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
      </Link>
      <button
        ref={menuButtonRef}
        type="button"
        aria-label={`Options for ${name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
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
          zIndex: 3,
        }}
      >
        <LxIcon name="more" size={14} color={v.white} />
      </button>
      <Link
        to={profilePath}
        aria-hidden="true"
        tabIndex={-1}
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
          zIndex: 1,
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
          to={profilePath}
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
          <LxVerifiedBadge verified={row.verified} category={row.verifiedCategory} size={12} />
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
            // 44px on touch so the primary action clears the minimum target size; the pointer
            // build can be tighter because a cursor does not need the slack.
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
      <LxDropdownMenu
        anchorRef={menuButtonRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={menuItems}
        width={220}
      />
    </div>
  );
}

export default FeedPeopleCard;
