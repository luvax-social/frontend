import axiosInstance from './axiosInstance';

const POST_API_PATH = '/posts';

/**
 * Tells the recommender the viewer does not want this post.
 *
 * Calls `POST /posts/{postId}/not-interested`, which answers 204 with no body, so nothing is
 * unwrapped. A post the viewer cannot see answers 404 `POST_NOT_FOUND`.
 */
export const markNotInterested = async (postId: string) => {
  await axiosInstance.post(`${POST_API_PATH}/${postId}/not-interested`);
};

/**
 * Withdraws a not interested signal.
 *
 * Calls `DELETE /posts/{postId}/not-interested`, which is idempotent and answers 204.
 */
export const undoNotInterested = async (postId: string) => {
  await axiosInstance.delete(`${POST_API_PATH}/${postId}/not-interested`);
};
