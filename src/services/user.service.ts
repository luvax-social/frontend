import type { ApiResponse, CursorPage, CursorParams } from '@/types/api';
import type {
  CreateHiddenWordRequest,
  HiddenWordEntryResponse,
  HiddenWordListResponse,
  InteractionLimitResponse,
  PublicUserProfileResponse,
  UserProfileResponse,
  UpdateInteractionLimitRequest,
  UpdateProfileRequest,
  UserSettingsResponse,
  UpdateSettingsRequest,
  UserWarningResponse,
} from '@/types/domain';
import axiosInstance from './axiosInstance';

const USERS_API_PATH = '/users';

// Get a user's public profile
export const getUserProfile = async (userId: string) => {
  const response = await axiosInstance.get<ApiResponse<PublicUserProfileResponse>>(
    `${USERS_API_PATH}/${userId}`
  );
  return response.data;
};

// Get my own full profile (includes fields, like isPrivate, that the public
// profile view omits or restricts).
export const getMyProfile = async () => {
  const response = await axiosInstance.get<ApiResponse<UserProfileResponse>>(
    `${USERS_API_PATH}/me`
  );
  return response.data;
};

// Update my profile
export const updateMyProfile = async (data: UpdateProfileRequest) => {
  const response = await axiosInstance.patch<ApiResponse<UserProfileResponse>>(
    `${USERS_API_PATH}/me`,
    data
  );
  return response.data;
};

// Get my notification and privacy settings
export const getMySettings = async () => {
  const response = await axiosInstance.get<ApiResponse<UserSettingsResponse>>(
    `${USERS_API_PATH}/me/settings`
  );
  return response.data;
};

// Update my notification and privacy settings (partial - omit fields to leave unchanged)
export const updateMySettings = async (data: UpdateSettingsRequest) => {
  const response = await axiosInstance.patch<ApiResponse<UserSettingsResponse>>(
    `${USERS_API_PATH}/me/settings`,
    data
  );
  return response.data;
};

// My personal hidden words, newest first, with the size limit. Returns the
// ApiResponse envelope; callers unwrap it.
export const getMyHiddenWords = async () => {
  const response = await axiosInstance.get<ApiResponse<HiddenWordListResponse>>(
    `${USERS_API_PATH}/me/hidden-words`
  );
  return response.data;
};

// Adds a phrase to my personal list and returns the created entry. Refusals are
// 409 HIDDEN_WORD_DUPLICATE, 422 HIDDEN_WORD_LIMIT_REACHED and 400
// HIDDEN_WORD_INVALID.
export const addHiddenWord = async (phrase: string) => {
  const body: CreateHiddenWordRequest = { phrase };
  const response = await axiosInstance.post<ApiResponse<HiddenWordEntryResponse>>(
    `${USERS_API_PATH}/me/hidden-words`,
    body
  );
  return response.data;
};

// Removes one entry from my personal list. Answers 204 with no body.
export const removeHiddenWord = async (entryId: string) => {
  await axiosInstance.delete(`${USERS_API_PATH}/me/hidden-words/${entryId}`);
};

// My interaction limit as stored and as it stands now. An account that never set
// one gets both flags false, `expiresAt` null and `active` false.
export const getMyInteractionLimit = async () => {
  const response = await axiosInstance.get<ApiResponse<InteractionLimitResponse>>(
    `${USERS_API_PATH}/me/interaction-limits`
  );
  return response.data;
};

// Turns the limit on for a preset number of days. The server computes the end
// time from the duration and returns it; 400 VALIDATION_ERROR when both
// audiences are false or the duration is not a preset.
export const setMyInteractionLimit = async (data: UpdateInteractionLimitRequest) => {
  const response = await axiosInstance.put<ApiResponse<InteractionLimitResponse>>(
    `${USERS_API_PATH}/me/interaction-limits`,
    data
  );
  return response.data;
};

// Turns the limit off before it expires. Answers 204 with no body.
export const clearMyInteractionLimit = async () => {
  await axiosInstance.delete(`${USERS_API_PATH}/me/interaction-limits`);
};

// The warnings a moderator has issued against my own account, newest first.
// Read-only: nothing a person can do removes one. `cursor` and `limit` are the
// only query parameters this endpoint declares.
export const getMyWarnings = async (cursor?: string | null, limit = 20, signal?: AbortSignal) => {
  const params: CursorParams & { excludeFollowed?: boolean } = { limit };
  if (cursor) params.cursor = cursor;
  const response = await axiosInstance.get<ApiResponse<CursorPage<UserWarningResponse>>>(
    `${USERS_API_PATH}/me/warnings`,
    { params, signal }
  );
  return response.data;
};
