import type { ApiResponse, CursorParams, CursorPage } from '@/types/api';
import type {
  CreatePostRequest,
  PostResponse,
  FeedPostResponse,
  UpdatePostCaptionRequest,
  PostStatus,
  LikeActionResponse,
  SavedPostResponse,
  LikedPostResponse,
  CommentResponse,
  CommentDeletionScopeResponse,
} from '@/types/domain';
import axiosInstance from './axiosInstance';

const POST_API_PATH = '/posts';

/**
 * Creates a new post.
 * @param {Object} data - The post data (e.g., content, mediaUrls).
 * @returns {Promise<Object>} The created post.
 */
export const createPost = async (data: CreatePostRequest) => {
  const response = await axiosInstance.post<ApiResponse<PostResponse>>(POST_API_PATH, data);
  return response.data;
};

/**
 * Retrieves a paginated list of feed posts.
 * @param {Object} params - Query parameters (e.g., cursor, limit) plus an optional AbortSignal.
 * @returns {Promise<Object>} The paginated posts response.
 */
export const getFeed = async ({ signal, ...params }: CursorParams = {}) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<FeedPostResponse>>>(
    `${POST_API_PATH}/feed`,
    { params, signal }
  );
  return response.data;
};

/**
 * Retrieves a paginated list of explore posts via search.
 */
export const getExplorePosts = async ({
  signal,
  ...params
}: CursorParams & { q?: string } = {}) => {
  // Backend requires 'q', fallback to a space or wildcard if empty to avoid 400
  if (!params.q) params.q = 'a';
  const response = await axiosInstance.get<ApiResponse<CursorPage<PostResponse>>>(
    `${POST_API_PATH}/search`,
    { params, signal }
  );
  return response.data;
};

/**
 * Retrieves a paginated list of a user's published posts.
 *
 * This endpoint rejects any query parameter it does not declare with 400
 * BAD_REQUEST. It accepts `cursor`, `limit` and `type` and nothing else, so a
 * caller must not pass incidental keys through.
 *
 * `type` is optional and multi-valued, taking `image`, `video`, `carousel` or
 * `text`. Axios serialises an array as repeated keys, which the backend
 * accepts alongside the comma-separated form.
 *
 * A cursor is bound to the filter that produced it. Replaying one under a
 * different filter, including under no filter and under a superset, fails with
 * 400 INVALID_CURSOR. Reordering the same values is safe. Callers must
 * therefore drop the cursor whenever the filter changes.
 * @param {string|number} userId - The ID of the user.
 * @param {Object} params - Query parameters (cursor, limit, type) plus an optional AbortSignal.
 * @returns {Promise<Object>} The paginated posts response.
 */
export const getUserPosts = async (
  userId: string,
  { signal, type, ...params }: CursorParams & { type?: string | string[] } = {}
) => {
  // Axios serialises an array as `type[]=image`, and the backend rejects
  // `type[]` as an unrecognised parameter with 400. Verified against the
  // running server. Joining here means an array can never reach the wire in
  // the bracket form, whatever a caller passes.
  const typeValues = Array.isArray(type) ? type : type ? [type] : [];
  const query = typeValues.length > 0 ? { ...params, type: typeValues.join(',') } : params;

  const response = await axiosInstance.get<ApiResponse<CursorPage<PostResponse>>>(
    `${POST_API_PATH}/user/${userId}`,
    {
      params: query,
      signal,
    }
  );
  return response.data;
};

/**
 * Retrieves a single post by ID.
 * @param {string|number} postId - The ID of the post.
 * @returns {Promise<Object>} The post details.
 */
export const getPostById = async (postId: string) => {
  const response = await axiosInstance.get<ApiResponse<PostResponse>>(`${POST_API_PATH}/${postId}`);
  return response.data;
};

/**
 * Updates an existing post.
 * @param {string|number} postId - The ID of the post.
 * @param {Object} data - The updated post data.
 * @returns {Promise<Object>} The updated post.
 */
export const updatePost = async (postId: string, data: UpdatePostCaptionRequest) => {
  const response = await axiosInstance.patch<ApiResponse<PostResponse>>(
    `${POST_API_PATH}/${postId}`,
    data
  );
  return response.data;
};

/**
 * Deletes a post.
 * @param {string|number} postId - The ID of the post.
 * @returns {Promise<Object>} A success message or empty response.
 */
