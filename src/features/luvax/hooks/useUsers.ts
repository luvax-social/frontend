import type { UpdateProfileRequest } from '@/types/domain';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as userService from '../../../services/user.service';

export const userKeys = {
  all: ['users'],
  profile: (userId: string | null | undefined) => [...userKeys.all, 'profile', userId],
  me: () => [...userKeys.all, 'me'],
};

export const useUserProfile = (userId: string | null | undefined, enabled = true) => {
  return useQuery({
    queryKey: userKeys.profile(userId),
    queryFn: () => userService.getUserProfile(userId!),
    enabled: !!userId && enabled,
  });
};

// The self view: carries fields (isPrivate among them) the public profile
// endpoint omits or restricts, so settings screens read from here rather
// than the auth store's lean session user or another user's public shape.
export const useMyProfile = () => {
  return useQuery({
    queryKey: userKeys.me(),
    queryFn: () => userService.getMyProfile(),
  });
};

export const useUpdateMyProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => userService.updateMyProfile(data),
    onSuccess: () => {
      // Typically, auth context might need an update, or we invalidate all users cache
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  });
};
