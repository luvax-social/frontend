import type { ApiResponse } from '@/types/api';
import type { UpdateSettingsRequest, UserSettingsResponse } from '@/types/domain';
type SettingsPatch = {
  [K in keyof UpdateSettingsRequest]?: Exclude<UpdateSettingsRequest[K], null>;
};
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as userService from '../../../services/user.service';

const settingsKey = ['users', 'me', 'settings'];

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
 */
export const useUpdateMySettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) => userService.updateMySettings(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: settingsKey });
      const previous = queryClient.getQueryData<ApiResponse<UserSettingsResponse>>(settingsKey);
      queryClient.setQueryData<ApiResponse<UserSettingsResponse>>(settingsKey, (envelope) =>
        envelope?.data ? { ...envelope, data: { ...envelope.data, ...patch } } : envelope
      );
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(settingsKey, context.previous);
    },
  });
};
