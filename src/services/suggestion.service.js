import axiosInstance from './axiosInstance';

const RECOMMENDATIONS_API_PATH = '/recommendations';

// People you may know. Every exclusion rule is applied server-side at read time, so the client
// renders what it is handed without filtering.
export const getSuggestions = async (limit = 10, signal) => {
  const response = await axiosInstance.get(`${RECOMMENDATIONS_API_PATH}/suggestions`, {
    params: { limit },
    signal,
  });
  return response.data;
};

// Permanently removes one account from the caller's suggestions. Not a block, and idempotent.
export const dismissSuggestion = async (userId) => {
  const response = await axiosInstance.post(
    `${RECOMMENDATIONS_API_PATH}/suggestions/${userId}/dismiss`
  );
  return response.data;
};
