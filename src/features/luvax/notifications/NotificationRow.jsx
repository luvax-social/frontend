import { v } from '@/config/tokens';
import { LxVerifiedName } from '@/components/ui/lx-verified-badge';
import { useRelativeTime } from '../hooks/useRelativeTime';
import { useMarkRead } from '../hooks/useNotifications';
import { notificationCopyParts } from './notificationCopy';
import { NotificationAvatarStack } from './NotificationAvatarStack';
import { NotificationPreview } from './NotificationPreview';
import { NotificationActions } from './NotificationActions';
import { hasNotificationAction } from './notificationActionKind';
import { resolveNotificationTarget } from './notificationTarget';

/**
 * One notification row. A button-role element with a visible focus ring (D15, fixing the
 * previous click-only div). Carries no per-row unread dot or overflow menu: read state is
 * conveyed by the avatar's category badge and the row's own content, tapping through marks
 * a navigable row read, and "mark all as read" in the screen header covers the rest.
 * @param {{item: object, navigate: (path: string) => void}} props
 */
export function NotificationRow({ item, navigate }) {
  const markRead = useMarkRead();
  const timeStr = useRelativeTime(item.activityAt);
  const { isSystem, actors, othersCount, phrase } = notificationCopyParts(item);
  const { path, isNavigable } = resolveNotificationTarget(item);
  const thumbnailUrl = item.preview?.media?.thumbnailUrl;

  const handleTap = () => {
    if (!isNavigable || !path) return;
    if (!item.isRead) {
      markRead.mutate(item.id);
    }
    navigate(path);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleTap}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleTap();
        }
      }}
      className="lx-focusable-row"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        cursor: isNavigable ? 'pointer' : 'default',
        borderBottom: `1px solid ${v.borderSubtle}`,
        position: 'relative',
      }}
    >
      <NotificationAvatarStack actors={actors} isSystem={isSystem} category={item.category} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: v.fontBody, fontSize: 14, color: v.ink, lineHeight: 1.4 }}>
          {isSystem ? (
            <span style={{ fontWeight: 600 }}>Luvax</span>
          ) : (
            actors.map((actor, index) => (
              <span key={actor.id ?? index}>
                {index > 0 && index === actors.length - 1 && othersCount === 0
                  ? ' and '
                  : index > 0
                    ? ', '
                    : ''}
                <LxVerifiedName
                  name={actor.displayName || actor.username || 'someone'}
                  verified={actor.isVerified}
                  category={actor.verifiedCategory}
                  size={12}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (actor.id) navigate(`/app/u/${actor.id}`);
                  }}
                  textStyle={{ fontWeight: 600 }}
                />
              </span>
            ))
          )}
          {othersCount > 0 ? ` and ${othersCount} others` : ''}{' '}
          <span style={{ color: v.ink2 }}>{phrase}.</span>{' '}
          <span
            style={{
              fontFamily: v.fontMono,
              fontSize: 10,
              color: v.ink3,
              whiteSpace: 'nowrap',
            }}
          >
            {timeStr}
          </span>
        </div>

        <NotificationPreview target={item.target} preview={item.preview} />

        {item.moderation?.reason ? (
          <div style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink2, marginTop: 4 }}>
            reason: {item.moderation.reason}
          </div>
        ) : null}
      </div>

      {hasNotificationAction(item) ? (
        <div
          onClick={(event) => event.stopPropagation()}
          style={{ flexShrink: 0, alignSelf: 'center' }}
        >
          <NotificationActions item={item} navigate={navigate} />
        </div>
      ) : null}

      {thumbnailUrl ? (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 6,
            flexShrink: 0,
            alignSelf: 'center',
            background: `url(${thumbnailUrl}) center/cover no-repeat`,
          }}
        />
      ) : null}
    </div>
  );
}
