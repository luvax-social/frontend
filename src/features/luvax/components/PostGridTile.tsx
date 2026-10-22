import type { ReactNode } from 'react';

import type { PostResponse } from '@/types/domain';
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';

import { MediaThumb } from './MediaThumb';

/**
 * One square of a post grid: the first media item, or the caption for a post with none.
 *
 * Shared by the archive, the location page and the tagged tab so they draw a post the way the
 * profile grid does. A post with co-authors carries a small badge, because on a grid the reader
 * would otherwise not learn a tile has more than one author.
 */
export function PostGridTile({ post, children }: { post: PostResponse; children?: ReactNode }) {
  const hasMedia = (post.media ?? []).length > 0;
  const coAuthored = (post.collaborators ?? []).some((entry) => entry.status === 'accepted');

  return (
    <div style={{ position: 'relative' }}>
      {hasMedia ? (
        <MediaThumb post={post} radius={4} />
      ) : (
        <div
          style={{
            aspectRatio: '1 / 1',
            background: v.surfaceRaised,
            borderRadius: 4,
            padding: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontFamily: v.fontBody,
              fontSize: 12,
              lineHeight: 1.45,
              color: v.ink2,
              display: '-webkit-box',
              WebkitLineClamp: 5,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {post.caption}
          </div>
        </div>
      )}
      {coAuthored ? (
        <span
          title="Co-authored"
          data-testid="coauthored-badge"
          style={{
            position: 'absolute',
            left: 6,
            top: 6,
            display: 'flex',
            background: 'rgba(26,24,22,0.28)',
            borderRadius: 999,
            padding: '3px 5px',
          }}
        >
          <LxIcon name="users" size={12} color={v.base} />
        </span>
      ) : null}
      {children}
    </div>
  );
}
