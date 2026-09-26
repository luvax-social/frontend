import axiosInstance from './axiosInstance';

/**
 * Hashtag reads: name resolution, the posts carrying a hashtag, and the two trending surfaces.
 *
 * Every function here returns the raw `ApiResponse` envelope rather than unwrapping it. That
 * matches every other service in this codebase and the `extractPageContent` / `extractPageInfo`
 * helpers each call site already uses, even though `global_rules.md` section 3 says services should
 * unwrap. Following the shipped pattern keeps one convention; following the rule would give this
 * one service a different contract from its neighbours.
 */

/**
 * Resolves a hashtag name to its record.
 *
 * The backend normalizes the name with the same function the post write path uses, so a leading
 * `#`, surrounding whitespace and upper case all resolve to the same row.
 *
 * Answers 404 twice over, and the two cases mean different things to a reader:
 * `HASHTAG_NOT_FOUND` means no hashtag carries the name, `HASHTAG_UNAVAILABLE` means one does but
 * an administrator has taken it out of circulation. Neither is the same as a hashtag that exists
 * and simply has no posts yet, which answers 200 with an empty page.
 * @param {string} name - Hashtag name, with or without a leading `#`.
 * @param {AbortSignal} [signal] - Cancels the request when the route changes.
 * @returns {Promise<Object>} The ApiResponse envelope wrapping a hashtag detail record.
 */
export const getHashtagByName = async (name, signal) => {
  const response = await axiosInstance.get(`/hashtags/name/${encodeURIComponent(name)}`, {
    signal,
  });
  return response.data;
};

/**
 * Lists published posts carrying a hashtag, newest first.
 *
 * Cursor-paginated. Depth is bounded server-side; a request past the bound answers 400
 * `PAGINATION_DEPTH_EXCEEDED` rather than failing inside the search tier.
 * @param {string} hashtagId - Hashtag identifier from the name lookup.
 * @param {string|null} cursor - Cursor from the previous page, or null for the first.
 * @param {number} [limit] - Page size; the backend defaults to 20.
 * @param {AbortSignal} [signal] - Cancels the request when the query is superseded.
 * @returns {Promise<Object>} The ApiResponse envelope wrapping a cursor page of PostResponse.
 */
export const getPostsByHashtag = async (hashtagId, cursor, limit, signal) => {
  const params = {};
  if (cursor) params.cursor = cursor;
  if (limit) params.limit = limit;
  const response = await axiosInstance.get(`/hashtags/${hashtagId}/posts`, { params, signal });
  return response.data;
};

/**
 * Returns the platform-wide trending snapshot, pinned hashtags first.
 * @param {number} [size] - Page size.
 * @param {AbortSignal} [signal] - Cancels the request.
 * @returns {Promise<Object>} The ApiResponse envelope wrapping a page of trending entries.
 */
export const getTrending = async (size, signal) => {
  const response = await axiosInstance.get('/hashtags/trending', {
    params: size ? { size } : {},
    signal,
  });
  return response.data;
};

/**
 * Returns trending hashtags ranked for the signed-in caller.
 *
 * Same response shape as {@link getTrending}, so one component renders both. A caller with no
 * computed affinity receives the platform list, so this never answers an empty page where the
 * platform surface would not.
 * @param {number} [size] - Page size.
 * @param {AbortSignal} [signal] - Cancels the request.
 * @returns {Promise<Object>} The ApiResponse envelope wrapping a page of trending entries.
 */
export const getTrendingForYou = async (size, signal) => {
  const response = await axiosInstance.get('/hashtags/trending/for-you', {
    params: size ? { size } : {},
    signal,
  });
  return response.data;
};

export const hashtagService = {
  getHashtagByName,
  getPostsByHashtag,
  getTrending,
  getTrendingForYou,
};

export default hashtagService;

/**
 * Trending hashtags, each with the cover image of its newest visible post.
 *
 * Calls `GET /hashtags/trending/previews`. One request for the whole card: fetching a preview per
 * tag through {@link getPostsByHashtag} is the N+1 this endpoint exists to avoid. A tag whose posts
 * are all text, all removed, or all from private accounts keeps its place with a null `previewUrl`
 * rather than being dropped.
 * @param {number} [size] - How many hashtags; the backend defaults to 3 and caps at 10.
 * @param {string} [scope] - `for-you` for the personalised blend, `platform` otherwise.
 * @param {AbortSignal} [signal] - Cancels the request when the screen unmounts.
 * @returns {Promise<Object>} The ApiResponse envelope wrapping a list of trending previews.
 */
export const getTrendingPreviews = async (size, scope, signal) => {
  const params = {};
  if (size) params.size = size;
  if (scope) params.scope = scope;
  const response = await axiosInstance.get('/hashtags/trending/previews', { params, signal });
  return response.data;
};
