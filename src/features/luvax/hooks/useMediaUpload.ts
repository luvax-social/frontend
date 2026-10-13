import { getErrorCode } from '@/utils/captchaErrors';
import { useState, useCallback } from 'react';
import axios from 'axios';
import { mediaService } from '@/api/media.service';

/**
 * Turns a failed upload into copy that says what to do next.
 *
 * Registration now verifies the object against storage, so it can refuse an
 * upload that did not arrive intact. None of these outcomes is permanent: the
 * same file can be sent again, so every one of them keeps the composer's
 * selection and invites a retry rather than reading as a dead end.
 */
const describeMediaUploadError = (err: unknown) => {
  switch (getErrorCode(err)) {
    case 'MEDIA_OBJECT_NOT_UPLOADED':
      return "your file didn't finish uploading. try again.";
    case 'MEDIA_OBJECT_METADATA_MISMATCH':
      return 'your file changed while it was uploading. try again.';
    case 'MEDIA_STORAGE_UNAVAILABLE':
    case 'MEDIA_STORAGE_NOT_CONFIGURED':
    case 'MEDIA_CDN_NOT_CONFIGURED':
      return "media storage can't be reached right now. try again in a moment.";
    case 'MEDIA_INVALID_METADATA':
      return "we couldn't read that file. try a different one.";
    default:
      return "we couldn't upload your media. try again.";
  }
};

export const useMediaUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  /**
   * Calculate dimensions (and duration) of a file before uploading
   */
  const getMediaMetadata = (file: File) => {
    return new Promise<{ width: number; height: number; duration?: number }>((resolve, reject) => {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);

      if (isVideo) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          resolve({
            width: video.videoWidth,
            height: video.videoHeight,
            duration: Math.round(video.duration),
          });
        };
        video.onerror = () => reject(new Error('Failed to load video metadata'));
        video.src = url;
      } else {
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve({
            width: img.width,
            height: img.height,
          });
        };
        img.onerror = () => reject(new Error('Failed to load image metadata'));
        img.src = url;
      }
    });
  };

  /**
   * Main upload function
   */
  const uploadMedia = useCallback(
    async (file: File, { onProgress }: { onProgress?: (progress: number) => void } = {}) => {
      setIsUploading(true);
      setProgress(0);
      setError(null);

      try {
        const isVideo = file.type.startsWith('video/');
        const mediaType = isVideo ? 'VIDEO' : 'IMAGE';

        // 1. Get metadata (width, height, duration)
        const metadata = await getMediaMetadata(file);

        // 2. Request pre-signed URL
        const { uploadUrl, storageKey } = await mediaService.createUploadUrl({
          mediaType,
          mimeType: file.type,
          fileSize: file.size,
        });

        // 3. Direct upload to R2/S3 via PUT using raw axios to avoid interceptor auth headers
        await axios.put(uploadUrl, file, {
          headers: {
            'Content-Type': file.type,
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setProgress(percentCompleted);
              // Several files can be in flight at once, and a single piece of
              // hook state cannot describe more than one of them. The caller
              // tracks each file's own progress through this callback.
              if (onProgress) onProgress(percentCompleted);
            }
          },
        });

        // 4. Confirm upload
        const response = await mediaService.completeUpload({
          storageKey,
          mediaType,
          mimeType: file.type,
          fileSize: file.size,
          width: metadata.width,
          height: metadata.height,
          duration: metadata.duration || null,
        });

        setIsUploading(false);
        setProgress(100);
        return response; // Contains the mediaAssetId and other details
      } catch (err) {
        const message = describeMediaUploadError(err);
        setError(message);
        setIsUploading(false);
        setProgress(0);
        // Re-thrown carrying the resolved copy so the composer can show the
        // specific reason without repeating the mapping.
        if (err && (typeof err === 'object' || typeof err === 'function')) {
          Object.assign(err, { uploadMessage: message });
        }
        throw err;
      }
    },
    []
  );

  return {
    uploadMedia,
    // Exposed because the composer must know a video's duration before it
    // uploads: the server bounds only the number the client declares, so an
    // unmeasured file is an unchecked file.
    getMediaMetadata,
    isUploading,
    progress,
    error,
  };
};
