import type { NotificationItemResponse } from '@/types/domain';
import type { NavigateFunction } from 'react-router-dom';
import { v } from '@/config/tokens';
import { LxBtn } from '../components/primitives';
import { useFollow } from '../hooks/useSocial';
import { appealPath } from '@/utils/appealEntry';
import { toast } from '../components/Toast';
import { ROUTES } from '@/config/constants';
import {
  useApproveTag,
  useCollaborationInvites,
  useRemoveTag,
  useRespondToCollaboration,
  useTagRequests,
} from '../hooks/usePostPeople';

/**
 * Inline row actions: "follow" for a follow row the viewer does not yet follow, or
 * the appeal link for an appealable moderation row. `useFollow`'s own onMutate/onError
 * already snapshot and restore the relationship cache on failure (see useSocial.js), so
 * this component adds no optimistic logic of its own - it only surfaces the error toast.
 * @param {{item: object, navigate: (path: string) => void}} props
 */
export function NotificationActions({
  item,
  navigate,
}: {
  item: NotificationItemResponse;
  navigate: NavigateFunction;
}) {
  const follow = useFollow();
  const postId = item.target?.postId ?? null;
  // The answer is read from the viewer's own waiting lists, so a request already answered from
  // another screen shows no buttons here instead of offering a second answer.
  const tagRequests = useTagRequests({ enabled: item.type === 'post_tag_request' });
  const invites = useCollaborationInvites({ enabled: item.type === 'post_collaboration_invite' });
  const approveTag = useApproveTag();
  const removeTag = useRemoveTag();
  const respond = useRespondToCollaboration();

  if (item.type === 'scheduled_post_failed' && postId) {
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
          navigate(`${ROUTES.COMPOSE}?draft=${postId}`);
        }}
      >
        open draft
      </button>
    );
  }

  if (item.type === 'post_tag_request' && postId) {
    const waiting = (tagRequests.data?.pages ?? [])
      .flatMap((page) => page.data.content)
      .filter((row) => row.postId === postId);
    if (waiting.length === 0) return null;
    const busy = approveTag.isPending || removeTag.isPending;
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <LxBtn
          type="button"
          size="sm"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            waiting.forEach((row) =>
              approveTag.mutate(
                { postId, tagId: row.tagId },
                { onError: () => toast("couldn't approve that tag. try again.") }
              )
            );
          }}
        >
          approve
        </LxBtn>
        <LxBtn
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            waiting.forEach((row) =>
              removeTag.mutate(
                { postId, tagId: row.tagId },
                { onError: () => toast("couldn't remove that tag. try again.") }
              )
            );
          }}
        >
          remove
        </LxBtn>
      </div>
    );
  }

  if (item.type === 'post_collaboration_invite' && postId) {
    const stillWaiting = (invites.data?.pages ?? [])
      .flatMap((page) => page.data.content)
      .some((row) => row.postId === postId);
    if (!stillWaiting) return null;
    const answer = (action: 'accept' | 'decline') =>
      respond.mutate(
        { postId, action },
        { onError: () => toast("couldn't send your answer. try again.") }
      );
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <LxBtn
          type="button"
          size="sm"
          disabled={respond.isPending}
          onClick={(event) => {
            event.stopPropagation();
            answer('accept');
          }}
        >
          accept
        </LxBtn>
        <LxBtn
          type="button"
          size="sm"
          variant="ghost"
          disabled={respond.isPending}
          onClick={(event) => {
            event.stopPropagation();
            answer('decline');
          }}
        >
          decline
        </LxBtn>
      </div>
    );
  }

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
            onError: (error) => toast(error?.message || "couldn't follow. try again."),
          });
        }}
      >
        follow
      </LxBtn>
    );
  }

  if (
    item.category === 'system' &&
    item.moderation?.appealable &&
    item.moderation?.appealActionId
  ) {
    const appealActionId = item.moderation.appealActionId;
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
          navigate(appealPath(appealActionId));
        }}
      >
        appeal this decision
      </button>
    );
  }

  return null;
}
