import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { v } from '@/config/tokens';
import { extractPageContent, getDisplayName, getUserSummary } from '@/utils/helpers';
import { LxIcon, LxAvatar, LxBtn } from './primitives';
import {
  usePendingFollowRequests,
  useApproveFollowRequest,
  useRejectFollowRequest,
} from '../hooks/useSocial';
import { useNotifications, useMarkAllAsRead } from '../hooks/useNotifications';
import { useRelativeTime } from '../hooks/useRelativeTime';
import { useOverlayNavigate } from '../hooks/useOverlayNavigate';
import { routeTo } from '@/config/constants';
// Shared with the warning on the settings screen. It lives in src/utils rather than in
// either slice because both read it, and a feature must not import another's internals.
import { CONTENT_REMOVAL_TYPES, appealPath, appealableActionId } from '@/utils/appealEntry';
import { toast } from './Toast';
import { LxVerifiedName } from '@/components/ui/lx-verified-badge';

// Keyed on the notification_type enum values the backend actually sends.
// The previous mapping tested for 'like' and 'comment', which are not members
// of that enum, so every row fell through to the generic wording.
const NOTIFICATION_TEXT = {
  like_post: 'liked your post',
  like_comment: 'liked your comment',
  comment_post: 'commented on your post',
  reply_comment: 'replied to your comment',
  follow: 'started following you',
  follow_request: 'requested to follow you',
  mention_post: 'mentioned you in a post',
  mention_comment: 'mentioned you in a comment',
  story_view: 'viewed your story',
  message: 'sent you a message',
  post_removed: 'removed your post',
  comment_removed: 'removed your comment',
  story_removed: 'removed your story',
  message_removed: 'removed your message',
  report_post_removed: 'removed content you reported',
  post_restored: 'restored your post',
  report_dismissed: 'reviewed your report and took no action',
};

const TYPE_ICON = {
  like: 'heart',
  follow: 'profile',
  follow_request: 'profile',
  comment: 'reply',
  mention: 'hash',
  story: 'eye',
  moderation: 'flag',
};

const TYPE_COLOR = {
  like: v.error,
  follow: v.success,
  follow_request: v.success,
  comment: v.accent,
  mention: v.avatar2,
  story: v.avatar3,
  moderation: v.warningText,
};

// The maps above are keyed by category, but the backend sends full enum values
// (like_post, comment_post, reply_comment, ...). This collapses a value to its
// category so the row can use the per-type icon and colour it was ignoring.
function notifCategory(type) {
  if (!type) return 'like';
  // Before the prefix tests, deliberately. See CONTENT_REMOVAL_TYPES.
  if (CONTENT_REMOVAL_TYPES.has(type)) return 'moderation';
  if (type === 'follow_request') return 'follow_request';
  if (type.startsWith('follow')) return 'follow';
  if (type.startsWith('like')) return 'like';
  if (type.startsWith('comment') || type.startsWith('reply')) return 'comment';
  if (type.startsWith('mention')) return 'mention';
  if (type.startsWith('story')) return 'story';
  if (
    type === 'report_post_removed' ||
    type === 'post_restored' ||
    type === 'report_dismissed' ||
    type === 'warning'
  ) {
    return 'moderation';
  }
  return 'comment';
}

// Groups notifications by recency for the date-grouped view the design uses.
function notifBucket(createdAt) {
  const then = new Date(createdAt);
  if (Number.isNaN(then.getTime())) return 'earlier';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = then.getTime();
  if (t >= startOfToday) return 'today';
  if (t >= startOfToday - 6 * 24 * 60 * 60 * 1000) return 'this week';
  return 'earlier';
}

function notificationMessageLabel(type) {
  if (type === 'report_dismissed') return 'decision';
  if (type === 'report_post_removed') return 'outcome';
  return 'reason';
}

function requestRowRequesterId(row, follower) {
  return row?.id || row?.requesterId || row?.followerId || follower?.id || null;
}

const BUCKET_ORDER = ['today', 'this week', 'earlier'];

function GroupHeading({ label }) {
  return (
    <div
      style={{
        fontFamily: v.fontMono,
        fontSize: 10,
        color: v.ink3,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        padding: '16px 16px 8px',
      }}
    >
      {label}
    </div>
  );
}

