import { useRef, useState } from 'react';
import { v } from '@/config/tokens';
import { LxVerifiedName } from '@/components/ui/lx-verified-badge';
import { LxIcon } from '../components/primitives';
import { useRelativeTime } from '../hooks/useRelativeTime';
import { useMarkRead } from '../hooks/useNotifications';
import { notificationCopyParts } from './notificationCopy';
import { NotificationAvatarStack } from './NotificationAvatarStack';
import { NotificationPreview } from './NotificationPreview';
import { NotificationActions } from './NotificationActions';
import { hasNotificationAction } from './notificationActionKind';
import { NotificationMenu } from './NotificationMenu';
import { resolveNotificationTarget } from './notificationTarget';

/**
 * One notification row. A button-role element with a visible focus ring (D15, fixing the
 * previous click-only div), rendering the unread state as a trailing accent dot rather
 * than a full-row tint (D18, whose contrast the tint broke in dark mode).
 * @param {{item: object, navigate: (path: string) => void}} props
 */
export function NotificationRow({ item, navigate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const markRead = useMarkRead();
  const timeStr = useRelativeTime(item.activityAt);
  const { isSystem, actors, othersCount, phrase } = notificationCopyParts(item);
  const { path, isNavigable } = resolveNotificationTarget(item);

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
      <NotificationAvatarStack actors={actors} isSystem={isSystem} />

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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          alignSelf: 'center',
        }}
      >
        {hasNotificationAction(item) ? (
          <div onClick={(event) => event.stopPropagation()}>
            <NotificationActions item={item} navigate={navigate} />
          </div>
        ) : null}
        {!item.isRead ? (
          <span
            aria-hidden="true"
            style={{ width: 8, height: 8, borderRadius: '50%', background: v.accent }}
          />
        ) : null}
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="notification options"
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen(true);
          }}
          style={{
            width: 44,
            height: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <LxIcon name="more" size={16} color={v.ink3} />
        </button>
        <NotificationMenu
          item={item}
          anchorRef={menuButtonRef}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />
      </div>
    </div>
  );
}
