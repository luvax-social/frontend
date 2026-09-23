import { v } from '@/config/tokens';
import { LxBtn } from '../components/primitives';
import { useFollow } from '../hooks/useSocial';
import { appealPath } from '@/utils/appealEntry';
import { toast } from '../components/Toast';

/**
 * Inline row actions: "follow back" for a follow row the viewer does not yet follow, or
 * the appeal link for an appealable moderation row. `useFollow`'s own onMutate/onError
 * already snapshot and restore the relationship cache on failure (see useSocial.js), so
 * this component adds no optimistic logic of its own - it only surfaces the error toast.
 * @param {{item: object, navigate: (path: string) => void}} props
 */
export function NotificationActions({ item, navigate }) {
  const follow = useFollow();

  if (item.type === 'follow' && item.relationship?.isFollowing === false) {
    return (
      <LxBtn
        type="button"
        variant="primary"
        size="sm"
        onClick={(event) => {
          event.stopPropagation();
          const actorId = item.actors?.[0]?.id;
          if (!actorId) return;
          follow.mutate(actorId, {
            onError: (error) => toast(error?.message || "couldn't follow back. try again."),
          });
        }}
      >
        follow back
      </LxBtn>
    );
  }

  if (
    item.category === 'system' &&
    item.moderation?.appealable &&
    item.moderation?.appealActionId
  ) {
    return (
      <button
        type="button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
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
          navigate(appealPath(item.moderation.appealActionId));
        }}
      >
        appeal this decision
      </button>
    );
  }

  return null;
}
