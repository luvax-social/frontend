import type { ApiResponse } from '@/types/api';
import type {
  CreateStoryRequest,
  StoryResponse,
  StoryFeedItemResponse,
  StoryViewActionResponse,
  StoryLikeActionResponse,
} from '@/types/domain';
import axiosInstance from './axiosInstance';

const STORY_API_PATH = '/stories';

/**
 * Creates a story from an already-uploaded media asset.
 * @param {{mediaId: string, caption?: string}} data
 * @returns {Promise<Object>} The ApiResponse envelope wrapping the created story.
 */
export const createStory = async (data: CreateStoryRequest) => {
  const response = await axiosInstance.post<ApiResponse<StoryResponse>>(STORY_API_PATH, data);
  return response.data;
};

/**
 * Retrieves the authenticated user's story feed tray, grouped by author.
 * @returns {Promise<Object>} The ApiResponse envelope wrapping the tray list.
 */
export const getStoryFeed = async () => {
  const response = await axiosInstance.get<ApiResponse<StoryFeedItemResponse[]>>(
    `${STORY_API_PATH}/feed`
  );
  return response.data;
};

/**
 * Records a deduplicated view of a story for the authenticated user.
 * @param {string} storyId
 * @returns {Promise<Object>} The ApiResponse envelope wrapping the view outcome.
 */
export const recordStoryView = async (storyId: string) => {
  const response = await axiosInstance.post<ApiResponse<StoryViewActionResponse>>(
    `${STORY_API_PATH}/${storyId}/views`
  );
  return response.data;
};

/**
 * Soft-deletes a story owned by the authenticated user.
 * @param {string} storyId
 * @returns {Promise<Object>} The ApiResponse envelope.
 */
export const deleteStory = async (storyId: string) => {
  const response = await axiosInstance.delete<ApiResponse<null>>(`${STORY_API_PATH}/${storyId}`);
  return response.data;
};

/**
 * Likes a story. Self-like is permitted.
 * @param {string} storyId
 * @returns {Promise<Object>} The ApiResponse envelope wrapping the like action outcome.
 */
export const likeStory = async (storyId: string) => {
  const response = await axiosInstance.post<ApiResponse<StoryLikeActionResponse>>(
    `${STORY_API_PATH}/${storyId}/likes`
  );
  return response.data;
};

/**
 * Removes the authenticated user's like from a story.
 * @param {string} storyId
 * @returns {Promise<Object>} The ApiResponse envelope wrapping the like action outcome.
 */
export const unlikeStory = async (storyId: string) => {
  const response = await axiosInstance.delete<ApiResponse<StoryLikeActionResponse>>(
    `${STORY_API_PATH}/${storyId}/likes`
  );
  return response.data;
};

export const storyService = {
  createStory,
  getStoryFeed,
  recordStoryView,
  deleteStory,
  likeStory,
  unlikeStory,
};
