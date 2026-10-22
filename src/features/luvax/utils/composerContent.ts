import type { ComposerAttachment, ComposerTag } from '@/types/composer';
import type { PlaceSummaryResponse, PostResponse, UpdatePostContentRequest } from '@/types/domain';
import type { UserSummaryResponse } from '@/types/domain';

import { derivePostType } from './composerMedia';

/** Everything the composer holds that a post is made of. */
export interface ComposerSnapshot {
  caption: string;
  items: ComposerAttachment[];
  place: PlaceSummaryResponse | null;
  tags: ComposerTag[];
  collaborators: UserSummaryResponse[];
}

/**
 * Builds the content of a post from the composer, once every attachment has an uploaded asset.
 *
 * The same body serves creating a post and replacing a draft, because the replacement endpoint takes
 * the complete composer state. Alt text is sent per item and blank text is omitted, so an item the
 * author left empty is stored empty and readers get the neutral label. Each tag names its image by
 * position in the list sent in the same request, since an image has no stored id yet. A video cannot
 * carry tags, so a tag whose attachment is not a photo is left out.
 *
 * @param snapshot the composer state
 * @param assetIds the uploaded asset id of each attachment, by attachment id
 * @returns the request body, or null when an attachment has no asset yet
 */
export function buildContentRequest(
  snapshot: ComposerSnapshot,
  assetIds: ReadonlyMap<string, string | null>
): UpdatePostContentRequest | null {
  const { items, caption, place, tags, collaborators } = snapshot;
  const media: NonNullable<UpdatePostContentRequest['media']> = [];
  for (const item of items) {
    const mediaId = assetIds.get(item.id);
    if (!mediaId) return null;
    const altText = item.altText.trim();
    media.push(altText ? { mediaId, altText } : { mediaId });
  }

  const positionOf = new Map(items.map((item, index) => [item.id, index]));
  const photoIds = new Set(items.filter((item) => !item.isVideo).map((item) => item.id));
  const placed = tags.filter(
    (tag) => photoIds.has(tag.attachmentId) && positionOf.has(tag.attachmentId)
  );

  const postType = derivePostType(items);
  return {
    caption: postType === 'TEXT' ? caption.trim() : caption,
    postType,
    ...(media.length > 0 ? { media } : {}),
    ...(place ? { placeId: place.id } : {}),
    tags: placed.map((tag) => ({
      mediaPosition: positionOf.get(tag.attachmentId)!,
      userId: tag.user.id,
      x: Number(tag.x.toFixed(4)),
      y: Number(tag.y.toFixed(4)),
    })),
    collaboratorIds: collaborators.map((user) => user.id),
  };
}

/**
 * Turns the media of a stored post back into composer attachments.
 *
 * An item already uploaded has no file in this session: it keeps its asset id, shows its CDN
 * address as the preview and is marked done, so resuming a draft never uploads anything again. The
 * attachment id is the stored media id, which is what tags are matched against below.
 */
export function attachmentsFromPost(post: PostResponse): ComposerAttachment[] {
  return (post.media ?? []).map((item) => ({
    id: item.id,
    file: null,
    previewUrl: item.cdnUrl,
    isVideo: item.mediaType === 'video',
    status: 'done' as const,
    progress: 100,
    assetId: item.mediaAssetId,
    error: null,
    altText: item.altText ?? '',
  }));
}

/** The tags of a stored post, as the composer holds them. */
export function tagsFromPost(post: PostResponse): ComposerTag[] {
  return (post.media ?? []).flatMap((item) =>
    (item.tags ?? []).map((tag) => ({
      id: tag.id,
      attachmentId: item.id,
      user: tag.user,
      x: Number(tag.x),
      y: Number(tag.y),
    }))
  );
}

/** The invited co-authors of a stored post, accepted or still waiting. */
export function collaboratorsFromPost(post: PostResponse): UserSummaryResponse[] {
  return (post.collaborators ?? []).map((entry) => entry.user);
}
