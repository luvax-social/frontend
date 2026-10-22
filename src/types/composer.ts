import type { PostMediaTagResponse, UserSummaryResponse } from './domain';

export interface ComposerAttachment {
  id: string;
  /** The picked file; null for an item that was uploaded in an earlier session of a draft. */
  file: File | null;
  previewUrl: string;
  isVideo: boolean;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  progress: number;
  assetId: string | null;
  error: string | null;
  /** What a screen reader announces for the item; empty means readers get the neutral label. */
  altText: string;
}

/** A person tagged on one attachment, positioned as fractions of the image. */
export interface ComposerTag {
  id: string;
  attachmentId: string;
  user: UserSummaryResponse;
  x: number;
  y: number;
}

export interface RenderableMedia {
  id?: string;
  cdnUrl?: string;
  altText?: string | null;
  /** People tagged on this item as the viewer may see them. */
  tags?: PostMediaTagResponse[];
  mediaType?: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
}

export interface PostMediaSource {
  media?: RenderableMedia[] | null;
  /** Names the author in the label a screen reader gets for media with no alt text. */
  author?: { username?: string | null } | null;
}
