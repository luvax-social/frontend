import { v } from '@/config/tokens';
import { LxAvatar, LxIcon } from '../components/primitives';

/**
 * The pinned "follow requests" row. Rendered from state.followRequests (P1 section 4) -
 * never from a list row, per the approved wireframe's one change: a pending request is
 * not itself a notification row.
 * @param {{state: {followRequests: {count: number, capped: boolean, recent: Array<object>}}, onOpen: () => void}} props
 */
export function FollowRequestsEntry({ state, onOpen }) {
  const followRequests = state?.followRequests;
  if (!followRequests || followRequests.count === 0) return null;

  const recent = followRequests.recent ?? [];
  const label = followRequests.capped ? '99+' : String(followRequests.count);
  const names = recent.map((user) => user.displayName || user.username).filter(Boolean);
  const summary =
    names.length === 0
      ? `${label} pending`
      : names.length === 1 && followRequests.count === 1
        ? names[0]
        : `${names[0]} + ${followRequests.count - 1} others`;

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '12px 16px',
        border: 'none',
        borderBottom: `1px solid ${v.borderSubtle}`,
        background: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        minHeight: 44,
      }}
    >
      <div style={{ display: 'flex', flexShrink: 0 }}>
        {recent.slice(0, 2).map((user, index) => (
          <span
            key={user.id ?? index}
            style={{
              marginLeft: index === 0 ? 0 : -10,
              border: index === 0 ? 'none' : '2px solid var(--lx-base)',
              borderRadius: '50%',
              display: 'inline-flex',
            }}
          >
            <LxAvatar size={40} src={user.avatarUrl} />
          </span>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: v.fontBody, fontSize: 14, fontWeight: 600, color: v.ink }}>
          follow requests
        </div>
        <div style={{ fontFamily: v.fontBody, fontSize: 12, color: v.ink3 }}>{summary}</div>
      </div>
      <LxIcon name="chevronRight" size={16} color={v.ink3} />
    </button>
  );
}
