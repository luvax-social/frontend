import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';
import { v } from '@/config/tokens';
import { extractPageContent, formatCount } from '@/utils/helpers';
import { LxBtn, LxDropdownMenu, LxIcon } from './primitives';
import { MediaThumb } from './MediaThumb';
import { ReportModal } from './ReportModal';
import { REPORT_TYPES } from '@/services/report.service';
import { useAuthStore } from '@/store/useAuthStore';
import { useUserPosts, useLikedPosts } from '../hooks/usePosts';
import { useUserProfile } from '../hooks/useUsers';
import { useFollow, useUnfollow, useBlock, useUnblock, useBlockedUsers } from '../hooks/useSocial';
import { useDrainEmptyPages } from '../hooks/useDrainEmptyPages';
import { useOverlayNavigate } from '../hooks/useOverlayNavigate';
import { BlockConfirmDialog } from './BlockConfirmDialog';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { FollowListModal } from './FollowListModal';
import { useLuvaxTweaks } from '../LuvaxTweaksContext';
import { ROUTES, routeTo } from '@/config/constants';
import { isPanelRole } from '@/config/roles';
import { LxVerifiedBadge } from '@/components/ui/lx-verified-badge';

/**
 * The post types the photos tab asks the server for.
 *
 * A carousel is included deliberately. The backend left the meaning of
 * "photos" to the client, and flagged the carousel as the open question
 * because a carousel can mix images and video.
 *
 * It is included because a carousel is an image-first format in the way people
 * author and look for it: someone browsing a profile for pictures expects the
 * multi-image posts to be there, and excluding them would empty the tab of
 * exactly the posts it exists to show. A carousel that happens to carry a
 * video among its images is still a post the viewer thinks of as pictures.
 *
 * Video is excluded because "photos" is a claim about the format, and a viewer
 * who opens a tab named photos and gets video has been told something untrue.
 *
 * See docs/social-states-and-tabs/design-decisions.md.
 */
const PHOTO_TYPES = ['image', 'carousel'];

