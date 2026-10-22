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
  HiddenCommentResponse,
  OwnerPostCountsResponse,
  TagRequestResponse,
  CollaborationInviteResponse,
  PostTagInput,
  UpdatePostContentRequest,
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
 *
 * Calls `PATCH /posts/{postId}/status`. `scheduledAt` is required when the target is `scheduled`
 * and refused for any other target; the backend floors it to the minute and accepts a time between
 * one minute and thirty days ahead.
 * @param {string|number} postId - The ID of the post.
 * @param {string} status - The target status: 'draft', 'scheduled', 'published', 'archived' or 'removed'.
 * @param {string} [scheduledAt] - ISO instant the scheduled post is due.
 * @returns {Promise<Object>} The updated post.
 */
export const updatePostStatus = async (
  postId: string,
  status: PostStatus,
  scheduledAt?: string | null
) => {
  const response = await axiosInstance.patch<ApiResponse<PostResponse>>(
    `${POST_API_PATH}/${postId}/status`,
    scheduledAt ? { targetStatus: status, scheduledAt } : { targetStatus: status }
  );
  return response.data;
};

/**
 * Replaces the whole content of a draft or scheduled post.
 *
 * Calls `PUT /posts/{postId}/content`. It is a replacement, not a patch: a field left out clears
 * what the post carried, so the caller sends the complete composer state. Status and schedule
 * change through {@link updatePostStatus}.
 * @param {string} postId - The ID of the draft or scheduled post.
 * @param {UpdatePostContentRequest} data - The full content.
 * @returns {Promise<Object>} ApiResponse<PostResponse>.
 */
export const replacePostContent = async (postId: string, data: UpdatePostContentRequest) => {
  const response = await axiosInstance.put<ApiResponse<PostResponse>>(
    `${POST_API_PATH}/${postId}/content`,
    data
  );
  return response.data;
};

/**
 * Sets or clears the alt text of one media item.
 *
 * Calls `PATCH /posts/{postId}/media/{postMediaId}/alt-text`. Null or blank clears it. The owner
 * can edit it on a post in any retained status.
 * @returns {Promise<Object>} ApiResponse<PostResponse>.
 */
export const updateAltText = async (
  postId: string,
  postMediaId: string,
  altText: string | null
) => {
  const response = await axiosInstance.patch<ApiResponse<PostResponse>>(
    `${POST_API_PATH}/${postId}/media/${postMediaId}/alt-text`,
    { altText }
  );
  return response.data;
};

/**
 * Sets or clears the place of a post.
 *
 * Calls `PUT /posts/{postId}/place`. Send `placeId` for an existing place or `placeName` to create
 * one; both empty clears the place. A banned or deleted place is refused.
 * @returns {Promise<Object>} ApiResponse<PostResponse>.
 */
export const setPostPlace = async (
  postId: string,
  place: { placeId?: string | null; placeName?: string | null }
) => {
  const response = await axiosInstance.put<ApiResponse<PostResponse>>(
    `${POST_API_PATH}/${postId}/place`,
    place
  );
  return response.data;
};

/**
 * Replaces the people tagged on a post.
 *
 * Calls `PUT /posts/{postId}/tags`. The body is the complete set, each tag naming its media item by
 * position.
 * @returns {Promise<Object>} ApiResponse<PostResponse>.
 */
export const replacePostTags = async (postId: string, tags: PostTagInput[]) => {
  const response = await axiosInstance.put<ApiResponse<PostResponse>>(
    `${POST_API_PATH}/${postId}/tags`,
    { tags }
  );
  return response.data;
};

/**
 * Approves a tag that is waiting for the tagged person.
 *
 * Calls `POST /posts/{postId}/tags/{tagId}/approve`; only the tagged person may.
 * @returns {Promise<Object>} ApiResponse<void>.
 */
export const approveTag = async (postId: string, tagId: string) => {
  const response = await axiosInstance.post<ApiResponse<null>>(
    `${POST_API_PATH}/${postId}/tags/${tagId}/approve`
  );
  return response.data;
};

/**
 * Removes a tag. The post owner and the tagged person may, at any time.
 *
 * Calls `DELETE /posts/{postId}/tags/{tagId}`.
 * @returns {Promise<Object>} ApiResponse<void>.
 */
export const removeTag = async (postId: string, tagId: string) => {
  const response = await axiosInstance.delete<ApiResponse<null>>(
    `${POST_API_PATH}/${postId}/tags/${tagId}`
  );
  return response.data;
};

/**
 * Replaces the invited co-authors of a post.
 *
 * Calls `PUT /posts/{postId}/collaborators`. The body is the complete set (at most three); an
 * invitee left out of it has the invitation withdrawn.
 * @returns {Promise<Object>} ApiResponse<PostResponse>.
 */
export const replaceCollaborators = async (postId: string, userIds: string[]) => {
  const response = await axiosInstance.put<ApiResponse<PostResponse>>(
    `${POST_API_PATH}/${postId}/collaborators`,
    { userIds }
  );
  return response.data;
};

