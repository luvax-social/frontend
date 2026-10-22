import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';

import type { ReportTarget } from '@/types/report';
import { routeTo } from '@/config/constants';
import { v } from '@/config/tokens';
import { formatPostCount } from '@/utils/helpers';
import { getApiErrorCode } from '@/utils/errors';

import { LxBtn, LxIcon } from './primitives';
import { PostGridTile } from './PostGridTile';
import { ReportModal } from './ReportModal';
import { usePlace, usePlacePosts } from '../hooks/usePlaces';
import { useOverlayNavigate } from '../hooks/useOverlayNavigate';

function StateBlock({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <div
      data-testid="place-state"
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
      <div style={{ fontFamily: v.fontDisplay, fontSize: 16 }}>{title}</div>
      <div style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink3, maxWidth: 320 }}>
        {detail}
      </div>
    </div>
  );
}

/**
 * The location page: the published posts tagged at one place, newest first.
 *
 * It follows the hashtag page, with two differences. A place name is typed by people, so the header
 * offers a report. And the unavailable state names the three ways a place can be gone (banned,
 * deleted, never existed) with one sentence, because the backend answers all three the same way and
 * a reader cannot do anything different for each.
 */
export function PlaceScreen() {
  const { placeId } = useParams();
  const openOverlay = useOverlayNavigate();
  const detail = usePlace(placeId);
  const place = detail.data?.data;
  const postsQuery = usePlacePosts(place ? placeId : undefined);
  const { ref, inView } = useInView({ rootMargin: '200px' });
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  useEffect(() => {
    if (inView && postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) {
      postsQuery.fetchNextPage();
    }
  }, [inView, postsQuery]);

  const posts = postsQuery.data?.pages.flatMap((page) => page.data.content) ?? [];
  const unavailable =
    detail.isError &&
    ['PLACE_UNAVAILABLE', 'PLACE_NOT_FOUND'].includes(getApiErrorCode(detail.error) ?? '');

  let body;
  if (detail.isLoading || (place && postsQuery.isLoading)) {
    body = (
      <div
        aria-hidden="true"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          padding: '2px 0 0',
        }}
      >
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="lx-skeleton" style={{ aspectRatio: '1 / 1' }} />
        ))}
      </div>
    );
  } else if (unavailable) {
    body = (
      <StateBlock
        icon="ban"
        title="this place is not available"
        detail="The place was removed or never existed. Posts that were tagged there still appear everywhere else."
      />
    );
  } else if (detail.isError) {
    body = (
      <StateBlock
        icon="alert"
        title="we couldn't load this place"
        detail="Try again in a moment."
      />
    );
  } else if (posts.length === 0) {
    body = (
      <StateBlock
        icon="mapPin"
        title="no posts yet"
        detail="Nothing has been posted from this place that you can see."
      />
    );
  } else {
    body = (
      <>
        <div
          data-testid="place-grid"
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
              data-post-id={post.id}
              onClick={() => openOverlay(routeTo.postDetail(post.id))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openOverlay(routeTo.postDetail(post.id));
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <PostGridTile post={post} />
            </div>
          ))}
        </div>
        {postsQuery.hasNextPage ? (
          <div
            ref={ref}
            style={{ padding: 20, textAlign: 'center', fontFamily: v.fontMono, fontSize: 12 }}
          >
            {postsQuery.isFetchingNextPage ? 'loading more...' : 'scroll for more'}
          </div>
        ) : null}
      </>
    );
  }

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
          <LxIcon name="mapPin" size={24} color={v.ink2} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: v.fontDisplay,
              fontSize: 20,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={place?.name}
          >
            {place ? place.name : unavailable ? 'unavailable' : ' '}
          </h1>
          <div
            style={{ fontFamily: v.fontMono, fontSize: 12, color: v.ink3, marginTop: 4 }}
            data-testid="place-post-count"
          >
            {place ? formatPostCount(place.postCount) : ' '}
          </div>
        </div>
        {place ? (
          <LxBtn
            variant="ghost"
            size="sm"
            type="button"
            data-testid="report-place"
            onClick={() =>
              setReportTarget({ entityType: 'place', entityId: place.id, text: place.name })
            }
          >
            report
          </LxBtn>
        ) : null}
      </div>
      {body}
      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}

export default PlaceScreen;
