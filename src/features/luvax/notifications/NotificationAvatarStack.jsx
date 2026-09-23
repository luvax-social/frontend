import { LxAvatar } from '@/components/ui/lx-avatar';

/**
 * The row's leading avatar area: one or two overlapping avatars for an actor-bearing
 * row, or the Luvax mark for a system row (which never carries an actor - P1 section 4
 * deviation D6).
 * @param {{actors: Array<{avatarUrl?: string}>, isSystem: boolean, size?: number}} props
 */
export function NotificationAvatarStack({ actors, isSystem, size = 40 }) {
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

  return (
    <div style={{ display: 'flex', flexShrink: 0 }}>
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
  );
}
