import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v } from '@/config/tokens';
import { CaptionText } from './CaptionText';
import { copyPostLink, extractPageContent, getDisplayName, getUserSummary } from '@/utils/helpers';
import {
  LxAvatar,
  LxBottomSheet,
  LxBtn,
  LxDropdownMenu,
  LxIcon,
  LxModal,
  LxTag,
} from './primitives';
import { PostMedia } from './PostMedia';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useDeletePost, useLikePost, useSavePost, useUpdatePost } from '../hooks/usePosts';
import { useBlock, useFollow, useFollowing, useUnfollow } from '../hooks/useSocial';
import { useUserProfile } from '../hooks/useUsers';
import { useAuthStore } from '@/store/useAuthStore';
import { useImpressionTracking } from '@/hooks/useImpressionTracking';
import { useOverlayNavigate } from '../hooks/useOverlayNavigate';
import { ReportModal } from './ReportModal';
import { toast } from './Toast';
import { REPORT_TYPES } from '@/services/report.service';
import { ROUTES, routeTo, CHAR_LIMITS } from '@/config/constants';
import { PostShareDialog } from './PostShareDialog';
import { viewerFollowsAuthor } from '../utils/relationship';
import { LxVerifiedName } from '@/components/ui/lx-verified-badge';

const HEART_COLOR = 'var(--lx-error)';