export const deletePost = async (postId: string) => {
  const response = await axiosInstance.delete<ApiResponse<null>>(`${POST_API_PATH}/${postId}`);
  return response.data;
};

/**
 * Transitions the status of a post.
 * @param {string|number} postId - The ID of the post.
 * @param {string} status - The target status: 'draft', 'published', 'archived' or 'removed'.
 * @returns {Promise<Object>} The updated post.
 */
export const updatePostStatus = async (postId: string, status: PostStatus) => {
  const response = await axiosInstance.patch<ApiResponse<PostResponse>>(
    `${POST_API_PATH}/${postId}/status`,
    {
      targetStatus: status,
    }
  );
  return response.data;
};

/**
 * Likes a post for the current user; returns the fresh like count.
 * @param {string} postId - The ID of the post.
 * @returns {Promise<Object>} ApiResponse<{ postId, liked, likeCount }>.
 */
export const likePost = async (postId: string) => {
  const response = await axiosInstance.post<ApiResponse<LikeActionResponse>>(
    `${POST_API_PATH}/${postId}/like`
  );
  return response.data;
};

/**
 * Removes the current user's like from a post; returns the fresh like count.
 * @param {string} postId - The ID of the post.
 * @returns {Promise<Object>} ApiResponse<{ postId, liked, likeCount }>.
 */
export const unlikePost = async (postId: string) => {
  const response = await axiosInstance.delete<ApiResponse<LikeActionResponse>>(
    `${POST_API_PATH}/${postId}/like`
  );
  return response.data;
};

/**
 * Saves (bookmarks) a post for the current user.
 * @param {string} postId - The ID of the post.
 * @returns {Promise<Object>} ApiResponse<Void>.
 */
export const savePost = async (postId: string) => {
  const response = await axiosInstance.post<ApiResponse<null>>(`${POST_API_PATH}/${postId}/save`);
  return response.data;
};

/**
 * Removes the current user's saved bookmark from a post.
 * @param {string} postId - The ID of the post.
 * @returns {Promise<Object>} No content.
 */
export const unsavePost = async (postId: string) => {
  const response = await axiosInstance.delete<ApiResponse<null>>(`${POST_API_PATH}/${postId}/save`);
  return response.data;
};

/**
 * Retrieves the viewer's saved posts, most recently saved first.
 *
 * Rows are not bare posts. Each one nests the post under `post` and adds
 * `savedAt`, so a caller reusing a post grid must unwrap it.
 * @param {Object} params - Query parameters (e.g., cursor, limit) plus an optional AbortSignal.
 * @returns {Promise<Object>} ApiResponse<CursorPageResponse<SavedPostResponse>>.
 */
export const getSavedPosts = async ({ signal, ...params }: CursorParams = {}) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<SavedPostResponse>>>(
    `${POST_API_PATH}/saved`,
    { params, signal }
  );
  return response.data;
};

/**
 * Retrieves the viewer's liked posts, most recently liked first.
 *
 * There is no path parameter for another account. The endpoint always answers
 * for the authenticated caller, which is why the liked tab is offered on the
 * viewer's own profile only.
 *
 * Rows mirror the saved-posts shape but do not match it exactly: the post
 * nests under `post` in both, while the timestamp is `likedAt` here and
 * `savedAt` there. Verified against the running server; see
 * docs/social-states-and-tabs/endpoint-verification.md.
 *
 * A page can arrive shorter than `limit`, including empty, while further pages
 * still exist. Callers must page until `pageInfo.hasNextPage` is false rather
 * than stopping on a short page.
 * @param {Object} params - Query parameters (e.g., cursor, limit) plus an optional AbortSignal.
 * @returns {Promise<Object>} ApiResponse<CursorPageResponse<LikedPostResponse>>.
 */
export const getLikedPosts = async ({ signal, ...params }: CursorParams = {}) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<LikedPostResponse>>>(
    `${POST_API_PATH}/liked`,
    { params, signal }
  );
  return response.data;
};

/**
 * Retrieves a paginated list of top-level comments for a post.
 * @param {string} postId - The ID of the post.
 * @param {Object} params - Query parameters (e.g., cursor, limit).
 * @returns {Promise<Object>} ApiResponse<CursorPageResponse<Comment>>.
 */
export const getComments = async (postId: string, params: CursorParams = {}) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<CommentResponse>>>(
    `${POST_API_PATH}/${postId}/comments`,
    { params }
  );
  return response.data;
};

