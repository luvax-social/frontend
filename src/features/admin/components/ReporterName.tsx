import { v } from '@/config/tokens';

import { shortId, useResolveUsername } from '../hooks/useResolveUsername';

/**
 * Renders a user id as its resolved username, and as a stable shortened id
 * while resolution is still in flight. The shortened id is honest: it is what
 * the reviewer would otherwise see, never a placeholder name. Resolution is
 * cached by id, so repeated ids across a list cost one request each.
 */
export function ReporterName({ userId, prefix = '' }: { userId?: string | null; prefix?: string }) {
  const { username, isLoading } = useResolveUsername(userId);

  if (username) {
    return (
      <span style={{ fontFamily: v.fontBody, color: v.ink }}>
        {prefix}
        {username}
      </span>
    );
  }

  return (
    <span
      style={{ fontFamily: v.fontMono, color: v.ink2, fontSize: '0.92em' }}
      title={userId ?? undefined}
    >
      {isLoading ? shortId(userId) + '...' : shortId(userId)}
    </span>
  );
}
