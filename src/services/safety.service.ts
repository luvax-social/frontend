import type { ApiResponse, CursorPage, CursorParams } from '@/types/api';
import type { MuteRequest, MuteResponse } from '@/types/domain';
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

/**
 * Sets what the viewer mutes about one account, as absolute values.
 *
 * Calls `PUT /social/mutes/{targetUserId}` and returns the `ApiResponse` envelope around the
 * `MuteResponse`; callers unwrap it. Both flags false removes the mute and the answer says so. The
 * viewer's own account, a missing account and a blocked account all answer 404.
 */
export const setMute = async (targetUserId: string, request: MuteRequest) => {
  const response = await axiosInstance.put<ApiResponse<MuteResponse>>(
    `${SOCIAL_API_PATH}/mutes/${targetUserId}`,
    request
  );
  return response.data;
};

/**
 * Removes a mute outright.
 *
 * Calls `DELETE /social/mutes/{targetUserId}`, which is idempotent and answers 204, so nothing is
 * unwrapped.
 */
export const unmute = async (targetUserId: string) => {
  await axiosInstance.delete(`${SOCIAL_API_PATH}/mutes/${targetUserId}`);
};

/**
 * The accounts the viewer has muted, most recently changed first.
 *
 * Calls `GET /social/mutes` and returns the `ApiResponse` envelope around the cursor page of
 * `MuteResponse`; callers unwrap it.
 */
export const getMutes = async ({ cursor, limit = 20, signal }: CursorParams = {}) => {
  const params: CursorParams = { limit };
  if (cursor) params.cursor = cursor;
  const response = await axiosInstance.get<ApiResponse<CursorPage<MuteResponse>>>(
    `${SOCIAL_API_PATH}/mutes`,
    { params, signal }
  );
  return response.data;
};
