/** The slice of a media item the alt label needs. */
export interface AltMediaSource {
  altText?: string | null;
  mediaType?: string | null;
}

/** The slice of an author the alt label names. */
export interface AltAuthorSource {
  username?: string | null;
}

/**
 * The text a screen reader announces for one media item of a post.
 *
 * The author's own alt text wins whenever it holds anything. Without it, readers get a neutral
 * label the client builds, never an empty string and never the file name: the media kind, the
 * position when the post holds several items, and the author. `Photo by @an`, `Video by @an`,
 * `Photo 2 of 4 by @an`.
 *
 * @param media the media item; only `altText` and `mediaType` are read
 * @param index zero-based position of the item in the post
 * @param count how many items the post holds
 * @param author the post author; omitted from the label when it has no username
 */
export function mediaAltLabel(
  media: AltMediaSource | null | undefined,
  index: number,
  count: number,
  author?: AltAuthorSource | null
): string {
  const authored = media?.altText?.trim();
  if (authored) return authored;

  const kind = media?.mediaType === 'video' ? 'Video' : 'Photo';
  const position = count > 1 ? ` ${index + 1} of ${count}` : '';
  const by = author?.username ? ` by @${author.username}` : '';
  return `${kind}${position}${by}`;
}
