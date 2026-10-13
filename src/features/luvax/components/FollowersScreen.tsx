import { getErrorResponse } from '@/utils/errors';
import { unwrapApiResponse } from '@/utils/unwrapApiResponse';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { v } from '@/config/tokens';
import { extractPageContent, getUserSummary } from '@/utils/helpers';
import { LxIcon } from './primitives';
import { useAuthStore } from '@/store/useAuthStore';
import { useFollowers } from '../hooks/useSocial';
import { UserCard } from './UserCard';
import { useUserProfile } from '../hooks/useUsers';
import { routeTo } from '@/config/constants';

export function FollowersScreen() {
  const navigate = useNavigate();
  const params = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const userId = params.userId || currentUser?.id;
  // The address carries an id, not a handle, so the name in the heading is read
  // from the profile itself. It is normally already cached from the profile
  // screen this was opened from, and a cold load fetches it.
  const { data: ownerResponse } = useUserProfile(userId);
  const owner = ownerResponse ? unwrapApiResponse(ownerResponse) : undefined;
  const username = owner?.username || currentUser?.username || 'user';
  const isSelf = userId === currentUser?.id;

  const { ref, inView } = useInView();
  const {
    data: followersResponse,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFollowers(userId);

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle privacy/visibility errors (e.g. 403 Forbidden)
  if (isError && getErrorResponse(error)?.status === 403) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          textAlign: 'center',
        }}
      >
        <LxIcon name="lock" size={48} color={v.ink3} />
        <div
          style={{
            fontFamily: v.fontDisplay,
            fontSize: 20,
            fontWeight: 700,
            color: v.ink,
            marginTop: 16,
          }}
        >
          Private Account
        </div>
        <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink3, marginTop: 8 }}>
          Follow this account to see their followers.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: v.ink3,
        }}
      >
        loading followers...
      </div>
    );
  }

  const followers = followersResponse?.pages?.flatMap((page) => extractPageContent(page)) || [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: v.base }}>
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${v.border}`,
          display: 'flex',
          alignItems: 'center',
          background: v.surface,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ fontFamily: v.fontBody, fontSize: 16, fontWeight: 600, color: v.ink }}>
          {isSelf ? 'Your Followers' : `${username}'s Followers`}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {followers.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: v.ink3,
              fontFamily: v.fontBody,
              fontSize: 14,
            }}
          >
            no followers yet
          </div>
        ) : (
          followers.map((item) => {
            // Rows are UserListItemResponse: the user nests under `user`.
            const rowUser = getUserSummary(item, 'user');
            return (
              <UserCard
                key={rowUser.id}
                user={rowUser}
                initiallyFollowing={item.viewerState?.isFollowing ?? false}
                onAvatarClick={(u) => navigate(routeTo.userProfile(u.id))}
              />
            );
          })
        )}

        {/* Infinite Scroll Trigger */}
        <div
          ref={ref}
          style={{ height: 20, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          {isFetchingNextPage && (
            <span style={{ color: v.ink3, fontSize: 12 }}>loading more...</span>
          )}
        </div>
      </div>
    </div>
  );
}
