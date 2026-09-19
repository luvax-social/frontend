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
 * The 44px thumbnail is a known limitation, accepted in the design: it says what a tag looks like,
 * not what any individual post in it is. If that proves too thin in use, the designed upgrade is
 * two tags with three thumbnails each, not a larger thumbnail here.
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
      onDismiss={onDismiss}
      dismissLabel="Dismiss trending hashtags"
      trailing={
        <Link
          to={ROUTES.EXPLORE}
          style={{
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
      <div style={{ padding: isMobile ? '0 12px 12px' : '0 16px 14px' }}>
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
                  width: 44,
                  height: 44,
                  borderRadius: 7,
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
