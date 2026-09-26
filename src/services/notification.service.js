import axiosInstance from './axiosInstance';

const NOTIF_API_PATH = '/notifications';

/**
 * Calls GET /notifications and unwraps the ApiResponse envelope, returning the raw
 * CursorPageResponse shape ({content, pageInfo, degraded, head}) P1 section 4 defines.
 * @param {{filter?: string, cursor?: string, limit?: number, signal?: AbortSignal}} params
 * @returns {Promise<object>}
 */
export const getNotifications = async ({ signal, ...params } = {}) => {
  const response = await axiosInstance.get(NOTIF_API_PATH, { params, signal });
  return response.data.data;
};

/**
 * Calls GET /notifications/state and unwraps the ApiResponse envelope.
 * @param {AbortSignal} [signal]
 * @returns {Promise<{unseen: object, seen: ?object, previous: ?object, followRequests: object}>}
 */
export const getState = async (signal) => {
  const response = await axiosInstance.get(`${NOTIF_API_PATH}/state`, { signal });
  return response.data.data;
};

/**
 * Calls POST /notifications/seen with the newest rendered (activityAt, id) tuple and
 * unwraps the ApiResponse envelope, returning the new state.
 * @param {{activityAt: string, id: string}} tuple
 * @returns {Promise<object>}
 */
export const advanceSeen = async (tuple) => {
  const response = await axiosInstance.post(`${NOTIF_API_PATH}/seen`, tuple);
  return response.data.data;
};

/**
 * Calls PUT /notifications/{id}/read and unwraps the envelope.
 * @param {string} id
 * @returns {Promise<{id: string, readAt: string}>}
 */
export const markRead = async (id) => {
  const response = await axiosInstance.put(`${NOTIF_API_PATH}/${id}/read`);
  return response.data.data;
};

/**
 * Calls DELETE /notifications/{id}/read and unwraps the envelope.
 * @param {string} id
 * @returns {Promise<{id: string, readAt: null}>}
 */
export const markUnread = async (id) => {
  const response = await axiosInstance.delete(`${NOTIF_API_PATH}/${id}/read`);
  return response.data.data;
};

/**
 * Calls PATCH /notifications/read-all with the newest fetched page-0 head as the bound,
 * so rows arriving after that fetch stay unread.
 * @param {{activityAt: string, id: string}} upTo
 * @returns {Promise<{updated: number}>}
 */
export const markAllRead = async (upTo) => {
  const response = await axiosInstance.patch(`${NOTIF_API_PATH}/read-all`, { upTo });
  return response.data.data;
};

/**
 * Calls DELETE /notifications/{id}. Idempotent for the owner; the caller does not need
 * the empty 204 body.
 * @param {string} id
 * @returns {Promise<void>}
 */
export const deleteNotification = async (id) => {
  await axiosInstance.delete(`${NOTIF_API_PATH}/${id}`);
};

/**
 * Calls GET /comments/{commentId}/context and unwraps the envelope, for the comment
 * deep-link flow. A 404 (COMMENT_NOT_FOUND) is left to reject so the caller can branch
 * to the unavailable state rather than a generic error toast.
 * @param {string} commentId
 * @param {AbortSignal} [signal]
 * @returns {Promise<{postId: string, thread: Array<object>}>}
 */
export const getCommentContext = async (commentId, signal) => {
  const response = await axiosInstance.get(`/comments/${commentId}/context`, { signal });
  return response.data.data;
};
