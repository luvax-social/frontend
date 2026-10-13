import { v } from '@/config/tokens';

export const AVATAR_COLORS = [
  v.avatar0,
  v.avatar1,
  v.avatar2,
  v.avatar3,
  v.avatar4,
  v.avatar5,
  v.avatar6,
];

export function LxAvatar({
  size = 36,
  idx = 0,
  ring = false,
  hasStory = false,
  viewed = false,
  src = null,
}: {
  size?: number;
  idx?: number;
  ring?: boolean;
  hasStory?: boolean;
  viewed?: boolean;
  src?: string | null;
}) {
  const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const avatarCore = src
    ? {
        background: `url(${src}) center/cover no-repeat`,
      }
    : {
        background: color,
      };

  if (hasStory) {
    return (
      <div
        style={{
          width: size + 6,
          height: size + 6,
          borderRadius: '50%',
          padding: 2,
          background: viewed ? v.border : v.accent,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: `2px solid ${v.base}`,
            ...avatarCore,
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        outline: ring ? `2px solid ${v.accent}` : 'none',
        outlineOffset: ring ? 2 : 0,
        ...avatarCore,
      }}
    />
  );
}
