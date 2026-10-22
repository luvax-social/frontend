import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';

import { routeTo } from '@/config/constants';
import { v } from '@/config/tokens';
import { getErrorMessage } from '@/utils/errors';

import { LxBtn } from '../primitives';
import { PostGridTile } from '../PostGridTile';
import { toast } from '../Toast';
import { useArchivedPosts, useUnarchivePost } from '../../hooks/useArchivedPosts';
import { useOverlayNavigate } from '../../hooks/useOverlayNavigate';

/**
 * The archived posts tab: a grid of the posts the viewer put away.
 *
 * A tile opens the post. The unarchive button on a tile puts the post back on the profile; the
 * tile leaves the grid at once, and a toast offers to undo it. An archived post is visible to its
 * owner only, so nothing here is shown to anyone else.
 */
export function ArchivePostsTab() {
  const archived = useArchivedPosts();
  const unarchive = useUnarchivePost();
  const openOverlay = useOverlayNavigate();
  const [hovered, setHovered] = useState<string | null>(null);
  const { ref, inView } = useInView({ rootMargin: '200px' });

  useEffect(() => {
    if (inView && archived.hasNextPage && !archived.isFetchingNextPage) archived.fetchNextPage();
  }, [inView, archived]);

  const posts = archived.data?.pages.flatMap((page) => page.data.content) ?? [];

  const putBack = (postId: string) =>
    unarchive.mutate(
      { postId, target: 'published' },
      {
        onSuccess: () =>
          toast('Post unarchived.', {
            action: {
              label: 'undo',
              onClick: () => unarchive.mutate({ postId, target: 'archived' }),
            },
          }),
        onError: (error) => toast(getErrorMessage(error, "We couldn't unarchive that post.")),
      }
    );

  if (archived.isLoading) {
    return (
      <div
        aria-hidden="true"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, paddingTop: 2 }}
      >
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="lx-skeleton" style={{ aspectRatio: '1 / 1' }} />
        ))}
      </div>
    );
  }

  if (archived.isError) {
    return (
      <p role="alert" style={{ padding: 24, fontSize: 14, color: v.errorText }}>
        We couldn&apos;t load your archive. Try again in a moment.
      </p>
    );
  }

  if (posts.length === 0) {
    return (
      <div style={{ padding: '56px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: v.fontDisplay, fontSize: 16, color: v.ink }}>
          nothing archived
        </div>
        <p style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink3, margin: '8px auto 0' }}>
          Archive a post from its menu and it waits here, visible only to you.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        data-testid="archive-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, paddingTop: 2 }}
      >
        {posts.map((post) => (
          <div
            key={post.id}
            data-post-id={post.id}
            onMouseEnter={() => setHovered(post.id)}
            onMouseLeave={() => setHovered((current) => (current === post.id ? null : current))}
            onFocus={() => setHovered(post.id)}
            onBlur={() => setHovered((current) => (current === post.id ? null : current))}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="open archived post"
              onClick={() => openOverlay(routeTo.postDetail(post.id))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openOverlay(routeTo.postDetail(post.id));
                }
              }}
              style={{ cursor: 'pointer', position: 'relative' }}
            >
              <PostGridTile post={post}>
                {hovered === post.id ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(26,24,22,0.35)',
                      borderRadius: 4,
                    }}
                  >
                    <LxBtn
                      size="sm"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        putBack(post.id);
                      }}
                      disabled={unarchive.isPending}
                    >
                      unarchive
                    </LxBtn>
                  </div>
                ) : null}
              </PostGridTile>
            </div>
          </div>
        ))}
      </div>
      {archived.hasNextPage ? (
        <div
          ref={ref}
          style={{ padding: 20, textAlign: 'center', fontFamily: v.fontMono, fontSize: 12 }}
        >
          {archived.isFetchingNextPage ? 'loading more...' : 'scroll for more'}
        </div>
      ) : null}
    </>
  );
}