function NotifRow({ n, onAccept, onDecline, pendingRequestIds }) {
  const navigate = useNavigate();
  const openOverlay = useOverlayNavigate();
  // An enforcement notice records the platform acting, not a person, so it
  // carries no actor at all. Decided before the read so the absence is declared
  // rather than reported as contract drift.
  const isSystemModeration =
    CONTENT_REMOVAL_TYPES.has(n.type) ||
    n.type === 'report_post_removed' ||
    n.type === 'post_restored' ||
    n.type === 'report_dismissed';
  // NotificationResponse embeds the actor as a UserSummaryResponse. There is
  // no `n.actorId`, so no per-row profile fetch is needed.
  const actor = getUserSummary(n, 'actor', { optional: isSystemModeration });
  const timeStr = useRelativeTime(n.createdAt);

  const isFollow = n.type === 'follow' || n.type === 'follow_request';
  const text = NOTIFICATION_TEXT[n.type] ?? 'interacted with you';
  // Use the per-type icon and colour maps rather than collapsing every type to
  // two. A like is a filled heart in the error hue, a comment the accent reply
  // glyph, a mention the hash, a story the eye, a follow the profile mark.
  const category = notifCategory(n.type);
  const icon = TYPE_ICON[category] ?? 'heart';
  const color = TYPE_COLOR[category] ?? v.error;
  const filledBadge = category === 'like';

  const actorName = getDisplayName(actor, 'Someone');
  const pendingRequesterId =
    n.type === 'follow_request' && actor?.id && pendingRequestIds?.has(actor.id) ? actor.id : null;
  const appealActionId = appealableActionId(n);
  const displayName = isSystemModeration ? 'Luvax' : actorName;
  const avatarSrc = actor.avatarUrl;
  const canOpenTarget = !isSystemModeration;

  // Route by what the notification points at. A content notification now carries
  // postId, the post it concerns, so it opens that post directly. When the
  // notification is about a comment (entityType 'comment', entityId the comment),
  // the post detail is told to focus and briefly highlight that comment. Older
  // like-post notifications carried the post id in entityId with no postId, so
  // that path is kept. A follow or a content notification predating postId carries
  // no post to open and falls back to the actor's profile.
  const openTarget = () => {
    if (!canOpenTarget) {
      return;
    }
    if (n.postId) {
      const highlightComment = n.entityType === 'comment' ? n.entityId : null;
      openOverlay(
        routeTo.postDetail(n.postId),
        highlightComment ? { highlightComment } : undefined
      );
      return;
    }
    if (n.entityType === 'post' && n.entityId) {
      openOverlay(routeTo.postDetail(n.entityId));
      return;
    }
    if (actor?.id) {
      navigate(routeTo.userProfile(actor.id));
    }
  };
  const isClickable =
    canOpenTarget &&
    (Boolean(n.postId) || (n.entityType === 'post' && Boolean(n.entityId)) || Boolean(actor?.id));

  return (
    <div
      onClick={openTarget}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        background: !n.isRead ? 'var(--lx-accent-dim)' : 'transparent',
        cursor: isClickable ? 'pointer' : 'default',
        borderBottom: `1px solid ${v.borderSubtle}`,
        position: 'relative',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <LxAvatar size={40} src={avatarSrc} />
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: color,
            border: `2px solid var(--lx-base)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LxIcon name={icon} size={10} color={v.white} stroke={2} filled={filledBadge} />
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink, lineHeight: 1.4 }}>
          <LxVerifiedName
            name={displayName}
            verified={!isSystemModeration && actor.isVerified}
            category={actor.verifiedCategory}
            size={12}
            onClick={(e) => {
              e.stopPropagation();
              if (actor?.id) navigate(routeTo.userProfile(actor.id));
            }}
            textStyle={{ fontWeight: 600 }}
          />{' '}
          <span style={{ color: v.ink2 }}>{text}</span>
        </div>
        {n.message ? (
          <div style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2, marginTop: 4 }}>
            {notificationMessageLabel(n.type)}: {n.message}
          </div>
        ) : null}
        <div style={{ fontFamily: v.fontMono, fontSize: 10, color: v.ink3, marginTop: 4 }}>
          {timeStr}
        </div>
        {/* The in-product route to contest this removal. Before it existed the
            only way to appeal was a link inside the notice email, so a bounced
            or filtered email meant no route at all. stopPropagation because a
            system notice's row does not open anything, and this control must
            not be mistaken for one that does. */}
        {appealActionId ? (
          <button
            type="button"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              // The 44px touch target every other control on this screen keeps.
              minHeight: 44,
              padding: 0,
              border: 'none',
              background: 'none',
              fontFamily: v.fontBody,
              fontSize: 12,
              color: v.accentText,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              cursor: 'pointer',
            }}
            onClick={(event) => {
              event.stopPropagation();
              navigate(appealPath(appealActionId));
            }}
          >
            appeal this decision
          </button>
        ) : null}
      </div>

      {n.type === 'follow_request' && pendingRequesterId ? (
        <div style={{ display: 'flex', gap: 6, alignSelf: 'center', flexShrink: 0 }}>
          <LxBtn
            type="button"
            variant="primary"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onAccept?.(pendingRequesterId, {
                onError: (error) =>
                  toast(error?.message || "couldn't accept that follow request. try again."),
              });
            }}
          >
            accept
          </LxBtn>
          <LxBtn
            type="button"
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onDecline?.(pendingRequesterId, {
                onError: (error) =>
                  toast(error?.message || "couldn't decline that follow request. try again."),
              });
            }}
          >
            decline
          </LxBtn>
        </div>
      ) : null}
    </div>
  );
}

function RequestRow({ req, onAccept, onDecline }) {
  const navigate = useNavigate();
  // FollowRequestResponse names the requesting user `follower`.
  const user = getUserSummary(req, 'follower');
  const requesterId = requestRowRequesterId(req, user);
  const timeStr = useRelativeTime(req.createdAt);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        borderBottom: `1px solid ${v.borderSubtle}`,
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <LxAvatar size={40} src={user.avatarUrl} />
        <div
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: TYPE_COLOR['follow_request'],
            border: `2px solid var(--lx-base)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LxIcon name={TYPE_ICON['follow_request']} size={10} color={v.white} stroke={2} />
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, alignSelf: 'center' }}>
        <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink, lineHeight: 1.4 }}>
          <LxVerifiedName
            name={getDisplayName(user)}
            verified={user?.isVerified}
            category={user?.verifiedCategory}
            size={12}
            onClick={() => user?.id && navigate(routeTo.userProfile(user.id))}
            textStyle={{ fontWeight: 600 }}
          />{' '}
          <span style={{ color: v.ink2 }}>requested to follow you</span>
        </div>
        <div style={{ fontFamily: v.fontMono, fontSize: 10, color: v.ink3, marginTop: 4 }}>
          {timeStr}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, alignSelf: 'center', flexShrink: 0 }}>
        <LxBtn
          type="button"
          variant="primary"
          size="sm"
          onClick={() => {
            if (!requesterId) {
              toast("couldn't find that follow request. refresh and try again.");
              return;
            }
            onAccept(requesterId, {
              onError: (error) =>
                toast(error?.message || "couldn't accept that follow request. try again."),
            });
          }}
        >
          accept
        </LxBtn>
        <LxBtn
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!requesterId) {
              toast("couldn't find that follow request. refresh and try again.");
              return;
            }
            onDecline(requesterId, {
              onError: (error) =>
                toast(error?.message || "couldn't decline that follow request. try again."),
            });
          }}
        >
          decline
        </LxBtn>
      </div>
    </div>
  );
}

