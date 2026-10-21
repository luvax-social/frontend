import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as userService from '@/services/user.service';
import type { ApiResponse } from '@/types/api';
import type { HiddenWordEntryResponse, HiddenWordListResponse } from '@/types/domain';
import { unwrapApiResponse } from '@/utils/unwrapApiResponse';

const hiddenWordsKey = ['users', 'me', 'hiddenWords'];
type HiddenWordsCache = ApiResponse<HiddenWordListResponse>;

// A row the person has added that the server has not answered for yet carries a
// local id with this prefix, so the screen can tell it from a stored entry.
const PENDING_ID_PREFIX = 'pending:';
let pendingSequence = 0;

/** True for the temporary row shown while an add is still in flight; it has no server id yet. */
export const isPendingHiddenWord = (entry: HiddenWordEntryResponse) =>
  entry.id.startsWith(PENDING_ID_PREFIX);

const editEntries = (
  envelope: HiddenWordsCache | undefined,
  edit: (entries: HiddenWordEntryResponse[]) => HiddenWordEntryResponse[]
) =>
  envelope?.data
    ? { ...envelope, data: { ...envelope.data, entries: edit(envelope.data.entries) } }
    : envelope;

/**
 * The caller's personal hidden words, `{ entries, limit }`, newest first.
 *
 * Query key `['users', 'me', 'hiddenWords']`. The cache holds the response envelope and the hook
 * returns its `data`. `useAddHiddenWord` and `useRemoveHiddenWord` edit it in place and
 * invalidate it when they fail, so a rollback is reconciled with the server's own list.
 */
export const useMyHiddenWords = () =>
  useQuery({
    queryKey: hiddenWordsKey,
    queryFn: () => userService.getMyHiddenWords(),
    select: (envelope) => unwrapApiResponse<HiddenWordListResponse>(envelope),
  });

/**
 * Adds a phrase to the personal list.
 *
 * Optimistic: a temporary row (see `isPendingHiddenWord`) is shown at once and is swapped for the
 * server's row on success. On failure the cache rolls back to the snapshot taken in `onMutate`,
 * and the list is refetched, so a refused add (`HIDDEN_WORD_DUPLICATE`, `HIDDEN_WORD_LIMIT_REACHED`
 * or `HIDDEN_WORD_INVALID`) never leaves a row the server does not hold. The caller reads the
 * error code from the rejected mutation.
 */
export const useAddHiddenWord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phrase: string) => userService.addHiddenWord(phrase),
    onMutate: async (phrase) => {
      await queryClient.cancelQueries({ queryKey: hiddenWordsKey });
      const previous = queryClient.getQueryData<HiddenWordsCache>(hiddenWordsKey);
      pendingSequence += 1;
      const pending: HiddenWordEntryResponse = {
        id: `${PENDING_ID_PREFIX}${pendingSequence}`,
        phrase: phrase.trim(),
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<HiddenWordsCache>(hiddenWordsKey, (envelope) =>
        editEntries(envelope, (entries) => [pending, ...entries])
      );
      return { previous, pendingId: pending.id };
    },
    onSuccess: (response, _phrase, context) => {
      const stored = response.data;
      queryClient.setQueryData<HiddenWordsCache>(hiddenWordsKey, (envelope) =>
        editEntries(envelope, (entries) =>
          entries.some((entry) => entry.id === context?.pendingId)
            ? entries.map((entry) => (entry.id === context?.pendingId ? stored : entry))
            : entries.some((entry) => entry.id === stored.id)
              ? entries
              : [stored, ...entries]
        )
      );
    },
    onError: (_error, _phrase, context) => {
      if (context?.previous) queryClient.setQueryData(hiddenWordsKey, context.previous);
      void queryClient.invalidateQueries({ queryKey: hiddenWordsKey });
    },
  });
};

/**
 * Removes one entry by its id.
 *
 * Optimistic: the row disappears at once. On failure the cache rolls back to the snapshot taken in
 * `onMutate` and the list is refetched. `options.onError` runs for every failed removal; a callback
 * passed to `mutate` runs only for the latest call, so quick removals would lose earlier failures.
 */
export const useRemoveHiddenWord = (options: { onError?: (error: unknown) => void } = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) => userService.removeHiddenWord(entryId),
    onMutate: async (entryId) => {
      await queryClient.cancelQueries({ queryKey: hiddenWordsKey });
      const previous = queryClient.getQueryData<HiddenWordsCache>(hiddenWordsKey);
      queryClient.setQueryData<HiddenWordsCache>(hiddenWordsKey, (envelope) =>
        editEntries(envelope, (entries) => entries.filter((entry) => entry.id !== entryId))
      );
      return { previous };
    },
    onError: (error, _entryId, context) => {
      if (context?.previous) queryClient.setQueryData(hiddenWordsKey, context.previous);
      void queryClient.invalidateQueries({ queryKey: hiddenWordsKey });
      options.onError?.(error);
    },
  });
};
