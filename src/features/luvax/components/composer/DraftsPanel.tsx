import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { PostResponse } from '@/types/domain';
import { v } from '@/config/tokens';
import { LxIcon } from '@/components/ui/lx-icon';
import { getErrorMessage } from '@/utils/errors';

import { LxBtn } from '../primitives';
import {
  useDeleteOwnedPost,
  useMyPostCounts,
  useOwnerPosts,
  useTransitionPost,
  type OwnerListStatus,
} from '../../hooks/useDrafts';
import { formatRelativeTime } from '../../hooks/useRelativeTime';
import { formatScheduleLabel } from '../../utils/scheduleTime';
import { monoHint } from './dialogStyles';

type PanelTab = Exclude<OwnerListStatus, 'archived'>;

const describeContent = (post: PostResponse) => {
  const photos = post.media.filter((item) => item.mediaType === 'image').length;
  const videos = post.media.filter((item) => item.mediaType === 'video').length;
  if (post.postType === 'text' || post.media.length === 0) return 'text';
  const parts = [];
  if (photos > 0) parts.push(`${photos} ${photos === 1 ? 'photo' : 'photos'}`);
  if (videos > 0) parts.push(`${videos} ${videos === 1 ? 'video' : 'videos'}`);
  return parts.join(', ');
};

const titleOf = (post: PostResponse) => {
  const caption = post.caption?.trim();
  if (caption) return caption.length > 70 ? `${caption.slice(0, 70)}...` : caption;
  if (post.postType === 'text') return 'Untitled text post';
  if (post.postType === 'video') return 'Untitled video';
  return 'Untitled post';
};

const editedLabel = (post: PostResponse) => {
  const relative = formatRelativeTime(post.updatedAt);
  return relative === 'now' ? 'edited just now' : `edited ${relative} ago`;
};

function PostRow({
  post,
  tab,
  now,
  onResume,
  onChanged,
}: {
  post: PostResponse;
  tab: PanelTab;
  now: Date;
  onResume: (post: PostResponse) => void;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState('');
  const remove = useDeleteOwnedPost();
  const transition = useTransitionPost();
  const thumb = post.media[0];
  const scheduledAt = post.scheduledAt ? new Date(post.scheduledAt) : null;

  const publishNow = () => {
    setProblem('');
    transition.mutate(
      { postId: post.id, status: 'published' },
      {
        onSuccess: onChanged,
        onError: (error) => setProblem(getErrorMessage(error, "We couldn't publish it.")),
      }
    );
  };

  const returnToDrafts = () => {
    setProblem('');
    transition.mutate(
      { postId: post.id, status: 'draft' },
      { onError: (error) => setProblem(getErrorMessage(error, "We couldn't move it.")) }
    );
  };

  return (
    <li
      data-post-id={post.id}
      style={{ padding: '14px 20px', borderBottom: `1px solid ${v.borderSubtle}` }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            flexShrink: 0,
            borderRadius: 8,
            overflow: 'hidden',
            background: v.accentDim,
          }}
        >
          {thumb && thumb.mediaType === 'image' ? (
            <img
              src={thumb.cdnUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : thumb ? (
            <video
              src={`${thumb.cdnUrl}#t=0.1`}
              muted
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : null}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: v.fontBody,
              fontSize: 14,
              color: v.ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {titleOf(post)}
          </div>
          <div style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink3, marginTop: 2 }}>
            {tab === 'scheduled' && scheduledAt
              ? `${describeContent(post)}, publishes ${formatScheduleLabel(scheduledAt, now)}`
              : `${describeContent(post)}, ${editedLabel(post)}`}
          </div>
        </div>
        {confirming ? null : (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <LxBtn size="sm" type="button" onClick={() => onResume(post)}>
              {tab === 'scheduled' ? 'edit' : 'resume'}
            </LxBtn>
            <button
              type="button"
              aria-label={`delete ${tab === 'scheduled' ? 'scheduled post' : 'draft'}`}
              onClick={() => setConfirming(true)}
              style={{
                appearance: 'none',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                padding: 6,
              }}
            >
              <LxIcon name="trash" size={18} color={v.ink3} />
            </button>
          </div>
        )}
      </div>

      {tab === 'scheduled' && !confirming ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingLeft: 78 }}>
          <LxBtn
            size="sm"
            variant="ghost"
            type="button"
            onClick={publishNow}
            disabled={transition.isPending}
          >
            publish now
          </LxBtn>
          <LxBtn
            size="sm"
            variant="ghost"
            type="button"
            onClick={returnToDrafts}
            disabled={transition.isPending}
          >
            move to drafts
          </LxBtn>
        </div>
      ) : null}

      {confirming ? (
        <div
          role="group"
          aria-label="confirm delete"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 10,
          }}
        >
          <span style={{ fontFamily: v.fontBody, fontSize: 13, color: v.ink2 }}>
            delete this {tab === 'scheduled' ? 'post' : 'draft'}?
          </span>
          <LxBtn size="sm" variant="ghost" type="button" onClick={() => setConfirming(false)}>
            keep
          </LxBtn>
          <LxBtn
            size="sm"
            type="button"
            style={{ background: v.error, color: v.inkInverse }}
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(post.id, {
                onError: (error) => {
                  setConfirming(false);
                  setProblem(getErrorMessage(error, "We couldn't delete it."));
                },
              })
            }
          >
            delete
          </LxBtn>
        </div>
      ) : null}

      {problem ? (
        <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: v.errorText }}>
          {problem}
        </p>
      ) : null}
    </li>
  );
}

