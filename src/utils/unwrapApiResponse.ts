import type { ApiResponse } from '@/types/api';

// Legacy callers accept both an envelope and an already-unwrapped payload.
export const unwrapApiResponse = <T>(payload: ApiResponse<T> | T): T => {
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data) {
    return payload.data as T;
  }
  return payload as T;
};