/**
 * Retrieves a paginated list of direct replies to a comment.
 * @param {string} commentId - The ID of the parent comment.
 * @param {Object} params - Query parameters (e.g., cursor, limit).
 * @returns {Promise<Object>} ApiResponse<CursorPageResponse<Comment>>.
 */
export const getCommentReplies = async (commentId: string, params: CursorParams = {}) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<CommentResponse>>>(
    `/comments/${commentId}/replies`,
    { params }
  );
  return response.data;
};

/**
 * Creates a comment or reply on a post.
 *
 * When an idempotency key is supplied it travels as the `Idempotency-Key`
 * header, which the backend honours by returning the original comment on a
 * replay instead of creating a second one.
 * @param {string} postId - The ID of the post.
 * @param {{ parentId?: string|null, content: string, idempotencyKey?: string }} data - Comment payload.
 * @returns {Promise<Object>} ApiResponse<Comment>.
 */
export const createComment = async (
  postId: string,
  data: { parentId?: string | null; content: string; idempotencyKey?: string }
) => {
  const response = await axiosInstance.post<ApiResponse<CommentResponse>>(
    `${POST_API_PATH}/${postId}/comments`,
    {
      postId,
      parentId: data.parentId ?? null,
      content: data.content,
    },
    data.idempotencyKey ? { headers: { 'Idempotency-Key': data.idempotencyKey } } : undefined
  );
  return response.data;
};

/**
 * Likes a comment.
 *
 * The response carries no body beyond the envelope, so the caller is
 * responsible for reflecting the new count.
 * @param {string} commentId - The ID of the comment.
 * @returns {Promise<Object>} ApiResponse<void>.
 */
export const likeComment = async (commentId: string) => {
  const response = await axiosInstance.post<ApiResponse<null>>(`/comments/${commentId}/like`);
  return response.data;
};

/**
 * Removes the viewer's like from a comment.
 * @param {string} commentId - The ID of the comment.
 * @returns {Promise<Object>} ApiResponse<void>.
 */
export const unlikeComment = async (commentId: string) => {
  const response = await axiosInstance.delete<ApiResponse<null>>(`/comments/${commentId}/like`);
  return response.data;
};

/**
 * Replaces the body of a comment the viewer authored.
 * @param {string} commentId - The ID of the comment.
 * @param {string} content - The new body; the backend requires it non-blank and at most 2200 characters.
 * @returns {Promise<Object>} ApiResponse<Comment>.
 */
export const editComment = async (commentId: string, content: string) => {
  const response = await axiosInstance.patch<ApiResponse<CommentResponse>>(
    `/comments/${commentId}`,
    { content }
  );
  return response.data;
};

/**
 * Reports how many comments deleting this one would remove.
 *
 * The count covers the comment itself plus every descendant at any depth, so it
 * is not replyCount, which counts direct replies only. This is an estimate: a
 * reply arriving between this call and the delete makes the delete remove more.
 * Owner-only; the backend answers 404 for anyone else.
 *
 * @param {string} commentId - The ID of the comment.
 * @returns {Promise<Object>} ApiResponse<CommentDeletionScopeResponse>.
 */
export const getCommentDeletionScope = async (commentId: string) => {
  const response = await axiosInstance.get<ApiResponse<CommentDeletionScopeResponse>>(
    `/comments/${commentId}/deletion-scope`
  );
  return response.data;
};

/**
 * Soft-deletes a comment the viewer authored, together with every descendant.
 * @param {string} commentId - The ID of the comment.
 * @returns {Promise<Object>} ApiResponse<CommentDeletionScopeResponse>, carrying
 *   the authoritative number of comments removed.
 */
export const deleteComment = async (commentId: string) => {
  const response = await axiosInstance.delete<ApiResponse<CommentDeletionScopeResponse>>(
    `/comments/${commentId}`
  );
  return response.data;
};

export const postService = {
  createPost,
  getFeed,
  getUserPosts,
  getLikedPosts,
  getPostById,
  updatePost,
  deletePost,
  updatePostStatus,
  getExplorePosts,
  likePost,
  unlikePost,
  savePost,
  unsavePost,
  getComments,
  getCommentReplies,
  createComment,
  likeComment,
  unlikeComment,
  editComment,
  getCommentDeletionScope,
  deleteComment,
  getSavedPosts,
};

export default postService;
