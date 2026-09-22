import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { v } from '@/config/tokens';
import { extractPageContent, getUserSummary } from '@/utils/helpers';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { routeTo } from '@/config/constants';
import { LxIcon } from './primitives';
import { UserCard } from './UserCard';
import { useFollowers, useFollowing } from '../hooks/useSocial';

/**
 * Followers or following, shown in a modal rather than by navigating away, so the
 * profile behind it stays put. Only the query matching `mode` runs.
 */
export function FollowListModal({ open, onClose, userId, mode }) {
  const navigate = useNavigate();
  useEscapeKey(open, onClose);

  const followersQuery = useFollowers(userId, open && mode === 'followers');
  const followingQuery = useFollowing(userId, open && mode === 'following');
  const query = mode === 'followers' ? followersQuery : followingQuery;

  const { ref, inView } = useInView();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = query;

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useBodyScrollLock(open);

  if (!open) return null;

  const rows = data?.pages?.flatMap((page) => extractPageContent(page)) || [];
  const title = mode === 'followers' ? 'followers' : 'following';

  const goToProfile = (u) => {
    onClose();
    navigate(routeTo.userProfile(u.id));
  };

  return (
    <>
      <div
        className="lx-scrim"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 8, 6, 0.62)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex: 1400,
        }}
      />
      <div
        className="lx-modal-panel"
        role="dialog"
        aria-label={title}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(420px, calc(100vw - 32px))',
          height: 'min(70vh, 560px)',
          background: v.base,
          border: `1px solid ${v.border}`,
          borderRadius: 16,
          boxShadow: `0 24px 80px ${v.shadow25}`,
          overflow: 'hidden',
          zIndex: 1401,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: `1px solid ${v.borderSubtle}`,
          }}
        >
          <span
            style={{
              fontFamily: v.fontBody,
              fontSize: 15,
              fontWeight: 600,
              color: v.ink,
              textTransform: 'lowercase',
            }}
          >
            {title}
          </span>
          <button
            type="button"
            aria-label="close"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              padding: 4,
            }}
          >
            <LxIcon name="close" size={16} color={v.ink3} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px 14px' }}>
          {isLoading ? (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                fontFamily: v.fontMono,
                fontSize: 12,
                color: v.ink3,
              }}
            >
              loading...
            </div>
          ) : rows.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                fontFamily: v.fontBody,
                fontSize: 14,
                color: v.ink3,
              }}
            >
              {mode === 'followers' ? 'no followers yet' : 'not following anyone yet'}
            </div>
          ) : (
            rows.map((item) => {
              const rowUser = getUserSummary(item, 'user');
              return (
                <UserCard
                  key={rowUser.id}
                  user={rowUser}
                  initiallyFollowing={item.viewerState?.isFollowing ?? false}
                  initiallyRequested={item.viewerState?.isFollowRequested ?? false}
                  onAvatarClick={goToProfile}
                />
              );
            })
          )}
          {hasNextPage ? (
            <div
              ref={ref}
              style={{
                height: 24,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {isFetchingNextPage ? (
                <span style={{ color: v.ink3, fontFamily: v.fontMono, fontSize: 11 }}>
                  loading more...
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
