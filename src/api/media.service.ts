import type { ApiResponse } from '@/types/api';
import type {
  MediaAssetResponse,
  MediaUploadUrlResponse,
  MediaConstraintsResponse,
  MediaUploadCompleteRequest,
  MediaUploadUrlRequest,
} from '@/types/domain';
import { axiosClient } from './axiosClient';

const unwrap = <T>(payload: ApiResponse<T> | T): T => {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data)
    return payload.data as T;
  return payload as T;
};

const MEDIA_API_PATH = '/media';

export const mediaService = {
  /**
   * Request a pre-signed URL for direct upload
   * @param {Object} data - { mediaType: 'IMAGE' | 'VIDEO', mimeType: string, fileSize: number }
   * @returns {Promise<Object>} - The response data containing uploadUrl and storageKey
   */
  async createUploadUrl(
    data: Omit<MediaUploadUrlRequest, 'mediaType'> & {
      mediaType: MediaUploadUrlRequest['mediaType'] | Uppercase<MediaUploadUrlRequest['mediaType']>;
    }
  ) {
    const response = await axiosClient.post<
      ApiResponse<MediaUploadUrlResponse> | MediaUploadUrlResponse
    >(`${MEDIA_API_PATH}/upload`, data);
    return unwrap(response.data);
  },

  /**
   * Confirm the upload is complete
   * @param {Object} data - { storageKey: string, mediaType: 'IMAGE' | 'VIDEO', mimeType: string, fileSize: number, width: number, height: number, duration?: number }
   * @returns {Promise<Object>} - The response data containing the mediaAssetId
   */
  async completeUpload(
    data: Omit<MediaUploadCompleteRequest, 'mediaType'> & {
      mediaType:
        | MediaUploadCompleteRequest['mediaType']
        | Uppercase<MediaUploadCompleteRequest['mediaType']>;
    }
  ) {
    const response = await axiosClient.post<ApiResponse<MediaAssetResponse> | MediaAssetResponse>(
      `${MEDIA_API_PATH}/upload-complete`,
      data
    );
    return unwrap(response.data);
  },

  /**
   * Fetch the upload limits the server enforces.
   * @returns {Promise<Object>} - { acceptedImageMimeTypes: string[], acceptedVideoMimeTypes: string[], maxFileSizeBytes: number, maxVideoDurationSeconds: number }
   */
  async getConstraints() {
    const response = await axiosClient.get<
      ApiResponse<MediaConstraintsResponse> | MediaConstraintsResponse
    >(`${MEDIA_API_PATH}/constraints`);
    return unwrap(response.data);
  },
};
