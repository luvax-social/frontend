import type { ReactNode } from 'react';
import { useState } from 'react';

import type { Post } from '@/types/social';
import type { PostMediaResponse } from '@/types/domain';
import { useAuthStore } from '@/store/useAuthStore';
import { getErrorMessage } from '@/utils/errors';

import { AltTextDialog } from './composer/AltTextDialog';
import { CollaboratorPicker } from './composer/CollaboratorPicker';
import { DialogShell } from './composer/DialogShell';
import { TagPeopleEditor } from './composer/TagPeopleEditor';
import { LxBtn } from './primitives';
import { toast } from './Toast';
import { useTransitionPost } from '../hooks/useDrafts';
import {
  useEditAltText,
  useRemoveTag,
  useReplaceCollaborators,
  useReplacePostTags,
  useRespondToCollaboration,
} from '../hooks/usePostPeople';
import { attachmentsFromPost, collaboratorsFromPost, tagsFromPost } from '../utils/composerContent';

/** The shape of a dropdown menu row, as the post menus already build it. */
export interface PostMenuItem {
  id: string;
  icon: string;
  label: string;
  onClick: () => void;
  separator?: boolean;
  tone?: 'danger';
}

type Dialog = 'alt' | 'people' | 'tags' | 'collaborators' | null;

/**
 * The menu rows and dialogs the post creation features add to a post, for whoever is looking.
 *
 * The author gets edit alt text, manage tags and collaborators, and archive. A person tagged on the
 * post gets "remove me from this post", which works whether the tag is approved or still waiting.
 * A co-author gets "leave this post". Each person sees only the rows that apply to them; the two
 * post menus append `items` to their own list and render `dialogs` once.
 *
 * Every write goes through a mutation that rolls its cache change back on failure, and a refused
 * save is shown where the person is looking rather than swallowed.
 */
export function usePostCreationActions(post: Post): { items: PostMenuItem[]; dialogs: ReactNode } {
  const viewerId = useAuthStore((state) => state.user?.id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const editAlt = useEditAltText();
  const replaceTags = useReplacePostTags();
  const replaceCollaborators = useReplaceCollaborators();
  const removeTag = useRemoveTag();
  const respond = useRespondToCollaboration();
  const transition = useTransitionPost();

  const media = (post.media ?? []) as PostMediaResponse[];
  const isOwner = Boolean(viewerId) && viewerId === post.author?.id;
  const published = post.status === 'published';
  const myTags = media.flatMap((item) =>
    (item.tags ?? []).filter((tag) => tag.user.id === viewerId).map((tag) => tag.id)
  );
  const isCoAuthor = (post.collaborators ?? []).some(
    (entry) => entry.user.id === viewerId && entry.status === 'accepted'
  );

  const items: PostMenuItem[] = [];

  if (isOwner && media.length > 0) {
    items.push({
      id: 'edit-alt',
      icon: 'alt',
      label: 'Edit alt text',
      onClick: () => setDialog('alt'),
    });
  }
  if (isOwner && published) {
    items.push({
      id: 'manage-people',
      icon: 'users',
      label: 'Manage tags and collaborators',
      onClick: () => setDialog('people'),
    });
    items.push({
      id: 'archive',
      icon: 'archive',
      label: 'Archive',
      onClick: () =>
        transition.mutate(
          { postId: post.id, status: 'archived' },
          {
            onSuccess: () =>
              toast('Post archived.', {
                action: {
                  label: 'undo',
                  onClick: () => transition.mutate({ postId: post.id, status: 'published' }),
                },
              }),
            onError: (error) => toast(getErrorMessage(error, "We couldn't archive that post.")),
          }
        ),
    });
  }
  if (!isOwner && myTags.length > 0) {
    items.push({
      id: 'remove-my-tag',
      icon: 'tag',
      label: 'Remove me from this post',
      separator: true,
      onClick: () =>
        myTags.forEach((tagId) =>
          removeTag.mutate(
            { postId: post.id, tagId },
            {
              onSuccess: () => toast('You were removed from this post.'),
              onError: (error) => toast(getErrorMessage(error, "We couldn't remove your tag.")),
            }
          )
        ),
    });
  }
  if (!isOwner && isCoAuthor) {
    items.push({
      id: 'leave-post',
      icon: 'users',
      label: 'Leave this post',
      separator: true,
      onClick: () =>
        respond.mutate(
          { postId: post.id, action: 'leave' },
          {
            onSuccess: () => toast('You left this post.'),
            onError: (error) => toast(getErrorMessage(error, "We couldn't do that.")),
          }
        ),
    });
  }

  const close = () => setDialog(null);
  const attachments = attachmentsFromPost(post as never);

  const dialogs = (
    <>
      {dialog === 'alt' ? (
        <AltTextDialog
          items={attachments.map((item) => ({
            key: item.id,
            src: item.previewUrl,
            isVideo: item.isVideo,
            altText: item.altText,
          }))}
          initialKey={attachments[0]?.id ?? ''}
          authorUsername={post.author?.username}
          onSave={async (key, altText) => {
            await editAlt.mutateAsync({ postId: post.id, postMediaId: key, altText });
          }}
          onClose={close}
        />
      ) : null}

      {dialog === 'people' ? (
        <DialogShell
          title="manage tags and collaborators"
          onClose={close}
          width={420}
          testId="manage-people"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <LxBtn
              variant="ghost"
              type="button"
              onClick={() => setDialog('tags')}
              disabled={attachments.every((item) => item.isVideo)}
            >
              tag people
            </LxBtn>
            <LxBtn variant="ghost" type="button" onClick={() => setDialog('collaborators')}>
              invite collaborators
            </LxBtn>
          </div>
        </DialogShell>
      ) : null}

      {dialog === 'tags' ? (
        <TagPeopleEditor
          attachments={attachments}
          tags={tagsFromPost(post as never)}
          onDone={(tags) =>
            replaceTags.mutate(
              {
                postId: post.id,
                tags: tags
                  .filter((tag) => attachments.some((item) => item.id === tag.attachmentId))
                  .map((tag) => ({
                    mediaPosition: attachments.findIndex((item) => item.id === tag.attachmentId),
                    userId: tag.user.id,
                    x: Number(tag.x.toFixed(4)),
                    y: Number(tag.y.toFixed(4)),
                  })),
              },
              {
                onSuccess: () => toast('Tags updated.'),
                onError: (error) => toast(getErrorMessage(error, "We couldn't update the tags.")),
              }
            )
          }
          onClose={close}
        />
      ) : null}

      {dialog === 'collaborators' ? (
        <CollaboratorPicker
          value={collaboratorsFromPost(post as never)}
          onDone={(users) =>
            replaceCollaborators.mutate(
              { postId: post.id, userIds: users.map((user) => user.id) },
              {
                onSuccess: () => toast('Collaborators updated.'),
                onError: (error) =>
                  toast(getErrorMessage(error, "We couldn't update the collaborators.")),
              }
            )
          }
          onClose={close}
        />
      ) : null}
    </>
  );

  return { items, dialogs };
}
