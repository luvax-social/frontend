import type { SavedPostResponse, PostResponse } from '@/types/domain';
const unwrapSavedPost = (row: SavedPostResponse | PostResponse): PostResponse =>
  'post' in row ? row.post : row;
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

import { v } from '@/config/tokens';
import { mediaAltLabel } from '@/utils/mediaAlt';
import { routeTo } from '@/config/constants';
import { extractPageContent } from '@/utils/helpers';
import { LxIcon } from './primitives';
import { useSavePost, useSavedPosts } from '../hooks/usePosts';
import { useOverlayNavigate } from '../hooks/useOverlayNavigate';
import { useDrainEmptyPages } from '../hooks/useDrainEmptyPages';
import { useViewport } from '../hooks/useViewport';

/**
 * The viewer's saved posts.
 *
 * The design export does not define this screen. The grid treatment is derived
 * from the profile grid so a saved post looks the same here as it does where it
 * was saved from, including the caption tile a post with no media falls back to.
 */
export function SavedPostsScreen() {
  const openOverlay = useOverlayNavigate();
  const viewport = useViewport();
  const cols = viewport === 'desktop' ? 3 : 2;

  const { ref, inView } = useInView();
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSavedPosts();
  const saveMutation = useSavePost();

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Rows are SavedPostResponse: the post nests under `post` and the row adds
  // `savedAt`. This differs from the feed and from search, which both return the
  // post at the top level of the item.
  const posts = (data?.pages?.flatMap((page) => extractPageContent(page)) || [])
    .map(unwrapSavedPost)
    .filter(Boolean);

  // A save record outlives the post behind it, so a page can arrive empty
  // while later pages still hold rows. Without this the screen claimed the
  // viewer had saved nothing and stopped paging for good, because the
  // sentinel below renders only once there is at least one row to show.
  const { isDraining } = useDrainEmptyPages({
    rowCount: posts.length,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    enabled: !isError,
  });

  const header = (
    <div
      style={{
        padding: 16,
        borderBottom: `1px solid ${v.border}`,
        background: v.surface,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ fontFamily: v.fontBody, fontSize: 16, fontWeight: 600, color: v.ink }}>
        saved
      </div>
    </div>
  );

  const notice = (icon: string, title: string, detail?: string, tone?: string) => (
    <div
      style={{
        padding: '48px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
      }}
    >
      <LxIcon name={icon} size={36} color={tone === 'error' ? v.error : v.ink3} />
      <div
        style={{
          fontFamily: v.fontBody,
          fontSize: 14,
          color: tone === 'error' ? v.error : v.ink2,
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        {title}
      </div>
      {detail && (
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 12,
            color: v.ink3,
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );

  let body;
  if (isLoading || isDraining) {
    body = notice('bookmark', 'loading your saved posts...');
  } else if (isError) {
    body = notice(
      'alert',
      "we couldn't load your saved posts.",
      'check your connection and try again.',
      'error'
    );
  } else if (posts.length === 0) {
    body = notice('bookmark', 'nothing saved yet.', 'tap the bookmark on a post to keep it here.');
  } else {
    body = (
      <>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 2,
            padding: '2px 0 0',
          }}
        >
          {posts.map((post) => {
            const mediaUrl = post.media && post.media.length > 0 ? post.media[0].cdnUrl : null;
            return (
              <div
                key={post.id}
                onClick={() => openOverlay(routeTo.postDetail(post.id))}
                role={mediaUrl ? 'img' : undefined}
                aria-label={
                  mediaUrl
                    ? mediaAltLabel(post.media[0], 0, post.media.length, post.author)
                    : undefined
                }
                style={{
                  background: mediaUrl
                    ? `url(${mediaUrl}) center/cover no-repeat`
                    : 'color-mix(in srgb, var(--lx-surface-raised) 82%, #d8d1c4 18%)',
                  aspectRatio: '1/1',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 10,
                  boxSizing: 'border-box',
                  position: 'relative',
                }}
              >
                {!mediaUrl && post.caption && (
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: v.fontBody,
                      color: v.ink3,
                      textAlign: 'center',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {post.caption}
                  </span>
                )}

                {/* Unsaving is offered here rather than only inside the post,
                    because this is the screen the row belongs to and removing
                    it is the action a viewer comes here to take. */}
                <button
                  aria-label={`remove ${post.caption ? 'this post' : 'post'} from saved`}
                  disabled={saveMutation.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    saveMutation.mutate({ postId: post.id, saved: true });
                  }}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'color-mix(in srgb, var(--lx-surface) 78%, transparent)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <LxIcon name="bookmark" size={14} color={v.ink} filled />
                </button>
              </div>
            );
          })}
        </div>
        <div
          ref={ref}
          style={{ height: 20, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          {isFetchingNextPage && (
            <span style={{ color: v.ink3, fontSize: 12, fontFamily: v.fontBody }}>
              loading more...
            </span>
          )}
        </div>
      </>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: v.base }}>
      {header}
      <div style={{ flex: 1, overflowY: 'auto' }}>{body}</div>
    </div>
  );
}