export function PostCard({
  post,
  density = 'cozy',
  showTags = true,
  viewport = 'desktop',
  surface,
  assumeFollowing = false,
}) {
  const navigate = useNavigate();
  const openOverlay = useOverlayNavigate();
  // Read straight from the post the query cache supplies. Holding these in
  // component state is what let two renderings of one post disagree, since the
  // instance that fired the mutation was the only one that moved.
  const liked = post.isLiked ?? post.viewerState?.isLiked ?? false;
  const likeCount = post.likeCount ?? 0;
  const saved = post.isSaved ?? post.viewerState?.isSaved ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editError, setEditError] = useState('');
  const [heartBurst, setHeartBurst] = useState(false);
  const [saveBurst, setSaveBurst] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [unfollowConfirmOpen, setUnfollowConfirmOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const lastTapRef = useRef(0);

  const currentUser = useAuthStore((state) => state.user);
  const isOwner = currentUser?.id === post.author?.id;
  const { ref: impressionRef } = useImpressionTracking(post.id, surface);

  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  const follow = useFollow();
  const unfollow = useUnfollow();
  const block = useBlock();
  const likeMutation = useLikePost();
  const saveMutation = useSavePost();
  const { data: myFollowingData } = useFollowing(currentUser?.id);

  // The burst is presentation rather than server state, so it stays local. The
  // like itself, and its rollback, now belong to the mutation.
  const handleLikeToggle = useCallback(() => {
    setHeartBurst(false);
    window.requestAnimationFrame(() => setHeartBurst(true));
    likeMutation.mutate({ postId: post.id, liked });
  }, [likeMutation, liked, post.id]);

  const handleSaveToggle = () => {
    setSaveBurst(false);
    window.requestAnimationFrame(() => setSaveBurst(true));
    saveMutation.mutate({ postId: post.id, saved });
  };

  // On a wide viewport a click on the post opens its detail, skipping clicks that
  // started inside an interactive child (marked data-lxtap). On mobile a single
  // tap does nothing: the detail opens from the comment control, and a double-tap
  // on the media likes the post.
  const handleCardClick = (event) => {
    if (isMobile) return;
    if (event.target.closest('[data-lxtap]')) return;
    openOverlay(routeTo.postDetail(post.id));
  };

  // Double-tap to like on mobile, in the manner of Instagram. A double-tap always
  // likes and never unlikes; on an already-liked post it just replays the heart.
  const handleMediaTap = () => {
    if (!isMobile) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0;
      if (!liked) handleLikeToggle();
      else {
        setHeartBurst(false);
        window.requestAnimationFrame(() => setHeartBurst(true));
      }
    } else {
      lastTapRef.current = now;
    }
  };

  // A hashtag opens the tag search and searches for it immediately.
  const openHashtag = (tag) => navigate(`${ROUTES.SEARCH}?q=${encodeURIComponent(tag)}&type=tags`);

  const handleEditOpen = useCallback(() => {
    setEditCaption(post.caption ?? '');
    setEditError('');
    setEditSheetOpen(true);
  }, [post.caption]);

  const handleEditSubmit = () => {
    if (updatePost.isPending) return;
    setEditError('');
    updatePost.mutate(
      { postId: post.id, data: { caption: editCaption } },
      {
        onSuccess: () => {
          setEditSheetOpen(false);
          toast('post updated');
        },
        onError: (error) => {
          setEditError(error?.message || "we couldn't update this post. try again.");
        },
      }
    );
  };

  const handleDeleteRequest = () => {
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    // The card leaves the feed on success, so the toast confirms the delete
    // landed rather than restating a change the user can see.
    deletePost.mutate(post.id, { onSuccess: () => toast('post deleted') });
    setDeleteConfirmOpen(false);
  };

  const pad = density === 'dense' ? '10px 12px 12px' : '14px 16px 16px';
  const gap = density === 'dense' ? 8 : 10;

  const author = getUserSummary(post);
  const authorName = getDisplayName(author);
  const authorHandle = author.username || 'unknown';
  const targetUserId = author.id;
  const avatarUrl = author.avatarUrl;
  const { data: authorProfileResponse } = useUserProfile(
    targetUserId,
    Boolean(targetUserId && !isOwner)
  );
  const authorProfile = authorProfileResponse?.data || authorProfileResponse;
  const tags =
    post.tags || (post.caption ? (post.caption.match(/#(\w+)/g) || []).map((t) => t.slice(1)) : []);
  const isMobile = viewport === 'mobile';
  const isTextPost = String(post.postType || post.type || '').toLowerCase() === 'text';
  const following = (() => {
    if (!targetUserId || isOwner) return false;
    if (assumeFollowing) return true;
    if (viewerFollowsAuthor(post, author) || viewerFollowsAuthor(authorProfile, authorProfile)) {
      return true;
    }
    if (!myFollowingData) return false;
    const list = myFollowingData.pages?.flatMap((page) => extractPageContent(page)) || [];
    // Follower lists return UserListItemResponse, which nests the user.
    return list.some((item) => getUserSummary(item, 'user').id === targetUserId);
  })();

  const handleFollowConfirm = useCallback(() => {
    if (!targetUserId) return;
    follow.mutate(targetUserId);
  }, [follow, targetUserId]);

  const handleUnfollowConfirm = useCallback(() => {
    if (!targetUserId) return;
    unfollow.mutate(targetUserId, { onSuccess: () => setUnfollowConfirmOpen(false) });
  }, [targetUserId, unfollow]);

  const handleFollowToggle = useCallback(() => {
    if (!targetUserId) return;
    if (following) {
      setUnfollowConfirmOpen(true);
      return;
    }
    handleFollowConfirm();
  }, [following, handleFollowConfirm, targetUserId]);

  const menuItems = useMemo(
    () => [
      {
        id: 'like',
        icon: 'heart',
        label: liked ? 'Unlike' : 'Like',
        onClick: handleLikeToggle,
      },
      {
        id: 'share',
        icon: 'share',
        label: 'Share',
        onClick: () => setShareOpen(true),
      },
      {
        id: 'copy',
        icon: 'link',
        // The link goes to the clipboard with nothing on screen to show for it,
        // so this is one of the few actions that earns a toast.
        label: 'Copy link',
        onClick: () =>
          copyPostLink(post.id)
            .then(() => toast('link copied'))
            .catch(() => {}),
      },
      isOwner
        ? {
            id: 'edit',
            icon: 'edit',
            // Menu rows follow the design's sentence case (Share, Copy link),
            // unlike these two rows the frontend added in lower case.
            label: 'Edit post',
            onClick: handleEditOpen,
          }
        : null,
      isOwner
        ? {
            id: 'delete',
            icon: 'close',
            label: 'Delete post',
            tone: 'danger',
            onClick: handleDeleteRequest,
          }
        : null,
      !isOwner
        ? {
            id: 'view-profile',
            icon: 'profile',
            label: "View author's profile",
            onClick: () => targetUserId && navigate(routeTo.userProfile(targetUserId)),
          }
        : null,
      !isOwner
        ? {
            id: 'follow-toggle',
            // userMinus only in the destructive direction. The design ships the glyph but never
            // uses it, and has no userPlus counterpart, so the follow direction keeps profile.
            icon: following ? 'userMinus' : 'profile',
            label: `${following ? 'Unfollow' : 'Follow'} @${authorHandle}`,
            tone: following ? 'danger' : undefined,
            separator: true,
            onClick: handleFollowToggle,
            disabled: follow.isPending || unfollow.isPending,
          }
        : null,
      !isOwner
        ? {
            id: 'block',
            icon: 'ban',
            label: `Block @${authorHandle}`,
            tone: 'danger',
            onClick: () => setBlockConfirmOpen(true),
          }
        : null,
      // hasReported is true exactly when a new report would be refused as a
      // duplicate, and a report never reverses, so the row states what happened
      // instead of offering an action that cannot succeed.
      !isOwner && post.hasReported
        ? { id: 'report', icon: 'flag', label: 'Reported', readOnly: true }
        : null,
      !isOwner && !post.hasReported
        ? {
            id: 'report',
            icon: 'flag',
            label: 'Report',
            tone: 'danger',
            onClick: () =>
              setReportTarget({
                entityType: REPORT_TYPES.POST,
                entityId: post.id,
                author: authorName,
                text: post.caption,
                avatarUrl,
              }),
          }
        : null,
    ],
    [
      authorHandle,
      authorName,
      avatarUrl,
      follow.isPending,
      following,
      handleEditOpen,
      handleFollowToggle,
      handleLikeToggle,
      isOwner,
      liked,
      navigate,
      post.caption,
      post.hasReported,
      post.id,
      targetUserId,
      unfollow.isPending,
    ]
  );

  return (
    <article
      ref={impressionRef}
      onClick={handleCardClick}
      style={{
        // No card chrome. The feed is one continuous surface on the page
        // background; posts are told apart by the space between them, not by a
        // box, a border, or a divider. See docs/layout-overhaul/layout-decisions.md.
        background: v.base,
        cursor: 'pointer',
      }}
    >
      {block.isError ? (
        <div
          role="alert"
          data-lxtap="1"
          style={{
            padding: '8px 14px',
            fontFamily: v.fontMono,
            fontSize: 11,
            color: v.errorText,
            background: v.errorDim,
          }}
        >
          couldn&apos;t block @{authorHandle}. try again.
        </div>
      ) : null}

      {/* The uploader's avatar and info lead the post, then the media, then the
          caption and actions. */}
      <div style={{ padding: isMobile ? '0 14px 10px' : '0 4px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            data-lxtap="1"
            onClick={() => targetUserId && navigate(routeTo.userProfile(targetUserId))}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <LxAvatar size={26} src={avatarUrl} />
            <LxVerifiedName
              name={authorName}
              verified={author.isVerified}
              category={author.verifiedCategory}
              size={13}
              textStyle={{ fontFamily: v.fontBody, fontSize: 13, fontWeight: 600, color: v.ink }}
            />
          </div>
          <button
            ref={menuButtonRef}
            type="button"
            data-lxtap="1"
            onClick={() => setMenuOpen((open) => !open)}
            style={{
              background: 'transparent',
              border: 'none',
              width: 20,
              height: 20,
              cursor: 'pointer',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: v.ink3,
              padding: 0,
            }}
          >
            <LxIcon name="more" size={15} color={v.ink3} />
          </button>
        </div>
      </div>

      {/* The photo carries its own rounded frame on wide viewports and runs edge
          to edge on a phone. minAspect 0 lets the frame take the media's true
          ratio, so the image fills it with no side gaps. Double-tap likes on
          mobile. */}
      <div onClick={handleMediaTap} style={{ cursor: isMobile ? 'default' : 'pointer' }}>
        <PostMedia post={post} radius={isMobile ? 0 : 14} minAspect={0} />
      </div>

      <div style={{ padding: isMobile ? '12px 14px 0' : '12px 4px 0' }}>
        <p
          style={{
            fontFamily: v.fontBody,
            // postType serialises lower case, like mediaType. Comparing against
            // "TEXT" never matched, so every text post rendered at the image size.
            // Captions are grown a step beyond the root scale: the column is wider
            // now, so the owner asked for larger caption text to keep lines readable.
            fontSize: isTextPost ? 17 : 15,
            color: v.ink,
            lineHeight: 1.5,
            margin: 0,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            whiteSpace: 'pre-wrap',
          }}
        >
          <CaptionText text={post.caption} />
        </p>

        {showTags && tags.length > 0 ? (
          <div data-lxtap="1" style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: gap }}>
            {tags.map((tag, index) => (
              <LxTag
                key={`${tag}-${index}`}
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  openHashtag(tag);
                }}
              >
                #{tag}
              </LxTag>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 18, marginTop: gap + 2, alignItems: 'center' }}>
          <button
            type="button"
            data-lxtap="1"
            onClick={handleLikeToggle}
            className={`lx-heart-button ${heartBurst ? 'is-liked' : ''}`}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              color: liked ? HEART_COLOR : v.ink3,
            }}
          >
            <span className="lx-heart-icon" style={{ display: 'inline-flex' }}>
              <LxIcon name="heart" size={17} color={liked ? HEART_COLOR : v.ink3} filled={liked} />
            </span>
            {/* The design keeps the count in v.ink3 whether or not the post is liked;
                only the glyph takes the like colour. */}
            <span style={{ fontFamily: v.fontMono, fontSize: 11, color: v.ink3 }}>{likeCount}</span>
          </button>
          <button
            type="button"
            data-lxtap="1"
            onClick={() => openOverlay(routeTo.postDetail(post.id))}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <LxIcon name="chat" size={17} color={v.ink3} />
            <span style={{ fontFamily: v.fontMono, fontSize: 11, color: v.ink3 }}>
              {post.commentCount ?? 0}
            </span>
          </button>
          <button
            type="button"
            data-lxtap="1"
            onClick={() => setShareOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <LxIcon name="share" size={17} color={v.ink3} />
          </button>
          <button
            type="button"
            data-lxtap="1"
            onClick={handleSaveToggle}
            className={saveBurst ? 'lx-bookmark-button is-saved' : 'lx-bookmark-button'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginLeft: 'auto',
            }}
          >
            <span className="lx-bookmark-icon" style={{ display: 'inline-flex' }}>
              <LxIcon name="bookmark" size={17} color={saved ? v.ink : v.ink3} filled={saved} />
            </span>
          </button>
        </div>
      </div>

      {/* These overlays are children of the article, so without the opt-out every
          click inside them would also open the post. */}
      <div data-lxtap="1">
        <LxDropdownMenu
          anchorRef={menuButtonRef}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          items={menuItems}
          width={248}
        />

        <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
        <PostShareDialog open={shareOpen} postId={post.id} onClose={() => setShareOpen(false)} />

        <LxBottomSheet
          open={editSheetOpen}
          onClose={() => {
            if (!updatePost.isPending) setEditSheetOpen(false);
          }}
          height="40vh"
        >
          <div
            style={{
              padding: '4px 16px 8px',
              borderBottom: `1px solid ${v.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontFamily: v.fontBody, fontSize: 15, fontWeight: 600, color: v.ink }}>
              edit post
            </div>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            <textarea
              value={editCaption}
              onChange={(event) => setEditCaption(event.target.value)}
              maxLength={CHAR_LIMITS.caption}
              placeholder="write a caption..."
              style={{
                width: '100%',
                height: 100,
                fontFamily: v.fontBody,
                fontSize: 15,
                color: v.ink,
                border: `1px solid ${v.border}`,
                borderRadius: 8,
                padding: 12,
                resize: 'none',
                outline: 'none',
                background: v.base,
              }}
            />
            {editError ? (
              <div
                role="alert"
                style={{ fontFamily: v.fontMono, fontSize: 11, color: v.errorText }}
              >
                {editError}
              </div>
            ) : null}
            <LxBtn variant="primary" onClick={handleEditSubmit} disabled={updatePost.isPending}>
              {updatePost.isPending ? 'saving...' : 'save changes'}
            </LxBtn>
          </div>
        </LxBottomSheet>

        <ConfirmModal
          config={
            deleteConfirmOpen
              ? {
                  title: 'delete post',
                  message: 'are you sure you want to delete this post?',
                  confirmLabel: 'delete',
                  onConfirm: handleDeleteConfirm,
                }
              : null
          }
          onClose={() => setDeleteConfirmOpen(false)}
        />

        <ConfirmModal
          config={
            blockConfirmOpen
              ? {
                  title: 'block user',
                  // The same wording the profile and post detail already use, so
                  // one irreversible action reads the same way everywhere.
                  message: (
                    <>
                      Are you sure you want to block <strong>{authorName}</strong>? They won&apos;t
                      be able to find your profile, posts or story on Luvax.
                    </>
                  ),
                  confirmLabel: 'block',
                  confirmDisabled: block.isPending,
                  onConfirm: () => {
                    // Blocking from a post's menu gives no on-screen sign it worked,
                    // so the toast reports it. See docs/layout-overhaul/changes-applied.md.
                    if (targetUserId)
                      block.mutate(targetUserId, {
                        onSuccess: () => toast(`blocked @${authorHandle}`),
                      });
                  },
                }
              : null
          }
          onClose={() => setBlockConfirmOpen(false)}
        />

        <ConfirmModal
          config={
            unfollowConfirmOpen
              ? {
                  title: 'unfollow',
                  message: (
                    <>
                      Stop following <strong>@{authorHandle}</strong>? You will need to follow again
                      to see their posts in following.
                    </>
                  ),
                  confirmLabel: 'unfollow',
                  confirmDisabled: unfollow.isPending,
                  onConfirm: handleUnfollowConfirm,
                }
              : null
          }
          onClose={() => setUnfollowConfirmOpen(false)}
        />
      </div>
    </article>
  );
}
