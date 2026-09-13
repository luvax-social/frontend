import { useParams } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';

import { v } from '@/config/tokens';
import { routeTo } from '@/config/constants';
import { extractPageContent, formatPostCount } from '@/utils/helpers';

import { LxIcon } from './primitives';
import { MediaThumb } from './MediaThumb';
import { useHashtagDetail, useHashtagPosts } from '../hooks/useHashtag';
import { useOverlayNavigate } from '../hooks/useOverlayNavigate';

/**
 * Caption tile for a post that carries no media, matching the profile grid so a hashtag page and a
 * profile page render the same post the same way.
 */
function TextPostTile({ caption }) {
  return (
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
        {caption}
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: '2px 0 0' }}
    >
      {Array.from({ length: 9 }).map((_, index) => (
        <div
          key={index}
          className="lx-skeleton"
          style={{ aspectRatio: '1 / 1', borderRadius: 4 }}
        />
      ))}
    </div>
  );
}

/**
 * The three states below are deliberately distinct surfaces, not one empty state with different
 * copy. "This hashtag is not available" and "this hashtag has no posts yet" are different facts
 * about the world, and a reader who cannot tell them apart cannot tell whether to try a different
 * spelling or simply be the first to post.
 */
function StateBlock({ icon, title, detail }) {
  return (
    <div
      style={{
        padding: '64px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
      }}
    >
      <LxIcon name={icon} size={28} color={v.ink3} />
      <div style={{ fontFamily: v.fontDisplay, fontSize: 16, color: v.ink1 }}>{title}</div>
      {detail ? (
        <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink3, maxWidth: 320 }}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}

export function HashtagScreen() {
  const { name } = useParams();
  const openOverlay = useOverlayNavigate();
  const detail = useHashtagDetail(name);
  const hashtag = detail.data?.data;
  const postsQuery = useHashtagPosts(hashtag?.id);
  const { ref, inView } = useInView({ rootMargin: '200px' });

  useEffect(() => {
    if (inView && postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) {
      postsQuery.fetchNextPage();
    }
  }, [inView, postsQuery]);

  const posts = (postsQuery.data?.pages || []).flatMap((page) => extractPageContent(page));
  const errorCode = detail.error?.response?.data?.code;

  let body;
  if (detail.isLoading) {
    body = <GridSkeleton />;
  } else if (errorCode === 'HASHTAG_UNAVAILABLE') {
    body = (
      <StateBlock
        icon="ban"
        title="this hashtag is not available"
        detail="An administrator removed this hashtag from circulation. Posts that used it are unaffected and still appear everywhere else."
      />
    );
  } else if (detail.isError) {
    body = (
      <StateBlock
        icon="alert"
        title="no such hashtag"
        detail="Nothing on Luvax carries this tag. Check the spelling, or search for something close to it."
      />
    );
  } else if (postsQuery.isLoading) {
    body = <GridSkeleton />;
  } else if (posts.length === 0) {
    body = (
      <StateBlock
        icon="hash"
        title="no posts yet"
        detail="This hashtag exists but nothing has been posted with it. Yours would be the first."
      />
    );
  } else {
    body = (
      <>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 2,
            padding: '2px 0 0',
          }}
        >
          {posts.map((post) => (
            <div
              key={post.id}
              role="button"
              tabIndex={0}
              onClick={() => openOverlay(routeTo.postDetail(post.id))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openOverlay(routeTo.postDetail(post.id));
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              {(post.media || []).length > 0 ? (
                <MediaThumb post={post} radius={4} />
              ) : (
                <TextPostTile caption={post.caption} />
              )}
            </div>
          ))}
        </div>
        {postsQuery.hasNextPage ? (
          <div
            ref={ref}
            style={{
              padding: 20,
              textAlign: 'center',
              fontFamily: v.fontMono,
              fontSize: 12,
              color: v.ink3,
            }}
          >
            {postsQuery.isFetchingNextPage ? 'loading more...' : 'scroll for more'}
          </div>
        ) : null}
      </>
    );
  }

  const headerName = hashtag?.name || name;

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div
        style={{
          padding: '24px 20px 16px',
          borderBottom: `1px solid ${v.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: v.surfaceRaised,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <LxIcon name="hash" size={24} color={v.ink2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: v.fontDisplay,
              fontSize: 20,
              color: v.ink1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              // A long tag has to truncate rather than push the post count off the row.
              overflow: 'hidden',
            }}
          >
            <span
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={`#${headerName}`}
            >
              #{headerName}
            </span>
            {hashtag?.pinned ? (
              <span
                title="Pinned by an administrator"
                style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
              >
                <LxIcon name="pin" size={15} color={v.accent} />
              </span>
            ) : null}
          </h1>
          <div
            style={{ fontFamily: v.fontMono, fontSize: 12, color: v.ink3, marginTop: 4 }}
            data-testid="hashtag-post-count"
          >
            {hashtag ? formatPostCount(hashtag.postCount) : ' '}
          </div>
        </div>
      </div>
      {body}
    </div>
  );
}

export default HashtagScreen;
