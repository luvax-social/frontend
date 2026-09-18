import axiosInstance from './axiosInstance';

const STORY_API_PATH = '/stories';

/**
 * Creates a story from an already-uploaded media asset.
 * @param {{mediaId: string, caption?: string}} data
 * @returns {Promise<Object>} The ApiResponse envelope wrapping the created story.
 */
export const createStory = async (data) => {
  const response = await axiosInstance.post(STORY_API_PATH, data);
  return response.data;
};

/**
 * Retrieves the authenticated user's story feed tray, grouped by author.
 * @returns {Promise<Object>} The ApiResponse envelope wrapping the tray list.
 */
export const getStoryFeed = async () => {
  const response = await axiosInstance.get(`${STORY_API_PATH}/feed`);
  return response.data;
};

/**
 * Records a deduplicated view of a story for the authenticated user.
 * @param {string} storyId
 * @returns {Promise<Object>} The ApiResponse envelope wrapping the view outcome.
 */
export const recordStoryView = async (storyId) => {
  const response = await axiosInstance.post(`${STORY_API_PATH}/${storyId}/views`);
  return response.data;
};

/**
 * Soft-deletes a story owned by the authenticated user.
 * @param {string} storyId
 * @returns {Promise<Object>} The ApiResponse envelope.
 */
export const deleteStory = async (storyId) => {
  const response = await axiosInstance.delete(`${STORY_API_PATH}/${storyId}`);
  return response.data;
};

/**
 * Likes a story. Self-like is permitted.
 * @param {string} storyId
 * @returns {Promise<Object>} The ApiResponse envelope wrapping the like action outcome.
 */
export const likeStory = async (storyId) => {
  const response = await axiosInstance.post(`${STORY_API_PATH}/${storyId}/likes`);
  return response.data;
};

/**
 * Removes the authenticated user's like from a story.
 * @param {string} storyId
 * @returns {Promise<Object>} The ApiResponse envelope wrapping the like action outcome.
 */
export const unlikeStory = async (storyId) => {
  const response = await axiosInstance.delete(`${STORY_API_PATH}/${storyId}/likes`);
  return response.data;
};

/**
 * Retrieves active stories from suggested accounts the caller does not follow.
 *
 * Calls `GET /stories/discovery` and returns the ApiResponse envelope, like every other function
 * here. Every privacy rule is applied server-side - private accounts never appear, and blocked,
 * dismissed and already-followed accounts are excluded - so the client renders what it is handed
 * without filtering.
 * @param {number} [limit] - How many authors; the backend defaults to 8 and caps at 20.
 * @param {AbortSignal} [signal] - Cancels the request when the screen unmounts.
 * @returns {Promise<Object>} The ApiResponse envelope wrapping a list of tray entries.
 */
export const getStoryDiscovery = async (limit, signal) => {
  const response = await axiosInstance.get(`${STORY_API_PATH}/discovery`, {
    params: limit ? { limit } : {},
    signal,
  });
  return response.data;
};

export const storyService = {
  createStory,
  getStoryFeed,
  getStoryDiscovery,
  recordStoryView,
  deleteStory,
  likeStory,
  unlikeStory,
};