export function NotificationsScreen() {
  const [tab, setTab] = useState('all');

  const { data: requestsResponse, isLoading: isLoadingRequests } = usePendingFollowRequests();
  const approveReq = useApproveFollowRequest();
  const rejectReq = useRejectFollowRequest();

  const { data: notifsData, isLoading: isLoadingNotifs } = useNotifications();
  const markAllAsRead = useMarkAllAsRead();

  const requests = extractPageContent(requestsResponse);
  const pendingRequestIds = useMemo(() => {
    const ids = new Set();
    requests.forEach((request) => {
      const follower = getUserSummary(request, 'follower');
      const requesterId = requestRowRequesterId(request, follower);
      if (requesterId) ids.add(requesterId);
    });
    return ids;
  }, [requests]);

  const notifs = notifsData?.pages?.flatMap((page) => extractPageContent(page)) || [];

  useEffect(() => {
    if (tab === 'all') {
      markAllAsRead.mutate();
    }
  }, [tab]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${v.border}`,
          position: 'sticky',
          top: 0,
          background: v.base,
          zIndex: 5,
        }}
      >
        {['all', 'mentions', 'requests'].map((t) => (
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
              padding: '12px 0',
              borderBottom: tab === t ? `2px solid var(--lx-ink)` : '2px solid transparent',
              marginBottom: -1,
              position: 'relative',
            }}
          >
            {t}
            {t === 'requests' && requests.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 12,
                  right: '20%',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: v.accent,
                }}
              />
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
        {tab === 'requests' ? (
          isLoadingRequests ? (
            <div
              style={{
                padding: 20,
                textAlign: 'center',
                fontFamily: v.fontMono,
                fontSize: 12,
                color: v.ink3,
              }}
            >
              loading requests...
            </div>
          ) : requests.length > 0 ? (
            requests.map((r, i) => (
              <RequestRow
                key={i}
                req={r}
                onAccept={(id, options) => approveReq.mutate(id, options)}
                onDecline={(id, options) => rejectReq.mutate(id, options)}
              />
            ))
          ) : (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                fontFamily: v.fontMono,
                fontSize: 12,
                color: v.ink3,
              }}
            >
              no pending requests
            </div>
          )
        ) : isLoadingNotifs ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              fontFamily: v.fontMono,
              fontSize: 12,
              color: v.ink3,
            }}
          >
            loading notifications...
          </div>
        ) : notifs.length > 0 ? (
          BUCKET_ORDER.map((bucket) => {
            const rows = notifs.filter((n) => notifBucket(n.createdAt) === bucket);
            if (rows.length === 0) return null;
            return (
              <div key={bucket}>
                <GroupHeading label={bucket} />
                {rows.map((n, i) => (
                  <NotifRow
                    key={n.id || `${bucket}-${i}`}
                    n={n}
                    pendingRequestIds={pendingRequestIds}
                    onAccept={(id, options) => approveReq.mutate(id, options)}
                    onDecline={(id, options) => rejectReq.mutate(id, options)}
                  />
                ))}
              </div>
            );
          })
        ) : (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              fontFamily: v.fontMono,
              fontSize: 12,
              color: v.ink3,
            }}
          >
            no notifications yet
          </div>
        )}
      </div>
    </>
  );
}
