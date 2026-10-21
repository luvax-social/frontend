import type { AxiosResponse } from 'axios';
import type { ApiResponse, CursorPage } from '@/types/api';
import type {
  AdminDeleteHiddenWordRequest,
  AdminHiddenWordRequest,
  AdminHiddenWordResponse,
} from '@/types/admin';
import { axiosClient } from '@/api/axiosClient';
import { buildBody, pickParams } from '@/utils/requestContract';

const unwrap = <T>(response: AxiosResponse<ApiResponse<T>>): T => response.data.data;

// The list endpoint rejects any undeclared query parameter with 400.
const LIST_QUERY_KEYS = ['q', 'cursor', 'limit'];

/**
 * The platform-wide hidden word list, `/admin/hidden-words`. Administrator only: a moderator
 * receives 403. Every call unwraps the `ApiResponse` envelope and returns its `data`.
 */
export const hiddenWordsApi = {
  /**
   * One cursor page of the list, newest first. A blank `q` lists everything; otherwise the
   * backend matches the normalised form of the term against the normalised phrases.
   */
  async list({
    q,
    cursor,
    limit,
  }: { q?: string | null; cursor?: string | null; limit?: number } = {}) {
    const params = pickParams({ q, cursor, limit }, LIST_QUERY_KEYS);
    const res = await axiosClient.get<ApiResponse<CursorPage<AdminHiddenWordResponse>>>(
      '/admin/hidden-words',
      { params }
    );
    return unwrap(res);
  },

  /**
   * Adds a phrase and writes the audit row carrying `reason`. Answers 400 HIDDEN_WORD_INVALID for
   * a phrase outside 1 to 64 characters or 1 to 6 normalised words, and 409 HIDDEN_WORD_DUPLICATE
   * when its normalised form is already listed.
   */
  async create({ phrase, reason }: AdminHiddenWordRequest) {
    const res = await axiosClient.post<ApiResponse<AdminHiddenWordResponse>>(
      '/admin/hidden-words',
      buildBody({ phrase, reason })
    );
    return unwrap(res);
  },

  /** Replaces the phrase of one entry and writes the audit row carrying `reason`. */
  async update(id: string, { phrase, reason }: AdminHiddenWordRequest) {
    const res = await axiosClient.patch<ApiResponse<AdminHiddenWordResponse>>(
      `/admin/hidden-words/${id}`,
      buildBody({ phrase, reason })
    );
    return unwrap(res);
  },

  /**
   * Removes one entry for good. The audit row's reason and metadata are the only record that the
   * phrase existed, so the reason travels in the request body. Answers 204 with no content.
   */
  async remove(id: string, { reason }: AdminDeleteHiddenWordRequest) {
    await axiosClient.delete(`/admin/hidden-words/${id}`, { data: buildBody({ reason }) });
  },
};
