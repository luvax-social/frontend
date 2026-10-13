import type { MessageMedia } from '../types';
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogg)(?:[?#].*)?$/i;

export const isVideoMessageMedia = (media: Partial<MessageMedia> | null | undefined) => {
  const mediaType = String(media?.mediaType || '').toUpperCase();
  if (mediaType === 'VIDEO') return true;

  const mimeType = String(media?.mimeType || media?.contentType || '').toLowerCase();
  if (mimeType.startsWith('video/')) return true;

  return VIDEO_EXTENSIONS.test(String(media?.cdnUrl || media?.url || ''));
};
