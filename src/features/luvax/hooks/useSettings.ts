import type { ApiResponse } from '@/types/api';
import type { UpdateSettingsRequest, UserSettingsResponse } from '@/types/domain';
type SettingsPatch = {
  [K in keyof UpdateSettingsRequest]?: Exclude<UpdateSettingsRequest[K], null>;
};
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as userService from '../../../services/user.service';

const settingsKey = ['users', 'me', 'settings'];
const updateSettingsMutationKey = ['users', 'me', 'settings', 'update'];

export const useMySettings = () => {
  return useQuery({
    queryKey: settingsKey,
    queryFn: () => userService.getMySettings(),
  });
};

/**
 * Partial update of `PATCH /users/me/settings`: callers pass only the field(s) that changed.
 *
 * Optimistic, since a setting is one value with no server-computed counterpart to reconcile
 * against: the request either lands as sent or the cache rolls back to the snapshot taken in
 * `onMutate`. Used for the notification toggles, `messagePermission` and
 * `hiddenWordsSystemEnabled`, all under the `['users', 'me', 'settings']` key.
 *
 * Changes can follow one another faster than the server answers, so three things keep the cache
 * and the server in agreement. Every update shares the `user-settings` mutation scope, which makes
 * TanStack send the PATCH requests one at a time in the order they were made. A rollback to a
 * snapshot can restore a value an earlier in-flight change had set, so when the last settings
 * mutation settles the key is invalidated and the cache converges on what the server holds.
 * `options.onError` runs for every failed update; a callback passed to `mutate` runs only for
 * the latest call, which would silently drop the failure of an earlier change.
 */
export const useUpdateMySettings = (options: { onError?: (error: unknown) => void } = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: updateSettingsMutationKey,
    scope: { id: 'user-settings' },
    mutationFn: (patch: SettingsPatch) => userService.updateMySettings(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: settingsKey });
      const previous = queryClient.getQueryData<ApiResponse<UserSettingsResponse>>(settingsKey);
      queryClient.setQueryData<ApiResponse<UserSettingsResponse>>(settingsKey, (envelope) =>
        envelope?.data ? { ...envelope, data: { ...envelope.data, ...patch } } : envelope
      );
      return { previous };
    },
    onError: (error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(settingsKey, context.previous);
      options.onError?.(error);
    },
    onSettled: () => {
      // The settling mutation still counts as in flight here, so one means it is the last.
      if (queryClient.isMutating({ mutationKey: updateSettingsMutationKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey: settingsKey });
      }
    },
  });
};