function TextPostTile({ caption }) {
  const text = caption?.trim();

  return (
    <div
      style={{
        aspectRatio: '1/1',
        borderRadius: 4,
        background: v.surface,
        border: `1px solid ${v.borderSubtle}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 14,
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 8,
          border: `1px solid ${v.borderSubtle}`,
          borderRadius: 3,
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          fontFamily: v.fontMono,
          fontSize: 9,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: v.accentText,
        }}
      >
        <span>text</span>
        <span
          aria-hidden="true"
          style={{
            width: 22,
            height: 1,
            background: v.accent,
            opacity: 0.65,
          }}
        />
      </div>
      <div
        style={{
          position: 'relative',
          fontFamily: v.fontDisplay,
          fontSize: text && text.length > 88 ? 16 : 18,
          fontWeight: 700,
          lineHeight: 1.24,
          color: v.ink,
          letterSpacing: '-0.02em',
          display: '-webkit-box',
          WebkitLineClamp: 5,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textAlign: 'left',
        }}
      >
        {text || 'untitled post'}
      </div>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: v.ink3,
          fontFamily: v.fontMono,
          fontSize: 9,
        }}
      >
        <LxIcon name="message" size={12} color={v.ink3} />
        <span>post</span>
      </div>
    </div>
  );
}

export function ProfileScreen() {
  const navigate = useNavigate();
  const openOverlay = useOverlayNavigate();
  const { viewport } = useLuvaxTweaks();
  const [tab, setTab] = useState('photos');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  // Which relationship list is open in a modal: 'followers', 'following', or null.
  const [followList, setFollowList] = useState(null);
  const [confirmingUnfollow, setConfirmingUnfollow] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const menuAnchor = useRef(null);
  const currentUser = useAuthStore((state) => state.user);

  // Absent on the viewer's own profile address, which is what makes that
  // address constructible before the user object has loaded.
  const { userId: targetUserId } = useParams();
  const isSelf = !targetUserId || targetUserId === currentUser?.id;
  const role = useAuthStore((state) => state.role);
  const canReachPanel = isPanelRole(role);

  const queryUserId = targetUserId || currentUser?.id;
  const {
    data: profileResponse,
    isError: isProfileError,
    isLoading: isProfileLoading,
  } = useUserProfile(queryUserId);
  const fetchedUser = profileResponse?.data || profileResponse;

  const user = fetchedUser || (isSelf ? currentUser : null);

  // The relationship comes from the server on every profile read. An earlier
  // version derived it by scanning the viewer's own following list into local
  // state, which could not represent a pending request at all and went stale
  // the moment the relationship changed anywhere else.
  // Blocking someone makes their profile answer 404, so `viewerState.isBlocking`
  // is never observable for an account the viewer has blocked: there is no
  // profile left to carry it. The blocked list is the only server-side record
  // the viewer can still read, which is what distinguishes "you blocked this
  // account" from "no such account" when both answer 404.
  //
  // Reading it here rather than remembering the click keeps the state correct
  // across a reload and when the block was made from somewhere else.
  const { data: blockedResponse } = useBlockedUsers();
  const blockedRows = extractPageContent(blockedResponse);
  const blockedRow = blockedRows.find((row) => (row?.user?.id ?? row?.id) === queryUserId);
  const isBlocking = Boolean(blockedRow) || Boolean(user?.viewerState?.isBlocking);

  const viewerState = user?.viewerState || {};
  const isFollowing = Boolean(viewerState.isFollowing);
  const isRequested = Boolean(viewerState.isFollowRequested);

  // A private account shows its identity to anyone and its content to its
  // followers only. Verified against the running server: posts, followers and
  // following all answer 403 to a non-follower, and the three counts arrive
  // null. Asking for any of it would produce a request that is certain to fail.
  const isPrivateLocked = !isSelf && Boolean(user?.isPrivate) && !isFollowing;
  const isReadable = !isBlocking && !isPrivateLocked;

  const follow = useFollow();
  const unfollow = useUnfollow();
  const block = useBlock();
  const unblock = useUnblock();

  const handleFollowToggle = () => {
    if (!user?.id) return;
    if (follow.isPending || unfollow.isPending) return;
    // Unfollowing is the sensitive one, so it asks first. Withdrawing a pending
    // request and following do not, since neither undoes an existing connection.
    if (isFollowing) {
      setConfirmingUnfollow(true);
      return;
    }
    if (isRequested) unfollow.mutate(user.id);
    else follow.mutate(user.id);
  };

  const showLikedTab = isSelf;
  const tabs = showLikedTab ? ['photos', 'posts', 'liked'] : ['photos', 'posts'];
  const isLikedTab = tab === 'liked' && showLikedTab;

  // Switching tabs changes the type filter, and the filter is part of the
  // query key, so React Query starts the new tab from a null cursor. A cursor
  // issued under one filter is rejected under any other, and this is what
  // makes replaying one across a tab switch impossible rather than merely
  // unlikely.
  const postsQuery = useUserPosts(user?.id, tab === 'photos' ? PHOTO_TYPES : [], {
    enabled: isReadable && !isLikedTab,
  });
  const likedQuery = useLikedPosts(isLikedTab);
  const active = isLikedTab ? likedQuery : postsQuery;

  const { ref, inView } = useInView();
  useEffect(() => {
    if (inView && active.hasNextPage && !active.isFetchingNextPage) {
      active.fetchNextPage();
    }
  }, [inView, active]);

  // Liked rows nest the post under `post` and carry `likedAt`; profile rows are
  // bare posts. Unwrapping covers both without the caller having to know which.
  const posts = (active.data?.pages?.flatMap((page) => extractPageContent(page)) || [])
    .map((row) => row?.post ?? row)
    .filter(Boolean);

  // A like record outlives the post behind it, so the liked list can answer
  // with an empty page while later pages still hold rows.
  const { isDraining } = useDrainEmptyPages({
    rowCount: posts.length,
    hasNextPage: active.hasNextPage,
    isFetchingNextPage: active.isFetchingNextPage,
    fetchNextPage: active.fetchNextPage,
    enabled: isLikedTab && !active.isError,
  });

  const hasIdentifiableUser = Boolean(user?.displayName || user?.firstName || user?.username);

  // The address carries only an id, so nothing can be shown until the profile
  // arrives. Rendering the frame with empty fields would flash a placeholder
  // name before replacing it.
  if (isProfileLoading && !hasIdentifiableUser) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          fontFamily: v.fontBody,
          fontSize: 14,
          color: v.ink3,
        }}
      >
        loading profile...
      </div>
    );
  }

  // A blocked account's profile answers 404, which is the same status a
  // deleted account answers. Without this the screen would report a failure
  // for something the viewer chose, so the blocked case is answered first and
  // named from the blocked list, the only record still readable.
  if (isBlocking && !hasIdentifiableUser) {
    const blockedHandle = blockedRow?.user?.username || 'this account';
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          gap: 12,
          textAlign: 'center',
        }}
      >
        <LxIcon name="close" size={36} color={v.ink3} />
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 14,
            color: v.ink2,
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          you blocked @{blockedHandle}.
        </div>
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 12,
            color: v.ink3,
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          their profile stays hidden until you unblock them.
        </div>
        <LxBtn
          variant="secondary"
          size="sm"
          disabled={unblock.isPending}
          onClick={() => unblock.mutate(queryUserId)}
        >
          {unblock.isPending ? 'unblocking...' : 'unblock'}
        </LxBtn>
      </div>
    );
  }

  if (isProfileError && !hasIdentifiableUser) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          fontFamily: v.fontBody,
          fontSize: 14,
          color: v.error,
        }}
      >
        we couldn't load this profile. check your connection and try again.
      </div>
    );
  }

  const cols = 3;
  const title = user?.displayName || user?.firstName || user?.username || 'Unknown';
  const handle = user?.username || 'unknown';

  const showHandle =
    Boolean(user?.username) &&
    user?.displayName &&
    user.displayName.toLowerCase() !== handle.toLowerCase();

  const followLabel = isFollowing ? 'following' : isRequested ? 'requested' : 'follow';

  // The overflow menu on another account carries two separate actions: the block
  // loop and the report. On a user the report flag is nested under viewerState,
  // unlike posts and comments which carry hasReported at the top level. It is
  // true exactly when a new report would be refused as a duplicate, and a report
  // never reverses, so the row states what happened instead of offering an
  // action that cannot succeed. The whole menu sits behind the !isSelf guard, so
  // neither block nor report can appear on the viewer's own profile.
  const menuItems = [
    {
      id: 'block-toggle',
      icon: 'close',
      label: isBlocking ? `unblock @${handle}` : `block @${handle}`,
      tone: 'danger',
      disabled: block.isPending || unblock.isPending,
      onClick: () => {
        setMenuOpen(false);
        // Unblocking is reversible and restores nothing on its own, so it does
        // not need a confirmation. Blocking destroys follow edges that unblock
        // will not put back, so it does.
        if (isBlocking) unblock.mutate(user.id);
        else setConfirmingBlock(true);
      },
    },
    user?.viewerState?.hasReported
      ? { id: 'report', icon: 'flag', label: 'Reported', readOnly: true }
      : {
          id: 'report',
          icon: 'flag',
          label: 'report',
          tone: 'danger',
          onClick: () => {
            setMenuOpen(false);
            setReportTarget({
              entityType: REPORT_TYPES.USER,
              entityId: user?.id,
              author: title,
              avatarUrl: user?.avatarUrl,
            });
          },
        },
  ];

  // A count of null is what a private account returns to a non-follower. It is
  // withheld rather than zero, so it renders as an em-free placeholder instead
  // of a number the viewer would read as fact.
  const renderCount = (value) => (value === null || value === undefined ? '-' : formatCount(value));

  const notice = (icon, heading, detail) => (
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
      <LxIcon name={icon} size={36} color={v.ink3} />
      <div
        style={{
          fontFamily: v.fontBody,
          fontSize: 14,
          color: v.ink2,
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        {heading}
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
  if (isBlocking) {
    // Blocking makes the profile unreadable, so this is the deliberate state
    // that replaces the grid rather than the error the failed reads would
    // otherwise produce.
    body = notice(
      'close',
      `you blocked @${handle}.`,
      'their posts are hidden from you and yours from them. unblock from the overflow menu or from settings.'
    );
  } else if (isPrivateLocked) {
    body = notice(
      'lock',
      'this account is private.',
      isRequested
        ? 'your follow request is waiting to be approved. you will see their posts once it is.'
        : 'follow this account to see its posts, followers and following.'
    );
  } else if (active.isError) {
    body = notice('alert', "we couldn't load these posts.", 'check your connection and try again.');
  } else if (active.isLoading || isDraining) {
    body = notice(isLikedTab ? 'heart' : 'image', 'loading posts...');
  } else if (posts.length === 0) {
    body = notice(
      isLikedTab ? 'heart' : 'image',
      isLikedTab
        ? 'nothing liked yet.'
        : tab === 'photos'
          ? 'no photo posts yet.'
          : 'no posts yet.',
      isLikedTab ? 'posts you like are kept here.' : undefined
    );
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
          {posts.map((p) => {
            const hasMedia = (p.media || []).length > 0;
            return (
              <div
                key={p.id}
                onClick={() =>
                  openOverlay(routeTo.postDetail(p.id), {
                    fallbackAuthorId: user?.id,
                    fallbackAuthorUsername: user?.username,
                    ...(!isSelf && user?.id ? { background: routeTo.userProfile(user.id) } : {}),
                  })
                }
                style={{ cursor: 'pointer' }}
              >
                {hasMedia ? (
                  <MediaThumb post={p} radius={4} />
                ) : (
                  // Only text posts reach this branch, and a caption tile is the
                  // correct treatment for a post that genuinely carries no media.
                  <TextPostTile caption={p.caption} />
                )}
              </div>
            );
          })}
        </div>
        {active.hasNextPage && (
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
            {active.isFetchingNextPage ? 'loading more...' : 'scroll for more'}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Cover band: the user's banner when set, otherwise the plain raised band. */}
        <div
          style={{
            height: 108,
            background: user?.bannerUrl
              ? `url(${user.bannerUrl}) center/cover no-repeat`
              : v.surfaceRaised,
          }}
        />

        {/* Avatar + follow */}
        <div
          style={{
            padding: '0 16px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: -40,
          }}
        >
          <button
            type="button"
            onClick={() => user?.avatarUrl && setAvatarPreviewOpen(true)}
            aria-label="view avatar"
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: user?.avatarUrl
                ? `url(${user.avatarUrl}) center/cover no-repeat`
                : v.avatar0,
              border: `3px solid var(--lx-base)`,
              flexShrink: 0,
              padding: 0,
              cursor: user?.avatarUrl ? 'pointer' : 'default',
            }}
          />
          {!isSelf && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 2,
                transform: 'translateY(6px)',
              }}
            >
              {!isBlocking && (
                <LxBtn
                  variant={isFollowing || isRequested ? 'secondary' : 'primary'}
                  size="sm"
                  style={{
                    minWidth: 62,
                    height: 30,
                    padding: '0 14px',
                    fontSize: 13,
                    borderRadius: 999,
                  }}
                  onClick={handleFollowToggle}
                  disabled={follow.isPending || unfollow.isPending}
                >
                  {followLabel}
                </LxBtn>
              )}
              {!isBlocking && (
                <LxBtn
                  variant="secondary"
                  size="sm"
                  style={{
                    minWidth: 62,
                    height: 30,
                    padding: '0 14px',
                    fontSize: 13,
                    borderRadius: 999,
                  }}
                  onClick={() => navigate(ROUTES.MESSAGES, { state: { openWithUserId: user.id } })}
                >
                  message
                </LxBtn>
              )}
              <button
                ref={menuAnchor}
                aria-label={`more options for @${handle}`}
                onClick={() => setMenuOpen((open) => !open)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  border: `1px solid ${v.border}`,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <LxIcon name="more" size={16} color={v.ink2} />
              </button>
            </div>
          )}
          {/* Rendered outside the button row on purpose: that row carries a `transform` for a
              pixel nudge, and a `transform` on any ancestor becomes the containing block for a
              `position: fixed` descendant, which broke this menu's fixed-position math under the
              app's root zoom and left it rendering off-screen. */}
          {!isSelf && (
            <LxDropdownMenu
              anchorRef={menuAnchor}
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              items={menuItems}
              align="right"
            />
          )}
          {isSelf && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 2,
                transform: 'translateY(6px)',
              }}
            >
              {/* The phone-width way into the panel.
                  The side rail carries a panel entry above its settings entry,
                  but the rail does not exist at phone width and the bottom bar
                  has no settings slot for one to sit beside. This pill is where
                  settings is actually reached at that width, so the panel entry
                  sits next to it, in the same shape, rather than being invented
                  somewhere the person has no reason to look.

                  Role comes from the same store field and the same predicate the
                  rail uses. It is held in memory and absent until the session is
                  established, so this reads false first and turns true once the
                  role arrives: the entry appears late for a privileged account
                  rather than flashing into view for an ordinary one. */}
              {canReachPanel && (
                <LxBtn variant="secondary" size="sm" onClick={() => navigate(ROUTES.ADMIN)}>
                  panel
                </LxBtn>
              )}
              <LxBtn variant="secondary" size="sm" onClick={() => navigate(ROUTES.SETTINGS)}>
                settings
              </LxBtn>
            </div>
          )}
        </div>

        {/* Name + bio */}
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                fontFamily: v.fontDisplay,
                fontSize: 22,
                fontWeight: 700,
                color: v.ink,
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </div>
            <LxVerifiedBadge
              verified={user?.isVerified}
              category={user?.verifiedCategory}
              size={18}
            />
            {user?.isPrivate && !isSelf && <LxIcon name="lock" size={14} color={v.ink3} />}
          </div>
          {showHandle ? (
            <div style={{ fontFamily: v.fontMono, fontSize: 11, color: v.ink3, marginTop: 4 }}>
              @{handle}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: v.fontBody,
              fontSize: 14,
              color: v.ink2,
              lineHeight: 1.5,
              marginTop: user?.bio ? 10 : 0,
              maxWidth: 480,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {user?.bio || ''}
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            gap: 30,
            padding: '20px 16px 14px',
            borderBottom: `1px solid ${v.border}`,
          }}
        >
          {[
            ['posts', user?.postCount],
            ['following', user?.followingCount],
            ['followers', user?.followerCount],
          ].map(([label, val]) => {
            const navigable = label !== 'posts' && isReadable && val !== null && val !== undefined;
            return (
              <div
                key={label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  cursor: navigable ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (!navigable || !user?.id) return;
                  if (label === 'followers') setFollowList('followers');
                  if (label === 'following') setFollowList('following');
                }}
              >
                <span
                  style={{ fontFamily: v.fontMono, fontSize: 14, fontWeight: 500, color: v.ink }}
                >
                  {renderCount(val)}
                </span>
                <span
                  style={{
                    fontFamily: v.fontMono,
                    fontSize: 9,
                    color: v.ink3,
                    textTransform: 'uppercase',
                    letterSpacing: '0.14em',
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Tabs.
            The liked tab is the viewer's own likes and the endpoint takes no
            path parameter for another account, so it is not offered on someone
            else's profile. A disabled third tab was rejected: it would imply
            the list exists and is merely withheld. */}
        {isReadable && (
          <div style={{ display: 'flex', borderBottom: `1px solid ${v.border}` }}>
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  fontFamily: v.fontBody,
                  fontSize: 13,
                  fontWeight: 500,
                  color: tab === t ? v.ink : v.ink3,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '13px 0 14px',
                  borderBottom: tab === t ? `2px solid var(--lx-ink)` : '2px solid transparent',
                  marginBottom: -1,
                  letterSpacing: '0.01em',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {body}

        <div style={{ height: 24 }} />
      </div>

      <BlockConfirmDialog
        open={confirmingBlock}
        handle={handle}
        pending={block.isPending}
        onCancel={() => setConfirmingBlock(false)}
        onConfirm={() => {
          block.mutate(user.id, { onSuccess: () => setConfirmingBlock(false) });
        }}
      />

      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />

      {avatarPreviewOpen && user?.avatarUrl ? (
        <div
          onClick={() => setAvatarPreviewOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10,9,8,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: 24,
          }}
        >
          <img
            src={user.avatarUrl}
            alt=""
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(calc(78vw / var(--lx-scale)), 520px)',
              height: 'min(calc(78vw / var(--lx-scale)), 520px)',
              maxHeight: 'calc(82vh / var(--lx-scale))',
              borderRadius: '50%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      ) : null}

      <FollowListModal
        open={Boolean(followList) && Boolean(user?.id)}
        mode={followList}
        userId={user?.id}
        onClose={() => setFollowList(null)}
      />

      <ConfirmModal
        config={
          confirmingUnfollow
            ? {
                title: 'unfollow',
                message: (
                  <>
                    Stop following <strong>@{handle}</strong>? You will need to follow again to see
                    their posts.
                  </>
                ),
                confirmLabel: 'unfollow',
                confirmDisabled: unfollow.isPending,
                onConfirm: () => {
                  if (user?.id)
                    unfollow.mutate(user.id, { onSuccess: () => setConfirmingUnfollow(false) });
                },
              }
            : null
        }
        onClose={() => setConfirmingUnfollow(false)}
      />
    </>
  );
}
