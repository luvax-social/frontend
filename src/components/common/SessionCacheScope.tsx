import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';

/** Discards account-specific server data when the signed-in identity changes. */
export default function SessionCacheScope() {
  const queryClient = useQueryClient();
  useEffect(() => {
    return useAuthStore.subscribe((state, previous) => {
      if (state.user?.id !== previous.user?.id) queryClient.clear();
    });
  }, [queryClient]);
  return null;
}
