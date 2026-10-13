import type { UserListItem } from '@/types/social';
import type { ApiResponse, CursorPage } from '@/types/api';
import type { FollowResponse, FollowRequestResponse } from '@/types/domain';
import axiosInstance from './axiosInstance';

const SOCIAL_API_PATH = '/social';

// Follow a user
export const followUser = async (targetUserId: string) => {
  const response = await axiosInstance.post<ApiResponse<FollowResponse>>(
    `${SOCIAL_API_PATH}/follow/${targetUserId}`
  );
  return response.data;
};

// Unfollow a user
export const unfollowUser = async (targetUserId: string) => {
  const response = await axiosInstance.delete<ApiResponse<null>>(
    `${SOCIAL_API_PATH}/follow/${targetUserId}`
  );
  return response.data;
};

// Block a user
export const blockUser = async (targetUserId: string) => {
  const response = await axiosInstance.post<ApiResponse<null>>(
    `${SOCIAL_API_PATH}/block/${targetUserId}`
  );
  return response.data;
};

// Unblock a user
export const unblockUser = async (targetUserId: string) => {
  const response = await axiosInstance.delete<ApiResponse<null>>(
    `${SOCIAL_API_PATH}/block/${targetUserId}`
  );
  return response.data;
};

// Get followers
export const getFollowers = async (
  userId: string,
  cursor?: string | null,
  limit = 20,
  signal?: AbortSignal
) => {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit.toString());

  const response = await axiosInstance.get<ApiResponse<CursorPage<UserListItem>>>(
    `${SOCIAL_API_PATH}/users/${userId}/followers?${params.toString()}`,
    { signal }
  );
  return response.data;
};

// Get following
export const getFollowing = async (
  userId: string,
  cursor?: string | null,
  limit = 20,
  signal?: AbortSignal
) => {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit.toString());

  const response = await axiosInstance.get<ApiResponse<CursorPage<UserListItem>>>(
    `${SOCIAL_API_PATH}/users/${userId}/following?${params.toString()}`,
    { signal }
  );
  return response.data;
};

// Get pending follow requests
export const getPendingFollowRequests = async () => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<FollowRequestResponse>>>(
    `${SOCIAL_API_PATH}/follow-requests`
  );
  return response.data;
};

// Approve follow request
export const approveFollowRequest = async (requesterId: string) => {
  const response = await axiosInstance.patch<ApiResponse<FollowResponse>>(
    `${SOCIAL_API_PATH}/follow-requests/${requesterId}/approve`
  );
  return response.data;
};

// Reject follow request
export const rejectFollowRequest = async (requesterId: string) => {
  const response = await axiosInstance.patch<ApiResponse<null>>(
    `${SOCIAL_API_PATH}/follow-requests/${requesterId}/reject`
  );
  return response.data;
};

// Get the authenticated user's blocked list (outgoing blocks only)
export const getBlockedUsers = async (cursor?: string | null, limit = 20, signal?: AbortSignal) => {
  const params = new URLSearchParams();
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit.toString());

  const response = await axiosInstance.get<ApiResponse<CursorPage<UserListItem>>>(
    `${SOCIAL_API_PATH}/blocked?${params.toString()}`,
    {
      signal,
    }
  );
  return response.data;
};
