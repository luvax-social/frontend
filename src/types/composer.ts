export interface ComposerAttachment {
  id: string;
  file: File;
  previewUrl: string;
  isVideo: boolean;
  status: 'pending' | 'uploading' | 'done' | 'failed';
  progress: number;
  assetId: string | null;
  error: string | null;
}

export interface RenderableMedia {
  id?: string;
  cdnUrl?: string;
  altText?: string | null;
  mediaType?: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
}

export interface PostMediaSource {
  media?: RenderableMedia[] | null;
}