/**
 * The drawer that lists the viewer's drafts and scheduled posts.
 *
 * Both share one limit, which the server reports with the counts, so the sentence at the top states
 * it in numbers the client did not choose. Deleting a row is optimistic and rolls back on failure.
 * Resuming hands the post to the composer, which loads its content.
 */
export function DraftsPanel({
  onResume,
  onClose,
}: {
  onResume: (post: PostResponse) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<PanelTab>('draft');
  const counts = useMyPostCounts();
  const list = useOwnerPosts(tab);
  const now = new Date();
  const posts = list.data?.pages.flatMap((page) => page.data.content) ?? [];
  const total = counts.data ? counts.data.data.draft + counts.data.data.scheduled : null;
  const limit = counts.data?.data.limit;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [onClose]);

  const tabButton = (id: PanelTab, label: string, count: number | undefined) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      style={{
        appearance: 'none',
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${tab === id ? v.accent : 'transparent'}`,
        padding: '8px 2px',
        marginRight: 18,
        cursor: 'pointer',
        fontFamily: v.fontBody,
        fontSize: 14,
        color: tab === id ? v.ink : v.ink3,
      }}
    >
      {label}{' '}
      {count !== undefined ? (
        <span
          style={{
            fontFamily: v.fontMono,
            fontSize: 11,
            background: v.surface,
            borderRadius: 999,
            padding: '1px 7px',
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483200 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: v.scrim }} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="your posts in progress"
        data-testid="drafts-panel"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          maxWidth: '100%',
          background: v.base,
          boxShadow: `0 20px 60px ${v.shadow25}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '22px 20px 6px',
          }}
        >
          <h2
            style={{
              flex: 1,
              margin: 0,
              fontFamily: v.fontDisplay,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: v.ink,
            }}
          >
            your posts in progress
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            style={{
              appearance: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              padding: 4,
            }}
          >
            <LxIcon name="close" size={20} color={v.ink2} />
          </button>
        </div>
        <div
          role="tablist"
          style={{ padding: '0 20px', borderBottom: `1px solid ${v.border}`, display: 'flex' }}
        >
          {tabButton('draft', 'drafts', counts.data?.data.draft)}
          {tabButton('scheduled', 'scheduled', counts.data?.data.scheduled)}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {total !== null && limit !== undefined ? (
            <p
              data-testid="drafts-limit"
              style={{
                margin: 0,
                padding: '12px 20px',
                fontFamily: v.fontBody,
                fontSize: 13,
                color: v.ink2,
              }}
            >
              {total} of {limit} used. Drafts and scheduled posts share the limit.
            </p>
          ) : null}

          {list.isLoading ? (
            <p style={{ ...monoHint, padding: '12px 20px' }}>loading</p>
          ) : list.isError ? (
            <p role="alert" style={{ padding: '12px 20px', fontSize: 13, color: v.errorText }}>
              We couldn&apos;t load your posts. Try again in a moment.
            </p>
          ) : posts.length === 0 ? (
            <p
              style={{
                padding: '24px 20px',
                fontFamily: v.fontBody,
                fontSize: 14,
                color: v.ink3,
              }}
            >
              {tab === 'draft'
                ? 'No drafts. Save a post as a draft and it waits here.'
                : 'Nothing scheduled. Schedule a post and it waits here until it is due.'}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {posts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  tab={tab}
                  now={now}
                  onResume={onResume}
                  onChanged={onClose}
                />
              ))}
            </ul>
          )}

          {list.hasNextPage ? (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <LxBtn
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => list.fetchNextPage()}
                disabled={list.isFetchingNextPage}
              >
                {list.isFetchingNextPage ? 'loading' : 'load more'}
              </LxBtn>
            </div>
          ) : null}

          <p
            style={{
              margin: 0,
              padding: '14px 20px 24px',
              fontFamily: v.fontBody,
              fontSize: 13,
              color: v.ink3,
            }}
          >
            Deleting a draft removes it for good.
          </p>
        </div>
      </aside>
    </div>,
    document.body
  );
}
