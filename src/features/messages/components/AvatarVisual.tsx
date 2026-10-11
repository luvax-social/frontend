interface Props {
  thread: { name?: string; avatarUrl?: string | null };
  size?: number;
}
import { v } from '@/config/tokens';
import { LxAvatar } from '@/components/ui/lx-avatar';

/**
 * A conversation's avatar.
 *
 * Renders the real avatar when the counterpart or group has one. Otherwise falls back to initials
 * derived from the name, on a neutral surface.
 *
 * The previous fixture carried `accent` and `idx` fields that chose a colour and a placeholder
 * image. Neither exists on the API, so both are gone rather than invented here.
 */
export function AvatarVisual({ thread, size = 34 }: Props) {
  if (thread?.avatarUrl) {
    return <LxAvatar size={size} src={thread.avatarUrl} />;
  }

  const initials = (thread?.name || '')
    .split(' ')
    .filter((item) => item !== null)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  if (!initials) {
    return <LxAvatar size={size} />;
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: v.surfaceRaised,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: v.ink,
        fontFamily: v.fontBody,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
