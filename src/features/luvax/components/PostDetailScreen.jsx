import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { v } from '@/config/tokens';
import { CaptionText } from './CaptionText';
import {
  copyPostLink,
  extractPageContent,
  getDisplayName,
  getUserSummary,
  sharePost,
} from '@/utils/helpers';
import { LxAvatar, LxBtn, LxDropdownMenu, LxIcon, LxModal, LxTag } from './primitives';
import { PostMedia } from './PostMedia';
import {
  useCreateComment,
  useDeletePost,
  useLikePost,
  usePostDetail,
  useTopLevelComments,
  useUpdatePost,
} from '../hooks/usePosts';
import { useLivePostUpdates } from '../hooks/useLivePostUpdates';
import {
  useCommentDeletionScope,
  useCommentReplies,
  useDeleteComment,
  useEditComment,
  useToggleCommentLike,
} from '../hooks/usePosts';
import { useAuthStore } from '@/store/useAuthStore';
import { useBlock, useFollow, useFollowing, useUnfollow } from '../hooks/useSocial';
import { useUserProfile } from '../hooks/useUsers';
import { useRelativeTime } from '../hooks/useRelativeTime';
import { useViewport } from '../hooks/useViewport';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { ReportModal } from './ReportModal';
import { toast } from './Toast';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { REPORT_TYPES } from '@/services/report.service';
import { routeTo, CHAR_LIMITS } from '@/config/constants';
import { PostShareDialog } from './PostShareDialog';
import { viewerFollowsAuthor } from '../utils/relationship';
import { LxVerifiedName } from '@/components/ui/lx-verified-badge';

const HEART_COLOR = 'var(--lx-error)';
const COMMENT_MAX_LENGTH = CHAR_LIMITS.comment;
const COMMENT_EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const COMMENT_EMOJI_GROUPS = [
  {
    label: 'recently used',
    categoryIcon: '🕘',
    icons: [
      ['😀', 'grinning happy smile'],
      ['😂', 'laugh tears joy'],
      ['😍', 'heart eyes love'],
      ['😭', 'cry tears'],
      ['😘', 'kiss love'],
    ],
  },
  {
    label: 'smileys & people',
    categoryIcon: '😀',
    icons: [
      ['😃', 'smile happy'],
      ['😄', 'laugh happy'],
      ['😁', 'grin teeth'],
      ['😆', 'laugh squint'],
      ['😅', 'sweat smile'],
      ['🤣', 'rolling laugh'],
      ['😊', 'blush happy'],
      ['😇', 'halo angel'],
      ['🙄', 'rolling eyes'],
      ['🥺', 'pleading'],
      ['😉', 'wink'],
      ['😌', 'relieved calm'],
      ['😟', 'worried'],
      ['😮', 'surprise wow'],
      ['😴', 'sleep tired'],
      ['🤯', 'mind blown'],
      ['😬', 'grimace'],
      ['😡', 'angry'],
      ['👋', 'wave hello'],
      ['🙌', 'hands celebrate'],
    ],
  },
  {
    label: 'animals & nature',
    categoryIcon: '🌿',
    icons: [
      ['🌿', 'leaf nature'],
      ['🌸', 'flower'],
      ['🌙', 'moon night'],
      ['☀️', 'sun bright'],
      ['⭐', 'star'],
      ['🔥', 'fire'],
      ['✨', 'sparkles'],
      ['🌧️', 'rain'],
    ],
  },
  {
    label: 'food',
    categoryIcon: '🍴',
    icons: [
      ['🍕', 'pizza'],
      ['🍔', 'burger'],
      ['🍟', 'fries'],
      ['🍜', 'noodles'],
      ['☕', 'coffee'],
      ['🍰', 'cake'],
      ['🍓', 'strawberry'],
      ['🍻', 'cheers'],
    ],
  },
  {
    label: 'activities',
    categoryIcon: '⚽',
    icons: [
      ['⚽', 'soccer'],
      ['🏀', 'basketball'],
      ['🎮', 'game'],
      ['🎧', 'music'],
      ['🚗', 'car'],
      ['✈️', 'plane'],
      ['💡', 'idea'],
      ['📌', 'pin'],
    ],
  },
  {
    label: 'symbols',
    categoryIcon: '💯',
    icons: [
      ['❤️', 'heart love'],
      ['💯', 'hundred'],
      ['✅', 'check done'],
      ['❌', 'cross no'],
      ['⚠️', 'warning'],
      ['🙏', 'pray thanks'],
      ['👍', 'thumbs up like'],
      ['👏', 'clap'],
    ],
  },
];

