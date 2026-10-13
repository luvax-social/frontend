import type { UserListItem } from '@/types/social';
import type { ApiResponse, CursorPage } from '@/types/api';
import type { PostResponse, HashtagResponse } from '@/types/domain';
import axiosInstance from './axiosInstance';

/**
 * Search is three separate endpoints, not one combined one, so a screen that
 * shows posts and people together composes three requests and pages each of
 * them independently.
 *
 * Every one of them rejects a blank `q` with 400 MISSING_REQUIRED_PARAMETER,
 * so callers must not issue a request until there is a term to search for.
 */

/**
 * Builds the query string shared by all three search endpoints.
 * @param {string} q - The search term.
 * @param {string|null} cursor - Opaque cursor from the previous page, or null for the first page.
 * @param {number} [limit] - Page size; the backend defaults to 20 when omitted.
 * @returns {Object} The axios params object.
 */
const buildParams = (q: string, cursor?: string | null, limit?: number) => {
  const params: { q: string; cursor?: string; limit?: number } = { q };
  if (cursor) params.cursor = cursor;
  if (limit) params.limit = limit;
  return params;
};

/**
 * Searches published post captions.
 *
 * Matching is stemmed rather than exact substring.
 * This endpoint is backed by Elasticsearch and returns an empty page rather
 * than an error when that backend is unavailable, so an empty result here does
 * not prove there are no matches.
 * @param {string} q - The search term.
 * @param {string|null} cursor - Cursor from the previous page.
 * @param {number} [limit] - Page size.
 * @param {AbortSignal} [signal] - Cancels the request when the query is superseded.
 * @returns {Promise<Object>} The ApiResponse envelope wrapping a cursor page of PostResponse.
 */
export const searchPosts = async (
  q: string,
  cursor?: string | null,
  limit?: number,
  signal?: AbortSignal
) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<PostResponse>>>('/posts/search', {
    params: buildParams(q, cursor, limit),
    signal,
  });
  return response.data;
};

/**
 * Searches accounts by username substring.
 *
 * Accounts in a block relationship with the viewer are excluded in both
 * directions. Each row carries its own `viewerState`, which is what lets a
 * follow control on a result reflect the real relationship.
 * @param {string} q - The search term.
 * @param {string|null} cursor - Cursor from the previous page.
 * @param {number} [limit] - Page size.
 * @param {AbortSignal} [signal] - Cancels the request when the query is superseded.
 * @returns {Promise<Object>} The ApiResponse envelope wrapping a cursor page of UserListItemResponse.
 */
export const searchUsers = async (
  q: string,
  cursor?: string | null,
  limit?: number,
  signal?: AbortSignal
) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<UserListItem>>>('/users/search', {
    params: buildParams(q, cursor, limit),
    signal,
  });
  return response.data;
};

/**
 * Searches hashtags by name.
 *
 * The identifier on these rows is `id`; the trending endpoint names the same
 * concept `hashtagId`.
 * @param {string} q - The search term.
 * @param {string|null} cursor - Cursor from the previous page.
 * @param {number} [limit] - Page size.
 * @param {AbortSignal} [signal] - Cancels the request when the query is superseded.
 * @returns {Promise<Object>} The ApiResponse envelope wrapping a cursor page of hashtag rows.
 */
export const searchHashtags = async (
  q: string,
  cursor?: string | null,
  limit?: number,
  signal?: AbortSignal
) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<HashtagResponse>>>(
    '/hashtags/search',
    {
      params: buildParams(q, cursor, limit),
      signal,
    }
  );
  return response.data;
};

export const searchService = {
  searchPosts,
  searchUsers,
  searchHashtags,
};

export default searchService;
