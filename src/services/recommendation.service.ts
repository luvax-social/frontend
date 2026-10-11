import type { ApiResponse, CursorParams, CursorPage } from '@/types/api';
import type { FeedPostResponse } from '@/types/domain';
import axiosInstance from './axiosInstance';

const RECOMMENDATIONS_API_PATH = '/recommendations';

/**
 * Retrieves one page of the personalized recommendation feed.
 *
 * `excludeFollowed` switches this to the discovery ("Explore") variant by
 * excluding posts from accounts the viewer already follows; omit or pass
 * false for the personalized "for you" feed with no such exclusion. See
 * RecommendationApi#getRecommendedFeed on the backend.
 * @param {Object} params
 * @param {string|null} [params.cursor] - Opaque cursor from the previous page.
 * @param {number} [params.limit] - Page size; the backend defaults to 20, caps at 100.
 * @param {boolean} [params.excludeFollowed] - Discovery variant when true.
 * @param {AbortSignal} [params.signal] - Cancels the request when the query is superseded.
 * @returns {Promise<Object>} ApiResponse<CursorPageResponse<FeedPostResponse>>.
 */
export const getRecommendedFeed = async ({
  cursor,
  limit,
  excludeFollowed,
  signal,
}: CursorParams & { excludeFollowed?: boolean } = {}) => {
  const params: CursorParams & { excludeFollowed?: boolean } = { limit };
  if (cursor) params.cursor = cursor;
  if (excludeFollowed) params.excludeFollowed = true;

  const response = await axiosInstance.get<ApiResponse<CursorPage<FeedPostResponse>>>(
    `${RECOMMENDATIONS_API_PATH}/feed`,
    {
      params,
      signal,
    }
  );
  return response.data;
};

export const recommendationService = { getRecommendedFeed };

export default recommendationService;
