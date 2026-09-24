import { LxAvatar } from '@/components/ui/lx-avatar';
import { LxIcon } from '../components/primitives';
import { notificationTypeBadge } from './notificationTypeBadge';

/**
 * The row's leading avatar area: one or two overlapping avatars for an actor-bearing
 * row, or the Luvax mark for a system row (which never carries an actor - P1 section 4
 * deviation D6). A small category badge (heart, chat, follow-plus, eye) sits over the
 * bottom-right corner so the row's kind reads at a glance, without a system row (whose
 * avatar already is that signal).
 * @param {{actors: Array<{avatarUrl?: string}>, isSystem: boolean, category?: string, size?: number}} props
 */
export function NotificationAvatarStack({ actors, isSystem, category, size = 40 }) {
  if (isSystem) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--lx-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <img
          src="/luvax-mark.png"
          alt=""
          width={size * 0.55}
          height={size * 0.55}
          style={{ display: 'block' }}
        />
      </div>
    );
  }

  const visible = actors.slice(0, 2);
  const badge = notificationTypeBadge(category);
  const badgeSize = Math.round(size * 0.42);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ display: 'flex' }}>
        {visible.map((actor, index) => (
          <span
            key={actor.id ?? index}
            style={{
              marginLeft: index === 0 ? 0 : -10,
              border: index === 0 ? 'none' : '2px solid var(--lx-base)',
              borderRadius: '50%',
              display: 'inline-flex',
            }}
          >
            <LxAvatar size={size} src={actor.avatarUrl} />
          </span>
        ))}
      </div>
      {badge ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: badgeSize,
            height: badgeSize,
            borderRadius: '50%',
            background: badge.background,
            border: '2px solid var(--lx-base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LxIcon
            name={badge.icon}
            filled={badge.filled}
            size={Math.round(badgeSize * 0.55)}
            color={badge.color}
          />
        </span>
      ) : null}
    </div>
  );
}
