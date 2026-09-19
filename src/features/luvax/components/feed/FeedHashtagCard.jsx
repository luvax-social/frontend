import { Link } from 'react-router-dom';

import { v } from '@/config/tokens';
import { ROUTES, routeTo } from '@/config/constants';
import { formatPostCount } from '@/utils/helpers';

import { LxIcon } from '../primitives';
import { FeedInjectedCard } from './FeedInjectedCard';

/**
 * Trending hashtags, embedded between posts, three per card with one post cover each.
 *
 * A static row list rather than a scroller, deliberately. The feed already carries two horizontal
 * scrollers and a third would make the gesture meaningless; this is the card whose silhouette is a
 * list.
 *
 * The thumbnail says what a tag looks like, not what any individual post in it is. It was 44px and
 * read as an icon beside the name rather than as a picture; at 58px it carries an image while the
 * type around it stays the size the rest of the feed uses.
 *
 * @param {Array<Object>} rows - Rows from `useTrendingPreviews`.
 * @param {Function} onDismiss - Removes the whole card for this session.
 * @param {string} [viewport] - `mobile` tightens the horizontal padding.
 */
export function FeedHashtagCard({ rows = [], onDismiss, viewport = 'desktop' }) {
  const isMobile = viewport === 'mobile';

  if (rows.length === 0) return null;

  return (
    <FeedInjectedCard
      eyebrow="trending now"
      icon="hash"
      menuLabel="Trending options"
      menuItems={[
        {
          id: 'hide',
          icon: 'eye',
          label: 'Hide trending for now',
          onClick: onDismiss,
        },
      ]}
      viewport={viewport}
      trailing={
        // A pill rather than bare accent text. The word sat among two other pieces of small mono
        // type in the same header and nothing but its colour said it went anywhere.
        <Link
          to={ROUTES.EXPLORE}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 24,
            padding: '0 11px',
            borderRadius: 999,
            background: v.accentDim,
            fontFamily: v.fontMono,
            fontSize: 10,
            letterSpacing: '0.06em',
            color: v.accentText,
            textDecoration: 'none',
          }}
        >
          explore
        </Link>
      }
    >
      {/* The same inset PostCard gives its text rows, so the tag names line up with the caption of
          the post above rather than sitting inside a box of their own. */}
      <div style={{ padding: isMobile ? '0 14px 10px' : '0 4px 10px' }}>
        {rows.map((row) => (
          <div key={row.hashtagId}>
            {/* No divider between rows. The hairlines that used to sit here read as borders the
                post cards do not have, so the rows are separated by their own padding instead. */}
            <Link
              to={routeTo.hashtag(row.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: isMobile ? '11px 0' : '10px 0',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span
                data-testid={`preview-${row.hashtagId}`}
                data-fallback={row.previewUrl ? 'false' : 'true'}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 8,
                  flexShrink: 0,
                  background: row.previewUrl
                    ? `url(${row.previewUrl}) center/cover no-repeat`
                    : v.accentDim,
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: v.fontBody,
                      fontSize: 14,
                      fontWeight: 600,
                      color: v.ink,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    #{row.name}
                  </span>
                  {row.pinned ? (
                    <span
                      title="Pinned by an administrator"
                      style={{ display: 'inline-flex', flexShrink: 0 }}
                    >
                      <LxIcon name="pin" size={11} color={v.accent} />
                    </span>
                  ) : null}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontFamily: v.fontMono,
                    fontSize: 10,
                    color: v.ink2,
                    marginTop: 2,
                  }}
                >
                  {/*
                    Null is not zero. It means this hashtag has no count for the current window, and
                    the backend withholds the lifetime total rather than mixing two different
                    measurements in one column. formatCount renders an en dash for null, which reads
                    as a figure the viewer is not allowed to see, so it is wrong here.
                  */}
                  {typeof row.postCount === 'number' ? formatPostCount(row.postCount) : 'new'}
                </span>
              </span>
            </Link>
          </div>
        ))}
      </div>
    </FeedInjectedCard>
  );
}

export default FeedHashtagCard;
