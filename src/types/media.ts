export type MediaType = 'image' | 'video';

export interface MediaAsset {
  id: string;
  userId: string;
  storageKey: string;
  cdnUrl: string;
  mediaType: MediaType;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  blurhash: string | null;
  createdAt: string;
}

export interface MediaUploadUrl {
  storageKey: string;
  uploadUrl: string;
  method: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}