// Threads are two levels, like Instagram. A top-level comment sits at depth 0;
// every reply, including a reply to a reply, sits at depth 1 under the same
// thread root and carries an @mention of the person it answers. rootId is the
// top-level comment a reply belongs to.
function CommentRow({ comment, onReply, depth = 0, rootId = null, postId }) {
  const [heartBurst, setHeartBurst] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [commentMenuOpen, setCommentMenuOpen] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [actionError, setActionError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [estimateLate, setEstimateLate] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const commentMenuButtonRef = useRef(null);
  const navigate = useNavigate();

  // CommentResponse embeds the author as a UserSummaryResponse, so no
  // per-row profile fetch is needed. There is no `comment.userId`.
  const author = getUserSummary(comment);
  const authorName = getDisplayName(author, location.state?.fallbackAuthorUsername || 'unknown');
  const currentUser = useAuthStore((state) => state.user);
  // Ownership comes from the response rather than from anything the client
  // remembers about who wrote what.
  const isOwn = Boolean(author.id && currentUser?.id && author.id === currentUser.id);

  const timeStr = useRelativeTime(comment.createdAt, { seedKey: comment.id });

  const { data: repliesResponse, isLoading: repliesLoading } = useCommentReplies(
    comment.id,
    showReplies
  );
  const replies = extractPageContent(repliesResponse);

  const toggleLike = useToggleCommentLike(postId);
  const editComment = useEditComment(postId);
  const deleteComment = useDeleteComment(postId);
  const deletionScope = useCommentDeletionScope(comment.id, deleteOpen);

  const isReply = depth > 0;
  // A reply's own replies do not nest further; they attach to the same thread
  // root, so only a top-level comment shows and loads a replies block.
  const hasReplies = !isReply && comment.replyCount > 0;
  // The thread root a reply under this row belongs to: this comment when it is
  // top level, or the root passed down when this row is itself a reply.
  const threadRootId = isReply ? rootId : comment.id;

  // The like state and the count both come from the query cache, so the same
  // comment rendered in two places cannot disagree with itself.
  const liked = Boolean(comment.isLiked);
  const likeCount = comment.likeCount ?? 0;

  const trimmedDraft = draft.trim();
  const draftTooLong = draft.length > COMMENT_MAX_LENGTH;
  const canSaveEdit = trimmedDraft.length > 0 && !draftTooLong && !editComment.isPending;

  const handleLikeToggle = () => {
    setActionError('');
    setHeartBurst(false);
    window.requestAnimationFrame(() => setHeartBurst(true));
    toggleLike.mutate(
      { commentId: comment.id, isLiked: liked, parentId: comment.parentId },
      { onError: (error) => setActionError(error?.message || 'that did not work. try again.') }
    );
  };

  const startEditing = () => {
    setDraft(comment.content);
    setActionError('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft(comment.content);
    setActionError('');
  };

  const submitEdit = () => {
    if (!canSaveEdit) {
      return;
    }

    editComment.mutate(
      { commentId: comment.id, content: trimmedDraft, parentId: comment.parentId },
      {
        onSuccess: () => {
          setEditing(false);
          setActionError('');
        },
        // The editor stays open holding the draft. The comment above it still
        // shows the saved body, so a rejected edit never reads as though it went
        // through.
        onError: (error) => setActionError(error?.message || 'that edit could not be saved.'),
      }
    );
  };

  // The dialogue is usable without the estimate, so it waits only briefly for
  // one. The deadline is latched only while the request is still outstanding:
  // once an answer is in, it stays on screen. Past the deadline the unnumbered
  // wording stands for the life of the dialogue, rather than the text changing
  // under a user who is already reading it.
  useEffect(() => {
    if (!deleteOpen) {
      // Drives a timer that marks a pending estimate late; keyed to the dialogue lifecycle.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEstimateLate(false);
      return undefined;
    }

    if (!deletionScope.isPending) {
      return undefined;
    }

    const timer = setTimeout(() => setEstimateLate(true), 1500);
    return () => clearTimeout(timer);
  }, [deleteOpen, deletionScope.isPending]);

  const scopeCount = deletionScope.data?.data?.deletedCommentCount;
  const scopeUsable = !estimateLate && typeof scopeCount === 'number';

  const deleteMessage = () => {
    if (scopeUsable) {
      return scopeCount > 1
        ? `deleting this comment removes ${scopeCount} comments in total, including every reply beneath it. this cannot be undone.`
        : 'are you sure you want to delete this comment? this cannot be undone.';
    }

    // Fallback when the estimate failed or was slow. replyCount counts direct
    // replies only, so this understates a deep thread; it says less rather than
    // saying something wrong.
    return hasReplies
      ? `deleting this comment also deletes its ${comment.replyCount === 1 ? 'reply' : `${comment.replyCount} replies`} and any replies to those. this cannot be undone.`
      : 'are you sure you want to delete this comment? this cannot be undone.';
  };

  const confirmDelete = () => {
    deleteComment.mutate(
      { commentId: comment.id, parentId: comment.parentId },
      {
        onSuccess: () => setDeleteOpen(false),
        onError: (error) => {
          setDeleteOpen(false);
          setActionError(error?.message || 'that comment could not be deleted.');
        },
      }
    );
  };

  const commentMenuItems = [
    { id: 'like', icon: 'heart', label: liked ? 'Unlike' : 'Like', onClick: handleLikeToggle },
    {
      id: 'share',
      icon: 'share',
      label: 'Share',
      onClick: () =>
        sharePost(postId)
          .then(() => toast('link copied'))
          .catch(() => {}),
    },
    {
      id: 'copy',
      icon: 'link',
      label: 'Copy link',
      onClick: () =>
        copyPostLink(postId)
          .then(() => toast('link copied'))
          .catch(() => {}),
    },
    {
      id: 'view-profile',
      icon: 'profile',
      label: "View author's profile",
      onClick: () => (author.id ? navigate(routeTo.userProfile(author.id)) : null),
    },
    ...(isOwn
      ? [
          { id: 'edit', icon: 'edit', label: 'Edit', separator: true, onClick: startEditing },
          {
            id: 'delete',
            icon: 'trash',
            label: 'Delete',
            tone: 'danger',
            onClick: () => setDeleteOpen(true),
          },
        ]
      : [
          // hasReported is true exactly when a new report would be refused as a
          // duplicate, and a report never reverses, so the row states what
          // happened instead of offering an action that cannot succeed.
          comment.hasReported
            ? { id: 'report', icon: 'flag', label: 'Reported', separator: true, readOnly: true }
            : {
                id: 'report',
                icon: 'flag',
                label: 'Report',
                tone: 'danger',
                separator: true,
                onClick: () =>
                  setReportTarget({
                    entityType: REPORT_TYPES.COMMENT,
                    entityId: comment.id,
                    author: authorName,
                    text: comment.content,
                    avatarUrl: author.avatarUrl,
                  }),
              },
        ]),
  ];

  return (
    // No lines between comments. Top-level comments are separated by generous
    // space; a reply sits tight under its thread.
    <div style={{ width: '100%', marginBottom: isReply ? 0 : 26 }} data-comment-id={comment.id}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: '40px minmax(0, 1fr)',
          gap: 12,
          padding: isReply ? '6px 28px 6px 0' : '2px 28px 0 0',
          borderRadius: 10,
        }}
      >
        <div
          onClick={() => author.id && navigate(routeTo.userProfile(author.id))}
          style={{ cursor: author.id ? 'pointer' : 'default' }}
        >
          <LxAvatar size={isReply ? 28 : 34} src={author.avatarUrl} />
        </div>
        <div style={{ minWidth: 0 }}>
          {comment.pinned ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                marginBottom: 5,
                fontFamily: v.fontMono,
                fontSize: 9,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: v.accent,
              }}
            >
              <LxIcon name="heart" size={9} color={v.accent} filled />
              <span>top comment</span>
            </div>
          ) : null}
          <div
            style={{
              display: 'block',
              minWidth: 0,
              maxWidth: '100%',
              lineHeight: 1.42,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            <LxVerifiedName
              name={authorName}
              verified={author.isVerified}
              category={author.verifiedCategory}
              size={12}
              gap={7}
              onClick={author.id ? () => navigate(routeTo.userProfile(author.id)) : undefined}
              textStyle={{
                fontFamily: v.fontBody,
                fontSize: 12.5,
                fontWeight: 600,
                color: v.ink,
              }}
              // Same gap the name keeps before the badge, kept after it too: the badge is the
              // last thing before the comment body starts, and without this it sits flush
              // against the first letter of the comment.
              style={{ marginRight: 7 }}
            />
            {editing ? null : (
              <span
                style={{
                  fontFamily: v.fontBody,
                  fontSize: 12.5,
                  color: v.ink,
                  display: 'inline',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                {comment.content}
              </span>
            )}
          </div>
          {editing ? (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                maxLength={COMMENT_MAX_LENGTH}
                aria-label="edit comment"
                style={{
                  width: '100%',
                  resize: 'vertical',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${draftTooLong ? v.error : v.border}`,
                  background: v.surface,
                  color: v.ink,
                  fontFamily: v.fontBody,
                  fontSize: 12.5,
                  outline: 'none',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <LxBtn variant="primary" size="sm" onClick={submitEdit} disabled={!canSaveEdit}>
                  {editComment.isPending ? 'saving...' : 'save'}
                </LxBtn>
                <LxBtn variant="ghost" size="sm" onClick={cancelEditing}>
                  cancel
                </LxBtn>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: v.fontMono,
                    fontSize: 10,
                    color: draftTooLong ? v.error : v.ink3,
                  }}
                >
                  {draft.length}/{COMMENT_MAX_LENGTH}
                </span>
              </div>
            </div>
          ) : null}
          {actionError ? (
            <div style={{ marginTop: 6, fontFamily: v.fontBody, fontSize: 11.5, color: v.error }}>
              {actionError}
            </div>
          ) : null}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 6,
              fontFamily: v.fontMono,
              fontSize: 10,
              color: v.ink3,
            }}
          >
            <span>{timeStr}</span>
            {/* editedAt is set only by a content change. updatedAt also moves when
                the comment is liked or replied to, so it cannot carry this marker. */}
            {comment.editedAt ? <span title="this comment was edited">edited</span> : null}
            <span>{likeCount} likes</span>
            <button
              type="button"
              onClick={() =>
                onReply({
                  id: comment.id,
                  author: authorName,
                  text: comment.content,
                  // A reply always lands at the thread root, so a reply to a reply
                  // stays at one level. Replying to a reply tags its author, which
                  // the backend turns into a mention notification; replying to a
                  // top-level comment needs no tag.
                  parentId: threadRootId,
                  mentionUsername: isReply ? author.username : null,
                })
              }
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: v.ink3,
                fontFamily: v.fontBody,
                fontSize: 11.5,
                fontWeight: 500,
              }}
            >
              Reply
            </button>
            <button
              ref={commentMenuButtonRef}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setCommentMenuOpen((open) => !open);
              }}
              aria-label={`options for ${authorName}'s comment`}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: 'none',
                background: commentMenuOpen ? v.surfaceRaised : 'transparent',
                padding: 0,
                marginTop: -5,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: hovered || commentMenuOpen ? 1 : 0.45,
                transition: 'opacity 160ms ease, background 160ms ease, transform 160ms ease',
                transform: commentMenuOpen ? 'scale(1.04)' : 'scale(1)',
              }}
            >
              <LxIcon name="more" size={14} color={v.ink3} />
            </button>
          </div>
          {hasReplies ? (
            <button
              type="button"
              onClick={() => setShowReplies((value) => !value)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                marginTop: 5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                color: v.ink3,
                fontFamily: v.fontBody,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  transform: showReplies ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 160ms ease',
                }}
              >
                <LxIcon name="chevronRight" size={12} color={v.ink3} />
              </span>
              <span>{showReplies ? 'Hide replies' : `View replies (${comment.replyCount})`}</span>
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleLikeToggle}
          aria-label={liked ? 'unlike comment' : 'like comment'}
          aria-pressed={liked}
          className={`lx-heart-button ${heartBurst ? 'is-liked' : ''}`}
          style={{
            position: 'absolute',
            top: 16,
            right: 0,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <span className="lx-heart-icon" style={{ display: 'inline-flex' }}>
            <LxIcon name="heart" size={16} color={liked ? HEART_COLOR : v.ink3} filled={liked} />
          </span>
        </button>
      </div>
      {showReplies && hasReplies ? (
        // Replies are one level in, set off by indentation and their tight
        // spacing rather than a thread line.
        <div style={{ marginLeft: 20, marginTop: 4, display: 'flex', flexDirection: 'column' }}>
          {repliesLoading ? (
            <div style={{ padding: '8px 0', fontFamily: v.fontMono, fontSize: 11, color: v.ink3 }}>
              loading replies...
            </div>
          ) : (
            replies.map((reply) => (
              <CommentRow
                key={reply.id}
                comment={reply}
                onReply={onReply}
                depth={1}
                rootId={comment.id}
                postId={postId}
              />
            ))
          )}
        </div>
      ) : null}
      <LxDropdownMenu
        anchorRef={commentMenuButtonRef}
        open={commentMenuOpen}
        onClose={() => setCommentMenuOpen(false)}
        items={commentMenuItems}
        width={214}
        align="right"
        zIndex={5200}
      />

      <ConfirmModal
        config={
          deleteOpen
            ? {
                title: 'delete comment',
                // Deletion cascades to the whole subtree and leaves no
                // tombstone, so the consequence is spelled out when there is
                // one, and left unsaid when the comment is a leaf.
                message: deleteMessage(),
                confirmLabel: deleteComment.isPending ? 'deleting...' : 'delete',
                confirmDisabled: deleteComment.isPending,
                onConfirm: confirmDelete,
              }
            : null
        }
        onClose={() => setDeleteOpen(false)}
      />

      <ReportModal target={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}

export function PostDetailScreen({ overlay = false }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [editError, setEditError] = useState('');
  const [heartBurst, setHeartBurst] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [unfollowConfirmOpen, setUnfollowConfirmOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentEmojiOpen, setCommentEmojiOpen] = useState(false);
  const [commentEmojiSearch, setCommentEmojiSearch] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [postReportTarget, setPostReportTarget] = useState(null);
  const menuButtonRef = useRef(null);
  const commentsPaneRef = useRef(null);
  const commentInputRef = useRef(null);
  const commentEmojiGroupRefs = useRef({});
  const viewport = useViewport();
  // A notification about a comment opens the post and asks, through history state,
  // that the comment be focused. Kept in a ref so the flash fires once per target.
  const location = useLocation();
  const highlightCommentId = location.state?.highlightComment || null;
  const flashedCommentRef = useRef(null);

  // Keep the comment field's height matched to its content, up to three lines.
  // This runs on every draft change, so it grows as the reader types and shrinks
  // back after a submit clears it or an @mention prefills it.
  useEffect(() => {
    const el = commentInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 70)}px`;
  }, [commentDraft]);

  const appendCommentEmoji = (emoji) => {
    setCommentDraft((current) => `${current}${emoji}`);
    window.requestAnimationFrame(() => commentInputRef.current?.focus());
  };

  const visibleCommentEmojiGroups = useMemo(() => {
    const needle = commentEmojiSearch.trim().toLowerCase();
    if (!needle) return COMMENT_EMOJI_GROUPS;
    return COMMENT_EMOJI_GROUPS.map((group) => ({
      ...group,
      icons: group.icons.filter(
        ([icon, keywords]) => icon.includes(needle) || keywords.includes(needle)
      ),
    })).filter((group) => group.icons.length > 0);
  }, [commentEmojiSearch]);

  const { postId } = useParams();
  const { data: postResponse, isLoading, isError } = usePostDetail(postId);

  const currentUser = useAuthStore((state) => state.user);
  const follow = useFollow();
  const unfollow = useUnfollow();
  const block = useBlock();
  const { data: myFollowingData } = useFollowing(currentUser?.id);
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  const likeMutation = useLikePost();
  const createComment = useCreateComment(postId);
  const {
    data: commentsResponse,
    isLoading: commentsLoading,
    isError: commentsError,
    fetchNextPage: fetchNextComments,
    hasNextPage: hasNextComments,
    isFetchingNextPage: isFetchingNextComments,
  } = useTopLevelComments(postId);

  // Live updates are scoped to the post the viewer has open, and to this screen
  // alone. They are additive: if the socket never connects, everything below
  // behaves exactly as it did before.
  useLivePostUpdates(postId);

  const post = postResponse?.data || postResponse || {};
  const author = getUserSummary(post);
  const targetUserId = author.id || location.state?.fallbackAuthorId || null;
  const authorName = getDisplayName(author);
  const authorHandle = author.username || location.state?.fallbackAuthorUsername || 'unknown';
  const authorAvatarUrl = author.avatarUrl;
  const isSelf = currentUser?.id === targetUserId;
  const { data: authorProfileResponse } = useUserProfile(
    targetUserId,
    Boolean(targetUserId && !isSelf)
  );
  const authorProfile = authorProfileResponse?.data || authorProfileResponse;
  const following = (() => {
    if (!targetUserId || isSelf) return false;
    if (viewerFollowsAuthor(post, author) || viewerFollowsAuthor(authorProfile, authorProfile)) {
      return true;
    }
    if (!myFollowingData) return false;
    const list = myFollowingData.pages?.flatMap((page) => extractPageContent(page)) || [];
    // Follower lists return UserListItemResponse, which nests the user.
    return list.some((item) => getUserSummary(item, 'user').id === targetUserId);
  })();

  const tags =
    post.tags ||
    (post.caption ? (post.caption.match(/#(\w+)/g) || []).map((tag) => tag.slice(1)) : []);
  const mediaList = post.media || [];
  const mainMedia = mediaList[0] || null;
  // Two panes only when a media post is opened on a wide viewport: the media
  // takes the left pane and stays put while the comments scroll on the right.
  // A text post is always a single column, and a narrow viewport stacks the
  // media above the comments in one scrolling column. See
  // docs/layout-overhaul/layout-decisions.md.
  const twoPane = mediaList.length > 0 && viewport === 'desktop';
  // The popup's shape follows the media. A portrait image (taller than wide)
  // makes the whole popup that portrait's aspect ratio, so it is not stranded in
  // a wide dark pane. A landscape image keeps the roomier fixed frame. The ratio
  // is width over height, taken from the first media item, as the frame is.
  const mediaAspect =
    mainMedia && mainMedia.width && mainMedia.height ? mainMedia.width / mainMedia.height : 1;
  const A = mediaAspect.toFixed(4);
  // The media pane takes the media's own width edge to edge, with no letterbox at the
  // sides. Its height follows the media's aspect ratio, capped so a tall portrait does
  // not run past the screen. The popup itself, though, never gets shorter than a floor:
  // a wide landscape would otherwise leave the comment column too short to read, so the
  // popup keeps the floor height and the media sits at the top of its column with the
  // column's surface filling the remainder below it. A portrait taller than the floor
  // makes the popup as tall as the media. See docs/layout-overhaul/layout-decisions.md.
  const COMMENT_PANE_WIDTH = 372;
  const POPUP_HEIGHT_CAP = 'min(88vh, 820px)';
  const POPUP_MIN_HEIGHT = 'min(85vh, 668px)';
  const MEDIA_MAX_WIDTH = 620;
  const mediaMaxWidth = `min(${MEDIA_MAX_WIDTH}px, calc(100vw - 32px - ${COMMENT_PANE_WIDTH}px))`;
  const mediaHeight = `min(${POPUP_HEIGHT_CAP}, calc(${mediaMaxWidth} / ${A}))`;
  const mediaWidth = `calc(${mediaHeight} * ${A})`;
  const popupHeight = `max(${mediaHeight}, ${POPUP_MIN_HEIGHT})`;
  const twoPaneContainerWidth = `calc(${mediaWidth} + ${COMMENT_PANE_WIDTH}px)`;
  const comments = commentsResponse?.pages?.flatMap((page) => extractPageContent(page)) || [];

  // Once the comments are loaded, scroll the notification's target comment into
  // view and flash it briefly. It fires once per target. A comment that is a reply
  // or sits on a later page is not in the DOM yet, so the post still opens and the
  // flash is simply skipped rather than forced.
  useEffect(() => {
    if (!highlightCommentId || commentsLoading) return;
    if (flashedCommentRef.current === highlightCommentId) return;
    const pane = commentsPaneRef.current;
    const row = pane?.querySelector(`[data-comment-id="${highlightCommentId}"]`);
    if (!row) return;
    flashedCommentRef.current = highlightCommentId;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const flashTarget = row.firstElementChild || row;
    flashTarget.classList.add('lx-comment-flash');
    const timer = setTimeout(() => flashTarget.classList.remove('lx-comment-flash'), 2200);
    return () => clearTimeout(timer);
  }, [highlightCommentId, commentsLoading, comments.length]);

  // Read from the query data, exactly as this file already does for comment
  // like state a few hundred lines above. The previous local copies started at
  // false and only the count was ever synced, so a post the viewer had already
  // liked opened showing an empty heart.
  const liked = Boolean(post.isLiked ?? post.viewerState?.isLiked);
  const likeCount = post.likeCount ?? 0;

  useEffect(() => {
    // Clears user-entered draft and reply state when navigating to a different post.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReplyingTo(null);
    setCommentDraft('');
  }, [postId]);

  useEffect(() => {
    if (!replyingTo) return;
    commentInputRef.current?.focus();
  }, [replyingTo]);

  useBodyScrollLock(overlay, location.state?.backgroundScrollY);

  const closePost = () => navigate(-1);
  // The post detail is a route overlay rather than an LxModal, so it did not
  // inherit the shared Escape handling. Wire it here so Escape closes it like
  // every other overlay.
  useEscapeKey(overlay, closePost);

  const handleLikeToggle = useCallback(() => {
    setHeartBurst(false);
    window.requestAnimationFrame(() => setHeartBurst(true));
    likeMutation.mutate({ postId, liked });
  }, [likeMutation, liked, postId]);

  const handleFollowToggle = useCallback(() => {
    if (!targetUserId) return;
    if (following) {
      setUnfollowConfirmOpen(true);
      return;
    }
    follow.mutate(targetUserId);
  }, [follow, following, targetUserId]);

  const handleUnfollowConfirm = useCallback(() => {
    if (!targetUserId) return;
    unfollow.mutate(targetUserId, { onSuccess: () => setUnfollowConfirmOpen(false) });
  }, [targetUserId, unfollow]);

  const handleEditOpen = useCallback(() => {
    setEditCaption(post?.caption || post?.text || '');
    setEditError('');
    setEditSheetOpen(true);
  }, [post.caption, post.text]);

  const handleEditSubmit = () => {
    if (updatePost.isPending) return;
    setEditError('');
    updatePost.mutate(
      { postId, data: { caption: editCaption } },
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

  const handleDeleteRequest = useCallback(() => {
    setDeleteConfirmOpen(true);
  }, []);

  const handleDeleteConfirm = () => {
    deletePost.mutate(postId, {
      onSuccess: () => {
        toast('post deleted');
        navigate(-1);
      },
    });
    setDeleteConfirmOpen(false);
  };

  const handleBlockConfirm = () => {
    if (!targetUserId) return;
    block.mutate(targetUserId, {
      onSuccess: () => {
        toast(`blocked @${authorHandle}`);
        setBlockModalOpen(false);
        navigate(-1);
      },
    });
  };

  const handleCommentSubmit = () => {
    const value = commentDraft.trim();
    if (!value) return;

    createComment.mutate(
      // A reply is attached to the thread root, so every reply is one level deep.
      // The @mention it may carry is what tells the specific person they were
      // answered.
      { parentId: replyingTo?.parentId ?? null, content: value },
      {
        onSuccess: () => {
          setCommentDraft('');
          setCommentEmojiOpen(false);
          setReplyingTo(null);
          window.requestAnimationFrame(() => {
            if (commentsPaneRef.current) {
              commentsPaneRef.current.scrollTo({
                top: commentsPaneRef.current.scrollHeight,
                behavior: 'smooth',
              });
            }
          });
        },
      }
    );
  };

  const handleReplySelect = (reply) => {
    setReplyingTo(reply);
    // Replying to a reply prefills an editable @mention of its author, so the
    // person answered is tagged and notified. Replying to a top-level comment
    // carries no tag. An existing tag is not stacked on top of another.
    if (reply.mentionUsername) {
      // Replace any leading @tag from a previous target rather than stacking one.
      setCommentDraft((current) => `@${reply.mentionUsername} ${current.replace(/^@\S+\s+/, '')}`);
    }
    window.requestAnimationFrame(() => commentInputRef.current?.focus());
  };

  const menuItems = useMemo(
    () => [
      { id: 'like', icon: 'heart', label: liked ? 'Unlike' : 'Like', onClick: handleLikeToggle },
      {
        id: 'share',
        icon: 'share',
        label: 'Share',
        onClick: () => setShareOpen(true),
      },
      {
        id: 'copy',
        icon: 'link',
        label: 'Copy link',
        onClick: () =>
          copyPostLink(postId)
            .then(() => toast('link copied'))
            .catch(() => {}),
      },
      ...(isSelf
        ? [
            {
              id: 'edit',
              icon: 'edit',
              label: 'Edit post',
              onClick: handleEditOpen,
            },
            {
              id: 'delete',
              icon: 'trash',
              label: 'Delete post',
              tone: 'danger',
              separator: true,
              onClick: handleDeleteRequest,
            },
          ]
        : []),
      // Kept off the viewer's own post, where the server refuses the report with
      // REPORT_SELF_NOT_ALLOWED and the action could never succeed.
      ...(isSelf
        ? []
        : [
            {
              id: 'view-profile',
              icon: 'profile',
              label: "View author's profile",
              onClick: () => targetUserId && navigate(routeTo.userProfile(targetUserId)),
            },
            {
              id: 'follow-toggle',
              icon: following ? 'userMinus' : 'profile',
              label: `${following ? 'Unfollow' : 'Follow'} @${authorHandle}`,
              tone: following ? 'danger' : undefined,
              separator: true,
              onClick: handleFollowToggle,
              disabled: follow.isPending || unfollow.isPending,
            },
            {
              id: 'block',
              icon: 'ban',
              label: `Block @${authorHandle}`,
              tone: 'danger',
              onClick: () => setBlockModalOpen(true),
            },
            // hasReported is true exactly when a new report would be refused as
            // a duplicate, and a report never reverses, so the row states what
            // happened instead of offering an action that cannot succeed.
            post.hasReported
              ? { id: 'report', icon: 'flag', label: 'Reported', separator: true, readOnly: true }
              : {
                  id: 'report',
                  icon: 'flag',
                  label: 'Report',
                  tone: 'danger',
                  separator: true,
                  onClick: () =>
                    setPostReportTarget({
                      entityType: REPORT_TYPES.POST,
                      entityId: postId,
                      author: authorName,
                      text: post.caption,
                      avatarUrl: authorAvatarUrl,
                    }),
                },
          ]),
    ],
    [
      authorAvatarUrl,
      authorHandle,
      authorName,
      follow.isPending,
      following,
      handleDeleteRequest,
      handleEditOpen,
      handleFollowToggle,
      handleLikeToggle,
      isSelf,
      liked,
      navigate,
      post.caption,
      post.hasReported,
      postId,
      targetUserId,
      unfollow.isPending,
    ]
  );

  if (isLoading) {
    return (
      <div
        style={{
          position: overlay ? 'fixed' : 'relative',
          inset: overlay ? 0 : 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: v.ink3,
        }}
      >
        loading post...
      </div>
    );
  }

  if (isError || !postId) {
    return (
      <div
        style={{
          position: overlay ? 'fixed' : 'relative',
          inset: overlay ? 0 : 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: v.error,
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <LxIcon name="explore" size={32} color={v.error} />
        <div>post not found</div>
      </div>
    );
  }

  const commentColumn = (
    <div
      style={{
        height: '100%',
        minWidth: 0,
        flex: 1,
        background: v.base,
        display: 'grid',
        gridTemplateRows: 'auto auto minmax(0, 1fr) auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px 8px' }}>
        <div
          onClick={() => targetUserId && navigate(routeTo.userProfile(targetUserId))}
          style={{ cursor: targetUserId ? 'pointer' : 'default', display: 'flex' }}
        >
          <LxAvatar size={32} src={authorAvatarUrl} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <LxVerifiedName
            name={authorName}
            verified={author.isVerified}
            category={author.verifiedCategory}
            size={14}
            onClick={targetUserId ? () => navigate(routeTo.userProfile(targetUserId)) : undefined}
            textStyle={{
              fontFamily: v.fontBody,
              fontSize: 13.5,
              fontWeight: 600,
              color: v.ink,
              lineHeight: 1.15,
            }}
          />
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="lx-header-icon-btn"
          style={{
            width: 24,
            height: 24,
            marginTop: 2,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <LxIcon name="more" size={14} color={v.ink3} />
        </button>
        <button
          type="button"
          onClick={closePost}
          className="lx-header-icon-btn"
          style={{
            width: 24,
            height: 24,
            marginTop: 2,
            marginLeft: 2,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <LxIcon name="close" size={14} color={v.ink3} />
        </button>
      </div>

      <div style={{ padding: '0 14px 10px' }}>
        <div
          style={{
            fontFamily: v.fontBody,
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.42,
            color: v.ink,
            letterSpacing: '-0.01em',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          <CaptionText text={post.caption} />
        </div>
        {tags.length > 0 ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {tags.map((tag) => (
              <LxTag key={tag} size="sm">
                #{tag}
              </LxTag>
            ))}
          </div>
        ) : null}
      </div>

      <div
        ref={commentsPaneRef}
        style={{
          minHeight: 0,
          overflowY: 'auto',
          padding: '16px 16px 0',
          scrollBehavior: 'smooth',
        }}
      >
        {/* In two panes the media lives in the fixed left pane and does not scroll.
            Stacked (narrow) and text posts keep it inline above the comments. */}
        {!twoPane && mediaList.length > 0 ? (
          <div style={{ padding: '16px 0', borderBottom: `1px solid ${v.borderSubtle}` }}>
            <PostMedia post={post} radius={14} />
          </div>
        ) : null}

        {commentsLoading ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              fontFamily: v.fontMono,
              fontSize: 12,
              color: v.ink3,
            }}
          >
            loading comments...
          </div>
        ) : commentsError ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              fontFamily: v.fontBody,
              fontSize: 13,
              color: v.error,
            }}
          >
            we couldn't load comments. try again.
          </div>
        ) : comments.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              fontFamily: v.fontMono,
              fontSize: 12,
              color: v.ink3,
            }}
          >
            no comments yet.
          </div>
        ) : (
          comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              onReply={handleReplySelect}
              postId={postId}
            />
          ))
        )}
        {hasNextComments ? (
          <button
            type="button"
            onClick={() => fetchNextComments()}
            disabled={isFetchingNextComments}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              padding: '12px 0',
              cursor: 'pointer',
              fontFamily: v.fontMono,
              fontSize: 11,
              color: v.ink3,
            }}
          >
            {isFetchingNextComments ? 'loading more...' : 'load more comments'}
          </button>
        ) : null}
      </div>

      <div style={{ borderTop: `1px solid ${v.borderSubtle}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '10px 16px 6px' }}>
          <button
            type="button"
            onClick={handleLikeToggle}
            className={`lx-heart-button ${heartBurst ? 'is-liked' : ''}`}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span className="lx-heart-icon" style={{ display: 'inline-flex' }}>
              <LxIcon name="heart" size={22} color={liked ? HEART_COLOR : v.ink3} filled={liked} />
            </span>
            <span
              style={{ fontFamily: v.fontMono, fontSize: 12, color: liked ? HEART_COLOR : v.ink3 }}
            >
              {likeCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => commentInputRef.current?.focus()}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <LxIcon name="chat" size={21} color={v.ink3} />
            <span style={{ fontFamily: v.fontMono, fontSize: 12, color: v.ink3 }}>
              {post.commentCount ?? comments.length ?? 0}
            </span>
          </button>
          <button
            type="button"
            // The only control in this row with no text beside its glyph, so it
            // is the only one with no accessible name to take from its content.
            aria-label="share post"
            onClick={() => setShareOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <LxIcon name="share" size={20} color={v.ink3} />
          </button>
        </div>

        {replyingTo ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '8px 14px 7px',
              borderBottom: `1px solid ${v.borderSubtle}`,
              background: 'color-mix(in srgb, var(--lx-accent) 14%, var(--lx-surface))',
              fontFamily: v.fontMono,
              fontSize: 11,
              lineHeight: 1.35,
              color: v.accentText,
              minWidth: 0,
              maxWidth: '100%',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                minWidth: 0,
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
              }}
            >
              <span
                style={{
                  flexShrink: 1,
                  minWidth: 0,
                  maxWidth: '45%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.35,
                }}
              >
                ↩ replying to @{replyingTo.author}
              </span>
              <span
                style={{
                  color: v.ink2,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-all',
                }}
              >
                {replyingTo.text}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.14)',
                border: 'none',
                color: v.ink3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 11,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ) : null}

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px 12px',
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'visible',
            boxSizing: 'border-box',
          }}
        >
          {commentEmojiOpen ? (
            <div
              style={{
                position: 'absolute',
                left: viewport === 'mobile' ? 12 : 54,
                bottom: 'calc(100% + 8px)',
                width: 300,
                maxWidth: 'calc(100vw - 32px)',
                borderRadius: 12,
                border: `1px solid ${v.borderSubtle}`,
                background: v.surface,
                boxShadow: v.shadowSoft,
                zIndex: 4,
                overflow: 'visible',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: viewport === 'mobile' ? 22 : 66,
                  bottom: -7,
                  width: 14,
                  height: 14,
                  background: v.surface,
                  borderRight: `1px solid ${v.borderSubtle}`,
                  borderBottom: `1px solid ${v.borderSubtle}`,
                  transform: 'rotate(45deg)',
                }}
              />
              <div
                style={{
                  padding: 8,
                  borderBottom: `1px solid ${v.borderSubtle}`,
                }}
              >
                <div
                  style={{
                    height: 32,
                    borderRadius: 8,
                    background: v.surfaceSunken,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 10px',
                  }}
                >
                  <LxIcon name="explore" size={14} color={v.ink3} />
                  <input
                    type="search"
                    value={commentEmojiSearch}
                    onChange={(event) => setCommentEmojiSearch(event.target.value)}
                    placeholder="search emoji"
                    aria-label="search emoji"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      color: v.ink,
                      fontFamily: v.fontBody,
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  maxHeight: 214,
                  overflowY: 'auto',
                  padding: '8px 10px 10px',
                }}
              >
                {visibleCommentEmojiGroups.length ? (
                  visibleCommentEmojiGroups.map((group) => (
                    <section
                      key={group.label}
                      ref={(node) => {
                        commentEmojiGroupRefs.current[group.label] = node;
                      }}
                      style={{ marginBottom: 14 }}
                    >
                      <div
                        style={{
                          fontFamily: v.fontBody,
                          fontSize: 12,
                          fontWeight: 700,
                          color: v.ink3,
                          marginBottom: 6,
                        }}
                      >
                        {group.label}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(8, 1fr)',
                          gap: 3,
                        }}
                      >
                        {group.icons.map(([emoji]) => (
                          <button
                            key={`${group.label}-${emoji}`}
                            type="button"
                            onClick={() => appendCommentEmoji(emoji)}
                            aria-label={`add ${emoji}`}
                            style={{
                              width: 28,
                              height: 28,
                              border: 'none',
                              borderRadius: 6,
                              background: 'transparent',
                              cursor: 'pointer',
                              fontFamily: COMMENT_EMOJI_FONT,
                              fontSize: 19,
                              lineHeight: 1,
                              padding: 0,
                            }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <div
                    style={{
                      padding: '24px 8px',
                      textAlign: 'center',
                      fontFamily: v.fontBody,
                      fontSize: 13,
                      color: v.ink3,
                    }}
                  >
                    no emoji found
                  </div>
                )}
              </div>
              <div
                style={{
                  borderTop: `1px solid ${v.borderSubtle}`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${COMMENT_EMOJI_GROUPS.length}, 1fr)`,
                  background: v.surface,
                  borderRadius: '0 0 12px 12px',
                  overflow: 'hidden',
                }}
              >
                {COMMENT_EMOJI_GROUPS.map((group) => (
                  <button
                    key={group.label}
                    type="button"
                    onClick={() => {
                      setCommentEmojiSearch('');
                      window.requestAnimationFrame(() => {
                        commentEmojiGroupRefs.current[group.label]?.scrollIntoView({
                          block: 'nearest',
                        });
                      });
                    }}
                    aria-label={group.label}
                    style={{
                      height: 32,
                      border: 'none',
                      borderRight: `1px solid ${v.borderSubtle}`,
                      background: 'transparent',
                      cursor: 'pointer',
                      fontFamily: COMMENT_EMOJI_FONT,
                      fontSize: 15,
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    {group.categoryIcon}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <LxAvatar size={30} src={currentUser?.avatarUrl} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: '100%',
                minWidth: 0,
                minHeight: 42,
                borderRadius: 22,
                border: `1px solid ${v.borderSubtle}`,
                background: v.surfaceSunken,
                display: 'grid',
                gridTemplateColumns: '32px minmax(0, 1fr) 32px',
                alignItems: 'end',
                gap: 6,
                padding: '4px 7px',
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setCommentEmojiOpen((open) => !open);
                  window.requestAnimationFrame(() => commentInputRef.current?.focus());
                }}
                aria-label="choose emoji"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'text',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <LxIcon name="smile" size={15} color={v.ink3} />
              </button>
              <textarea
                ref={commentInputRef}
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                wrap="soft"
                rows={1}
                maxLength={COMMENT_MAX_LENGTH}
                placeholder={replyingTo ? `reply to @${replyingTo.author}...` : 'add a comment...'}
                // A single line by default that grows with the text up to three
                // lines, then scrolls. Long comments wrap instead of running off.
                style={{
                  flex: 1,
                  minWidth: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: v.ink,
                  fontFamily: v.fontBody,
                  fontSize: 14,
                  resize: 'none',
                  lineHeight: '20px',
                  maxHeight: 70,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap',
                  padding: '6px 0',
                  display: 'block',
                }}
                onKeyDown={(event) => {
                  // Enter sends; Shift+Enter adds a line.
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleCommentSubmit();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleCommentSubmit}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  opacity: commentDraft.trim() ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <LxIcon name="send" size={17} color={v.accent} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const container = (
    <div
      style={{
        width: twoPane ? twoPaneContainerWidth : 'min(560px, calc(100vw - 32px))',
        maxWidth: 'calc(100vw - 32px)',
        height: twoPane ? popupHeight : 'min(82vh, 720px)',
        background: v.base,
        border: `1px solid ${v.border}`,
        borderRadius: 16,
        boxShadow: '0 24px 80px rgba(26,24,22,0.34)',
        overflow: 'hidden',
        display: 'flex',
      }}
    >
      {twoPane ? (
        <>
          {/* The media column is the media's own width, so the image fills it to both
              side edges with no letterbox. The image keeps its true ratio (minAspect 0)
              and is centred vertically; when the popup is taller than the image, the
              column's own surface fills evenly above and below rather than boxing it. */}
          <div
            style={{
              width: mediaWidth,
              height: '100%',
              flexShrink: 0,
              background: v.base,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: '100%', flexShrink: 0 }}>
              <PostMedia post={post} radius={0} minAspect={0} />
            </div>
          </div>
          <div
            style={{
              width: COMMENT_PANE_WIDTH,
              flexShrink: 0,
              borderLeft: `1px solid ${v.border}`,
              display: 'flex',
            }}
          >
            {commentColumn}
          </div>
        </>
      ) : (
        commentColumn
      )}
    </div>
  );

  return (
    <>
      {overlay ? (
        // The scrim is stronger than before so the open post holds attention and
        // the feed behind stops competing, without hiding it entirely. See
        // docs/layout-overhaul/motion-vocabulary.md.
        <div
          className="lx-scrim"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            background: 'rgba(10, 8, 6, 0.62)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={closePost}
        >
          <div className="lx-overlay-panel" onClick={(event) => event.stopPropagation()}>
            {container}
          </div>
        </div>
      ) : (
        container
      )}

      <LxDropdownMenu
        anchorRef={menuButtonRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={menuItems}
        width={182}
        zIndex={1605}
      />

      <ConfirmModal
        config={
          blockModalOpen
            ? {
                title: 'block user',
                // Wording carried over unchanged from the modal this replaces.
                // It was written against the backend's actual behaviour in an
                // earlier phase, so the migration must not reword it.
                message: (
                  <>
                    Are you sure you want to block <strong>{authorName}</strong>? They won&apos;t be
                    able to find your profile, posts or story on Luvax.
                    {block.isError ? (
                      <div
                        role="alert"
                        style={{
                          marginTop: 12,
                          fontFamily: v.fontMono,
                          fontSize: 11,
                          color: v.errorText,
                        }}
                      >
                        couldn&apos;t block this account. try again.
                      </div>
                    ) : null}
                  </>
                ),
                confirmLabel: 'block',
                confirmDisabled: block.isPending,
                onConfirm: handleBlockConfirm,
              }
            : null
        }
        onClose={() => setBlockModalOpen(false)}
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

      {isSelf ? (
        <LxModal
          open={editSheetOpen}
          onClose={() => {
            if (!updatePost.isPending) setEditSheetOpen(false);
          }}
          title="edit post"
          zIndex={1700}
          actions={
            <LxBtn variant="primary" onClick={handleEditSubmit} disabled={updatePost.isPending}>
              {updatePost.isPending ? 'saving...' : 'save changes'}
            </LxBtn>
          }
        >
          <textarea
            value={editCaption}
            onChange={(event) => setEditCaption(event.target.value)}
            maxLength={CHAR_LIMITS.caption}
            placeholder="write a caption..."
            style={{
              width: '100%',
              minHeight: 120,
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
              style={{ marginTop: 10, fontFamily: v.fontMono, fontSize: 11, color: v.errorText }}
            >
              {editError}
            </div>
          ) : null}
        </LxModal>
      ) : null}

      <ReportModal target={postReportTarget} onClose={() => setPostReportTarget(null)} />
      <PostShareDialog open={shareOpen} postId={postId} onClose={() => setShareOpen(false)} />
    </>
  );
}
