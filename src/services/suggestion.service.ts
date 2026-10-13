import type { ApiResponse } from '@/types/api';
import type { SuggestedUserResponse } from '@/types/domain';
import axiosInstance from './axiosInstance';

const RECOMMENDATIONS_API_PATH = '/recommendations';

// People you may know. Every exclusion rule is applied server-side at read time, so the client
// renders what it is handed without filtering.
export const getSuggestions = async (limit = 10, signal?: AbortSignal) => {
  const response = await axiosInstance.get<ApiResponse<SuggestedUserResponse[]>>(
    `${RECOMMENDATIONS_API_PATH}/suggestions`,
    {
      params: { limit },
      signal,
    }
  );
  return response.data;
};

// Permanently removes one account from the caller's suggestions. Not a block, and idempotent.
export const dismissSuggestion = async (userId: string) => {
  const response = await axiosInstance.post<ApiResponse<null>>(
    `${RECOMMENDATIONS_API_PATH}/suggestions/${userId}/dismiss`
  );
  return response.data;
};
