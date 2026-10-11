import type { ApiResponse } from '@/types/api';
import type { VocabularyResponse } from '@/types/domain';
import axiosInstance from './axiosInstance';

/**
 * The server's own display vocabulary. The only part the user-facing
 * application needs is `reportReasons`, which turns the `reasonKey` carried on
 * a warning into the name the server itself uses for that reason.
 *
 * Resolving the key here rather than mapping it in the client matters: a key
 * like `hate_speech` is a database value, and inventing a phrase for it in the
 * frontend would put words in the moderator's mouth that the server never said.
 */
export const getVocabularies = async (signal?: AbortSignal) => {
  const response = await axiosInstance.get<ApiResponse<VocabularyResponse>>(
    '/config/vocabularies',
    { signal }
  );
  return response.data;
};
