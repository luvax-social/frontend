import { useEffect, useState } from 'react';
import { v } from '@/config/tokens';
import { formatCount } from '@/utils/helpers';
import { useAuthStore } from '@/store/useAuthStore';
import { LxAvatar, LxBtn } from './primitives';
import { useFollow, useUnfollow } from '../hooks/useSocial';
import { useUserProfile } from '../hooks/useUsers';
import { LxVerifiedBadge } from '@/components/ui/lx-verified-badge';

export function UserCard({
  user,
  onAvatarClick,
  onFollowToggle,
  initiallyFollowing = false,
  initiallyRequested = false,
  rightElement,
  compact = false,
  showFollowButton = true,
}) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [isFollowing, setIsFollowing] = useState(initiallyFollowing);
  // A pending request to a private account is its own state. Reading only
  // isFollowing showed "follow" for an account the viewer had already asked to
  // follow. The profile screen already distinguishes all three; this makes the
  // search result do the same.
  const [requested, setRequested] = useState(initiallyRequested);

  const follow = useFollow();
  const unfollow = useUnfollow();

  useEffect(() => {
    // Syncs optimistic button state back to the latest relationship state returned by the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsFollowing(initiallyFollowing);
    setRequested(initiallyRequested);
  }, [initiallyFollowing, initiallyRequested, user?.id]);

  const handleFollowClick = () => {
    if (isFollowing || requested) {
      // A pending request is withdrawn through the same unfollow endpoint.
      unfollow.mutate(user.id);
      setIsFollowing(false);
      setRequested(false);
      if (onFollowToggle) onFollowToggle(false);
    } else {
      follow.mutate(user.id);
      // Following a private account yields a pending request, not an accepted follow.
      if (user.isPrivate) setRequested(true);
      else setIsFollowing(true);
      if (onFollowToggle) onFollowToggle(true);
    }
  };

  const followLabel = isFollowing ? 'following' : requested ? 'requested' : 'follow';
  const avatarSize = compact ? 36 : 44;
  const buttonVariant = compact ? 'ghost' : isFollowing || requested ? 'secondary' : 'primary';
  const isSelf = Boolean(currentUserId && user?.id === currentUserId);
  const rawFollowerCount =
    user?.followerCount ??
    user?.followersCount ??
    user?.followers ??
    user?.stats?.followerCount ??
    user?.stats?.followersCount ??
    user?.profile?.followerCount ??
    user?.profile?.followersCount ??
    user?.user?.followerCount ??
    user?.user?.followersCount;
  const hasFollowerCount =
    rawFollowerCount !== null && rawFollowerCount !== undefined && rawFollowerCount !== '';
  const { data: profileCountSource } = useUserProfile(
    user?.id,
    showFollowButton === false && !hasFollowerCount
  );
  const profileFollowerCount =
    profileCountSource?.data?.followerCount ??
    profileCountSource?.data?.followersCount ??
    profileCountSource?.followerCount ??
    profileCountSource?.followersCount;
  const resolvedFollowerCount = hasFollowerCount ? rawFollowerCount : profileFollowerCount;
  const followerCount =
    typeof resolvedFollowerCount === 'number'
      ? resolvedFollowerCount
      : typeof resolvedFollowerCount === 'string' && resolvedFollowerCount.trim() !== ''
        ? Number(resolvedFollowerCount)
        : Array.isArray(resolvedFollowerCount)
          ? resolvedFollowerCount.length
          : 0;
  const visibleFollowerCount = Number.isFinite(followerCount) ? followerCount : 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 9 : 12,
        padding: compact ? '4px 0' : '8px 0',
      }}
    >
      <div
        onClick={() => onAvatarClick && onAvatarClick(user)}
        style={{ cursor: onAvatarClick ? 'pointer' : 'default' }}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: '50%',
              objectFit: 'cover',
            }}
            alt="avatar"
          />
        ) : (
          <LxAvatar size={avatarSize} idx={user.id ? user.id.charCodeAt(0) : 0} />
        )}
      </div>

      <div
        style={{ flex: 1, minWidth: 0, cursor: onAvatarClick ? 'pointer' : 'default' }}
        onClick={() => onAvatarClick && onAvatarClick(user)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontFamily: v.fontBody,
              fontSize: compact ? 12 : 14,
              fontWeight: 600,
              color: v.ink,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            {user.displayName || user.username || 'Unknown'}
          </span>
          <LxVerifiedBadge
            verified={user.isVerified}
            category={user.verifiedCategory}
            size={compact ? 13 : 15}
          />
        </div>
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: compact ? 10 : 12,
            color: v.ink3,
            marginTop: 2,
            whiteSpace: compact ? 'nowrap' : 'normal',
            overflow: compact ? 'hidden' : 'visible',
            textOverflow: compact ? 'ellipsis' : 'clip',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {user.bio || `@${user.username || 'unknown'}`}
        </div>
        <div
          style={{
            fontFamily: v.fontMono,
            fontSize: compact ? 9 : 10,
            color: v.ink3,
            marginTop: 3,
          }}
        >
          {formatCount(visibleFollowerCount)} followers
        </div>
      </div>

      {rightElement
        ? rightElement
        : showFollowButton &&
          !isSelf && (
            <LxBtn
              variant={buttonVariant}
              size="sm"
              onClick={handleFollowClick}
              disabled={follow.isPending || unfollow.isPending}
              style={
                compact
                  ? {
                      minWidth: 56,
                      padding: '5px 11px',
                      fontSize: 11,
                      lineHeight: 1,
                      color: v.ink,
                      borderColor: v.borderStrong,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }
                  : {}
              }
            >
              {followLabel}
            </LxBtn>
          )}
    </div>
  );
}
