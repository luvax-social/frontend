import type { ApiResponse, CursorParams, CursorPage } from '@/types/api';
import type { PlaceResponse, PostResponse } from '@/types/domain';
import axiosInstance from './axiosInstance';

const PLACE_API_PATH = '/places';

/**
 * Creates a place by name, or returns the existing one with the same normalised name.
 *
 * Calls `POST /places`. The name is 2 to 100 characters and must hold a letter or a digit; the
 * backend deduplicates on the folded form, so "da nang" and "Da Nang" are one place.
 * @param {string} name - The name as typed.
 * @returns {Promise<Object>} ApiResponse<PlaceResponse>.
 */
export const createPlace = async (name: string) => {
  const response = await axiosInstance.post<ApiResponse<PlaceResponse>>(PLACE_API_PATH, { name });
  return response.data;
};

/**
 * Searches places by name.
 *
 * Calls `GET /places/search`. Only active places that a published post uses are returned, ranked by
 * how many posts use them.
 * @returns {Promise<Object>} ApiResponse<CursorPageResponse<PlaceResponse>>.
 */
export const searchPlaces = async ({ signal, q, ...params }: CursorParams & { q: string }) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<PlaceResponse>>>(
    `${PLACE_API_PATH}/search`,
    { params: { ...params, q }, signal }
  );
  return response.data;
};

/**
 * Reads one place for the location page header.
 *
 * Calls `GET /places/{placeId}`. A banned or deleted place answers 404 like a missing one.
 * @returns {Promise<Object>} ApiResponse<PlaceResponse>.
 */
export const getPlace = async (placeId: string, signal?: AbortSignal) => {
  const response = await axiosInstance.get<ApiResponse<PlaceResponse>>(
    `${PLACE_API_PATH}/${placeId}`,
    { signal }
  );
  return response.data;
};

/**
 * Lists the published posts tagged at a place, newest publication first.
 *
 * Calls `GET /places/{placeId}/posts`. Filtered for the viewer exactly like the hashtag page, so a
 * blocked or private author's post is absent rather than hidden.
 * @returns {Promise<Object>} ApiResponse<CursorPageResponse<PostResponse>>.
 */
export const getPlacePosts = async (placeId: string, { signal, ...params }: CursorParams = {}) => {
  const response = await axiosInstance.get<ApiResponse<CursorPage<PostResponse>>>(
    `${PLACE_API_PATH}/${placeId}/posts`,
    { params, signal }
  );
  return response.data;
};

export const placeService = { createPlace, searchPlaces, getPlace, getPlacePosts };

export default placeService;
