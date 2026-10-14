import axiosInstance from './axiosInstance';

const SOCIAL_API_PATH = '/social';

/**
 * Asks to see fewer recommendations from one author.
 *
 * Calls `POST /social/show-fewer/{authorId}`, which answers 204 with no body. The viewer's own
 * account, a missing author and a blocked author all answer the same 404.
 */
export const showFewer = async (authorId: string) => {
  await axiosInstance.post(`${SOCIAL_API_PATH}/show-fewer/${authorId}`);
};

/**
 * Withdraws a show fewer request.
 *
 * Calls `DELETE /social/show-fewer/{authorId}`, which is idempotent and answers 204.
 */
export const undoShowFewer = async (authorId: string) => {
  await axiosInstance.delete(`${SOCIAL_API_PATH}/show-fewer/${authorId}`);
};