/** Accepts the viewer's invitation to co-author a published post: `POST .../collaboration/accept`. */
export const acceptCollaboration = async (postId: string) => {
  const response = await axiosInstance.post<ApiResponse<null>>(
    `${POST_API_PATH}/${postId}/collaboration/accept`
  );
  return response.data;
};

/** Declines the viewer's invitation: `POST .../collaboration/decline`. */
export const declineCollaboration = async (postId: string) => {
  const response = await axiosInstance.post<ApiResponse<null>>(
    `${POST_API_PATH}/${postId}/collaboration/decline`
  );
  return response.data;
};

/** Leaves a post the viewer co-authors: `DELETE .../collaboration`. */
export const leaveCollaboration = async (postId: string) => {
  const response = await axiosInstance.delete<ApiResponse<null>>(
    `${POST_API_PATH}/${postId}/collaboration`
  );
  return response.data;
};

/**
 * Lists the viewer's own posts in one non-published state.
 *
 * Calls `GET /users/me/posts?status=`. Drafts and archived posts page by most recently updated;
 * scheduled posts page by the time they are due, soonest first.
 * @returns {Promise<Object>} ApiResponse<CursorPageResponse<PostResponse>>.
 */
export const getMyPosts = async ({
  signal,
  status,
  ...params
}: CursorParams & { status: 'draft' | 'scheduled' | 'archived' }) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<PostResponse>>>(
    '/users/me/posts',
    { params: { ...params, status }, signal }
  );
  return response.data;
};

/**
 * Counts the viewer's drafts, scheduled and archived posts and reports the cap on the first two.
 *
 * Calls `GET /users/me/posts/counts`.
 * @returns {Promise<Object>} ApiResponse<OwnerPostCountsResponse>.
 */
export const getMyPostCounts = async (signal?: AbortSignal) => {
  const response = await axiosInstance.get<ApiResponse<OwnerPostCountsResponse>>(
    '/users/me/posts/counts',
    { signal }
  );
  return response.data;
};

/**
 * Lists the tags waiting for the viewer's approval: `GET /users/me/tags/pending`.
 * @returns {Promise<Object>} ApiResponse<CursorPageResponse<TagRequestResponse>>.
 */
export const getPendingTagRequests = async ({ signal, ...params }: CursorParams = {}) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<TagRequestResponse>>>(
    '/users/me/tags/pending',
    { params, signal }
  );
  return response.data;
};

/**
 * Lists the invitations to co-author a post that the viewer has not answered:
 * `GET /users/me/collaboration-invites`.
 * @returns {Promise<Object>} ApiResponse<CursorPageResponse<CollaborationInviteResponse>>.
 */
export const getCollaborationInvites = async ({ signal, ...params }: CursorParams = {}) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<CollaborationInviteResponse>>>(
    '/users/me/collaboration-invites',
    { params, signal }
  );
  return response.data;
};

/**
 * Lists the published posts a user is tagged in, as the viewer may see them:
 * `GET /users/{userId}/tagged-posts`. Only approved tags count.
 * @returns {Promise<Object>} ApiResponse<CursorPageResponse<PostResponse>>.
 */
export const getTaggedPosts = async (userId: string, { signal, ...params }: CursorParams = {}) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<PostResponse>>>(
    `/users/${userId}/tagged-posts`,
    { params, signal }
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

/**
 * Lists the hidden comments on a post the viewer owns, newest first.
 *
 * Calls `GET /posts/{postId}/comments/hidden`. The backend answers 404 `POST_NOT_FOUND` to
 * anyone who does not own the post.
 *
 * @param {string} postId - The ID of the post.
 * @param {Object} params - Keyset paging (cursor, limit).
 * @returns {Promise<Object>} ApiResponse<CursorPage<HiddenCommentResponse>>.
 */
export const getHiddenComments = async (postId: string, params: CursorParams = {}) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<HiddenCommentResponse>>>(
    `${POST_API_PATH}/${postId}/comments/hidden`,
    { params }
  );
  return response.data;
};

/**
 * Approves a hidden comment on the viewer's post and releases the replies hidden only because of it.
 *
 * Calls `POST /comments/{commentId}/unhide`. Answers 404 `COMMENT_NOT_FOUND` when the comment is
 * not hidden or not on the viewer's post, and 409 `COMMENT_PARENT_STILL_HIDDEN` while the comment
 * it replies to is still hidden.
 *
 * @param {string} commentId - The ID of the hidden comment.
 * @returns {Promise<Object>} ApiResponse<CommentResponse> for the approved comment.
 */
export const unhideComment = async (commentId: string) => {
  const response = await axiosInstance.post<ApiResponse<CommentResponse>>(
    `/comments/${commentId}/unhide`
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
  replacePostContent,
  updateAltText,
  setPostPlace,
  replacePostTags,
  approveTag,
  removeTag,
  replaceCollaborators,
  acceptCollaboration,
  declineCollaboration,
  leaveCollaboration,
  getMyPosts,
  getMyPostCounts,
  getPendingTagRequests,
  getCollaborationInvites,
  getTaggedPosts,
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
  getHiddenComments,
  unhideComment,
  getSavedPosts,
};

export default postService;
