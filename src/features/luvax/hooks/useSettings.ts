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

// Partial updates: callers pass only the field(s) that changed. Optimistic,
// since a settings toggle is a single boolean with no server-computed
// counterpart to reconcile against - the request either lands as sent or
// rolls back.
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
